#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -x "$repo_root/.tools/go/bin/go" ]]; then
  export PATH="$repo_root/.tools/go/bin:$PATH"
fi
npm --prefix "$repo_root/frontend" run build
mkdir -p "$repo_root/backend/bin"
(cd "$repo_root/backend" && go build -trimpath -ldflags='-s -w' -o bin/api ./cmd/api)
echo "Built frontend/dist and backend/bin/api"
echo "Run: cd backend && ./bin/api"
