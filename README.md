# light-code

A small web text editor built with Preact, Signals, and Go. The first version supports browsing files, opening multiple tabs, creating files, editing, saving with Ctrl/Cmd+S, and detecting conflicting saves.

## Layout

- `frontend/src/features/editor/`: file API, reactive document state, tabs, editor, and toolbar.
- `frontend/src/shared/`: shared browser API helpers.
- `backend/cmd/api/`: executable and dependency wiring.
- `backend/internal/services/files/`: workspace file operations and version checks.
- `backend/internal/transport/httpapi/`: HTTP routes.
- `backend/internal/events/`: pub/sub contract and synchronous in-memory adapter. Saves publish `file.saved`.
- `infra/scripts/`: toolchain setup, development, and production build scripts.
- `data/workspace/`: default editable files.

## Develop

Requires Node.js 20.19+ (or 22.12+). The setup script installs a project-local Go toolchain if needed.

```sh
./setup.sh
./infra/scripts/dev.sh
```

Vite serves the frontend on port 5173 and proxies `/api` to the Go API on `127.0.0.1:8080`.

## Build and run with one server process

```sh
./infra/scripts/build.sh
cd backend && ./bin/api
```

The Go process serves the built frontend and API on `127.0.0.1:8080` by default. Set `HTTP_ADDR` to change the listener, `WORKSPACE_ROOT` to choose the editable directory, and `FRONTEND_DIST` to point to the built frontend. These paths are resolved relative to the backend process's working directory. Put authentication and TLS in front of the server before exposing it publicly.

## Design limits

The first editor uses a native textarea instead of a large editor framework. Text files are limited to 2 MiB and must be UTF-8. This keeps editing and transfers predictable while syntax highlighting and advanced editing features are planned. The in-memory event bus only delivers within one process; use a durable broker adapter when cross-instance delivery matters. A browser process's total memory includes browser overhead beyond the app's JavaScript heap, so the 100 MB target needs measurement in the intended browser and server environment.
