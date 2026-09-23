# light-code

A lightweight, VS Code-style editor that runs on your server and is controlled from the browser. It targets under 100 MB of combined server and browser-app memory (20–50 MB typical) and keeps typing and tab switching entirely local, so the network is never in the typing path.

## Features

- VS Code-style layout: activity bar, explorer, tabs, breadcrumbs, and status bar, with a mobile layout below 760 px.
- CodeMirror 6 editor with Dark+ syntax colours, multiple cursors, find and replace, bracket matching, folding, and per-tab undo history. Language packs load on first use.
- Explorer with lazy folder loading, virtualized rows, inline create and rename, delete, and a context menu.
- Quick open (Ctrl/Cmd+P), command palette (Ctrl/Cmd+Shift+P or F1), and text search across files (Ctrl/Cmd+Shift+F).
- Auto save after 750 ms (toggle in the status bar) and manual save (Ctrl/Cmd+S).

## Connection model

Each browser tab opens one WebSocket (`/api/ws`) that carries every workspace operation: `list`, `read`, `save`, `create`, `mkdir`, `rename`, `delete`, `index`, and `search`. The server pushes `files.saved`, `files.created`, `files.renamed`, and `files.deleted` events from the pub/sub bus to all other tabs, so changes made elsewhere appear without polling.

Each tab sends at most four file requests at once and keeps at most 128 pending requests. The server shares eight file-operation slots across connections and one separate search slot. Superseded searches are canceled over the socket; pings and cancellations can pass while file operations are busy. Slow clients are disconnected when their reply queue exceeds 64 messages or 16 MiB, then resynchronize on reconnect.

A connection cannot survive a laptop sleeping, so the client is built to recover quickly:

- Waking up, going online, focusing, or showing the page triggers an immediate ping. A missed reply forces a reconnect within about four seconds; a stalled handshake is abandoned after five.
- Requests made while offline are queued and sent after reconnecting. Replaying a save is safe because the server accepts identical content as already saved. Create, rename, and delete are not replayed; the explorer refreshes instead.
- Unsaved text is mirrored to IndexedDB and restored after a reload, crash, or discarded tab.
- Saves include the version they were based on. If the server copy changed in the meantime, the editor keeps both versions and asks which one to keep.

## Layout

- `frontend/src/shared/`: WebSocket client, IndexedDB drafts, and session preferences.
- `frontend/src/features/editor/`: CodeMirror view, tab state, saving, conflicts, languages, and theme.
- `frontend/src/features/{explorer,search,palette,layout}/`: explorer, search panel, command palette, status bar, icons, and menus.
- `backend/cmd/api/`: executable and dependency wiring.
- `backend/internal/services/files/`: workspace file operations, version checks, index, search, and change events.
- `backend/internal/transport/wsapi/`: WebSocket protocol, per-connection request handling, and event broadcast.
- `backend/internal/transport/httpapi/`: health check, socket route, and static file serving with pre-compressed assets.
- `backend/internal/events/`: pub/sub contract and synchronous in-memory adapter.
- `infra/scripts/`: toolchain setup, development, and production build scripts.
- `data/workspace/`: default editable files.

## Develop

Requires Node.js 20.19+ (or 22.12+). The setup script installs a project-local Go toolchain if needed.

```sh
./setup.sh
./infra/scripts/dev.sh
```

Vite serves the frontend on port 5173 and proxies `/api`, including the WebSocket, to the Go server on `127.0.0.1:8080`.

Vite is development tooling and can exceed the app's memory budget. To test the small runtime footprint, use the built app below; it needs one Go process and no Node/Vite process. Source changes then require rebuilding and restarting instead of hot reload.

## Build and run with one server process

```sh
./infra/scripts/build.sh
cd backend && ./bin/api
```

The Go process serves the built frontend and the socket on `127.0.0.1:8080` by default. Configuration:

- `HTTP_ADDR`: listen address.
- `WORKSPACE_ROOT`: editable directory.
- `FRONTEND_DIST`: built frontend directory.
- `ALLOWED_ORIGINS`: comma-separated extra host patterns allowed to open the socket, for example `*.example.com`. Same-origin connections are always allowed.
- `GOMEMLIMIT`: soft memory target; defaults to 32 MiB.

Paths are resolved relative to the backend process's working directory. There is no authentication yet; put authentication and TLS in front of the server before exposing it publicly.

## Measured baseline

Measured in headless Chromium against the production build, with five 1 MiB files open:

| Metric | Result |
| --- | --- |
| Browser JavaScript heap | 14–15 MB |
| Go server resident memory | 8 MB idle; about 32 MB after serving the large files |
| Keystroke to painted frame | about one frame (median 17–22 ms at 60 Hz) |
| Switching between open tabs | median 22–34 ms, with no network request |
| Reconnect after the server resumes | under 100 ms |
| Core JavaScript | 134 KB gzip; language packs load on first use |

These figures exclude the browser's own process overhead, which varies by browser and operating system.

Resource checks are reproducible on Linux with Node 22:

```sh
node infra/scripts/measure-resources.mjs
cd backend && ../.tools/go/bin/go test ./internal/services/files -run '^$' -bench 'Benchmark(SearchWorkspace|Save)' -benchmem
```

The socket workload uses an isolated temporary workspace with 1,000 source files, a 1 MiB file, and 20 clients making 2,000 saves, 100 large-file reads and 100 searches. It reports sampled process RSS and CPU time, removes its fixtures, and stops its own server. The microbenchmark measures warm searches separately from initial cache population. `GOMEMLIMIT` is a soft Go memory target, not a hard limit on process RSS or the whole browser.

## Design limits

Text files are limited to 2 MiB and must be UTF-8. Search is a case-insensitive literal match that skips `.git`, `node_modules`, binary files, and files over 2 MiB; it returns at most 500 matches. Quick open indexes up to 50,000 files. The in-memory event bus only delivers within one process; use a durable broker adapter when running multiple instances.

Search retains text and lowercase text in a 4 MiB cache (at most 4,096 entries). Files over 128 KiB are scanned without entering the cache. Each query still walks directory metadata to discover external changes; cached files are checked by identity, size, mode, and modification time, and app mutations invalidate affected entries immediately. This avoids repeatedly reading unchanged small files without retaining a full repository in RAM. Initial searches and repositories larger than the cache still require disk reads. Saves retain version checking and atomic replacement, reuse a correctly sized read buffer, and skip rewriting identical content.
