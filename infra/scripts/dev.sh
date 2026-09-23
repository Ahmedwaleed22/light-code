#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -x "$repo_root/.tools/go/bin/go" ]]; then
  export PATH="$repo_root/.tools/go/bin:$PATH"
fi

mkdir -p "$repo_root/backend/bin"
(cd "$repo_root/backend" && go build -o bin/api ./cmd/api)
(cd "$repo_root/backend" && exec ./bin/api) &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT

(cd "$repo_root/frontend" && npm run dev)
