import { signal } from '@preact/signals';

// One WebSocket per tab carries every workspace request plus server-pushed change events.
// The connection is re-established immediately after sleep, network changes, or tab resume;
// requests issued while offline are queued and sent once it returns.

export type ConnectionState = 'connecting' | 'online' | 'offline';
export const connection = signal<ConnectionState>('connecting');

export class RpcError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

type Pending = {
  op: string; args: unknown; resolve: (value: any) => void; reject: (error: Error) => void;
  sent: boolean; canceled: boolean; dispose: () => void;
};

// Mutations are not blindly replayed after a drop; the caller must check whether they applied.
// Saves are safe to replay because the server treats a repeat of identical content as success.
const unsafeToReplay = new Set(['create', 'mkdir', 'rename', 'delete']);
const HEARTBEAT_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;
const CONNECT_TIMEOUT_MS = 5_000;
const MAX_IN_FLIGHT = 4;
const MAX_PENDING = 128;

let socket: WebSocket | null = null;
let nextId = 1;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeat: ReturnType<typeof setTimeout> | undefined;
let activeProbe: AbortController | null = null;
let hasConnected = false;
let started = false;
const pending = new Map<number, Pending>();
const listeners = new Map<string, Set<(data: any) => void>>();
const reconnectHooks = new Set<() => void>();

function socketURL() {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/ws`;
}

function transmit(ws: WebSocket, id: number, entry: Pending) {
  ws.send(JSON.stringify({ id, op: entry.op, args: entry.args ?? {} }));
  entry.sent = true;
}

function flush() {
  if (socket?.readyState !== WebSocket.OPEN) return;
  let inFlight = [...pending.values()].filter((entry) => entry.sent && entry.op !== 'ping').length;
  for (const [id, entry] of pending) {
    if (entry.sent || entry.canceled) continue;
    // Heartbeats must still pass while file operations are busy.
    if (entry.op !== 'ping' && inFlight >= MAX_IN_FLIGHT) continue;
    transmit(socket, id, entry);
    if (entry.op !== 'ping') inFlight++;
  }
}

function scheduleHeartbeat() {
  clearTimeout(heartbeat);
  if (document.visibilityState === 'visible') heartbeat = setTimeout(probe, HEARTBEAT_MS);
}

function connect() {
  if (socket) return;
  clearTimeout(retryTimer);
  if (connection.value !== 'offline') connection.value = 'connecting';
  const ws = new WebSocket(socketURL());
  socket = ws;
  // A frozen or unreachable server can leave the handshake pending indefinitely.
  const handshake = setTimeout(() => { if (ws.readyState === WebSocket.CONNECTING) dropped(ws); }, CONNECT_TIMEOUT_MS);
  ws.onopen = () => {
    clearTimeout(handshake);
    attempt = 0;
    scheduleHeartbeat();
    connection.value = 'online';
    flush();
    if (hasConnected) reconnectHooks.forEach((hook) => hook());
    hasConnected = true;
  };
  ws.onmessage = (event) => {
    scheduleHeartbeat();
    const message = JSON.parse(event.data as string);
    if (message.event) {
      listeners.get(message.event)?.forEach((listener) => listener(message.data));
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    entry.dispose();
    if (!entry.canceled) {
      if (message.error) entry.reject(new RpcError(message.error.code, message.error.message));
      else entry.resolve(message.result);
    }
    flush();
  };
  ws.onclose = () => { clearTimeout(handshake); dropped(ws); };
}

function dropped(ws: WebSocket) {
  if (socket !== ws) return;
  socket = null;
  clearTimeout(heartbeat);
  activeProbe?.abort();
  activeProbe = null;
  ws.onclose = ws.onmessage = ws.onopen = null;
  ws.close();
  connection.value = 'offline';
  for (const [id, entry] of pending) {
    if (entry.canceled || (entry.sent && unsafeToReplay.has(entry.op))) {
      pending.delete(id);
      entry.dispose();
      if (!entry.canceled) entry.reject(new RpcError('disconnected', 'Connection lost before the server confirmed this change.'));
    } else entry.sent = false;
  }
  // Retry fast at first, then back off to at most 5 s; resume events reconnect immediately.
  const delay = Math.min(5_000, 100 * 2 ** attempt++);
  retryTimer = setTimeout(connect, delay);
}

// Confirms the socket is really alive. After a laptop sleeps the browser can report an open
// socket that is dead, so a missed ping forces an immediate reconnect.
function probe() {
  const ws = socket;
  if (!ws || ws.readyState !== WebSocket.OPEN || activeProbe) return;
  const controller = new AbortController();
  activeProbe = controller;
  const timer = setTimeout(() => {
    if (socket === ws) { dropped(ws); reconnectNow(); }
  }, PROBE_TIMEOUT_MS);
  void request('ping', undefined, controller.signal).catch(() => {}).finally(() => {
    clearTimeout(timer);
    if (activeProbe === controller) activeProbe = null;
  });
}

function reconnectNow() {
  attempt = 0;
  if (!socket) connect();
  else probe();
}

export function startConnection() {
  if (started) return;
  started = true;
  connect();
  const wake = () => { if (document.visibilityState === 'visible') reconnectNow(); };
  addEventListener('online', reconnectNow);
  addEventListener('pageshow', reconnectNow);
  addEventListener('focus', wake);
  document.addEventListener('visibilitychange', () => {
    clearTimeout(heartbeat);
    wake();
  });
}

export function request<T = unknown>(op: string, args?: unknown, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Canceled', 'AbortError')); return; }
    if (op !== 'ping' && pending.size >= MAX_PENDING) { reject(new RpcError('busy', 'Too many pending requests. Please try again.')); return; }
    const id = nextId++;
    const entry: Pending = { op, args, resolve, reject, sent: false, canceled: false, dispose: () => signal?.removeEventListener('abort', abort) };
    const abort = () => {
      entry.canceled = true;
      entry.args = undefined;
      entry.dispose();
      if (entry.sent && socket?.readyState === WebSocket.OPEN) {
        // Keep its slot until the server acknowledges cancellation, avoiding overload races.
        socket.send(JSON.stringify({ id: 0, op: 'cancel', args: { id } }));
      } else pending.delete(id);
      reject(new DOMException('Canceled', 'AbortError'));
      flush();
    };
    signal?.addEventListener('abort', abort, { once: true });
    pending.set(id, entry);
    flush();
  });
}

export function on(event: string, listener: (data: any) => void) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  const subscribers = listeners.get(event)!;
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(event);
  };
}

export function onReconnect(hook: () => void) {
  reconnectHooks.add(hook);
  return () => { reconnectHooks.delete(hook); };
}
