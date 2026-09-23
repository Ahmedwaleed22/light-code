// Linux/Node 22 benchmark. Uses an isolated temporary workspace and stops its child server.
// Run: node infra/scripts/measure-resources.mjs [backend/bin/api]
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const binary = resolve(process.argv[2] ?? join(repo, 'backend/bin/api'));
const root = await mkdtemp(join(repo, '.resource-check-'));
const sockets = [];
let server;
let sampleTimer;
let peakRSS = 0;
const ticks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());

async function usage() {
  const [status, stat, io] = await Promise.all(['status', 'stat', 'io'].map((name) => readFile(`/proc/${server.pid}/${name}`, 'utf8')));
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
  const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
  peakRSS = Math.max(peakRSS, rss);
  return { rss, cpu: (Number(fields[11]) + Number(fields[12])) / ticks, reads: Number(io.match(/^syscr:\s+(\d+)/m)?.[1] ?? 0) };
}

async function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws`);
  sockets.push(ws);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  };
  return (op, args = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    const timer = setTimeout(() => reject(new Error(`${op} timed out`)), 30_000);
    pending.set(current, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: current, op, args }));
  });
}

try {
  await mkdir(join(root, 'src'));
  for (let i = 0; i < 1000; i++) await writeFile(join(root, 'src', `${i}.ts`), "const greeting = 'Hello, world!';\n".repeat(32));
  await writeFile(join(root, 'large.txt'), 'abcdefghijklmno\n'.repeat(65536));
  for (let i = 0; i < 20; i++) await writeFile(join(root, `${i}.txt`), 'initial');
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  server = spawn(binary, [], { cwd: join(repo, 'backend'), env: { ...process.env, HTTP_ADDR: `127.0.0.1:${port}`, WORKSPACE_ROOT: root }, stdio: ['ignore', 'ignore', 'pipe'] });
  const exited = once(server, 'exit');
  let logs = '';
  server.stderr.on('data', (data) => { logs = (logs + data).slice(-4000); });
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {}
    if (server.exitCode !== null || i >= 100) throw new Error(`Server did not start: ${logs}`);
    await delay(50);
  }
  const clients = await Promise.all(Array.from({ length: 20 }, () => client(port)));
  const idle = await usage();
  await delay(1000);
  const start = await usage();
  sampleTimer = setInterval(() => { void usage().catch(() => {}); }, 50);
  const latencies = [];
  const began = performance.now();
  await Promise.all(clients.map(async (rpc, i) => {
    let doc = await rpc('read', { path: `${i}.txt` });
    for (let j = 0; j < 100; j++) {
      const began = performance.now();
      doc = await rpc('save', { path: `${i}.txt`, version: doc.version, content: `${i}:${j}\n` + 'x'.repeat(20 * 1024) });
      latencies.push(performance.now() - began);
      if (j % 20 === 0) {
        await rpc('read', { path: 'large.txt' });
        await rpc('search', { query: 'absent-token' });
      }
    }
  }));
  const elapsed = (performance.now() - began) / 1000;
  const end = await usage();
  await delay(3000);
  const settled = await usage();
  latencies.sort((a, b) => a - b);
  const mib = (n) => +(n / 1024 / 1024).toFixed(2);
  console.log(JSON.stringify({
    clients: 20, saves: 2000, requests: 2220, seconds: +elapsed.toFixed(2),
    saveMedianMs: +latencies[Math.floor(latencies.length / 2)].toFixed(2),
    saveP95Ms: +latencies[Math.floor(latencies.length * 0.95)].toFixed(2),
    idleRSSMiB: mib(idle.rss), peakRSSMiB: mib(peakRSS), settledRSSMiB: mib(settled.rss),
    idleCPUPercent: +((start.cpu - idle.cpu) * 100).toFixed(2),
    cpuSeconds: +(end.cpu - start.cpu).toFixed(2), averageCores: +((end.cpu - start.cpu) / elapsed).toFixed(2),
    readSyscalls: end.reads - start.reads,
  }, null, 2));
  clearInterval(sampleTimer);
  for (const ws of sockets) ws.close();
  server.kill('SIGTERM');
  await exited;
} finally {
  clearInterval(sampleTimer);
  for (const ws of sockets) ws.close();
  if (server && server.exitCode === null && server.signalCode === null) { server.kill('SIGKILL'); await once(server, 'exit').catch(() => {}); }
  await rm(root, { recursive: true, force: true });
}
