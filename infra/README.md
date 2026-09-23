# Infrastructure scripts

- `../setup.sh` installs a project-local Go toolchain when needed, then installs locked frontend dependencies.
- `scripts/dev.sh` builds and starts the API, then starts Vite. Both stop when the terminal session ends.
- `scripts/build.sh` creates `frontend/dist` and a stripped `backend/bin/api` binary. The Go API serves both UI and API from one process.

Default API address: `127.0.0.1:8080`. Default editable root: `data/workspace`, resolved from the backend working directory. Set `HTTP_ADDR`, `WORKSPACE_ROOT`, or `FRONTEND_DIST` as needed. Broker and deployment configuration can be added here when infrastructure choices are made.
