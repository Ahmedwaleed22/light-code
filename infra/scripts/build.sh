#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ -x "$repo_root/.tools/go/bin/go" ]]; then
  export PATH="$repo_root/.tools/go/bin:$PATH"
fi
npm --prefix "$repo_root/frontend" run build
# Pre-compress once at build time; the Go server serves .gz siblings to gzip-capable browsers.
find "$repo_root/frontend/dist" -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' \) -exec gzip -9 -k -f {} \;
mkdir -p "$repo_root/backend/bin"
(cd "$repo_root/backend" && go build -trimpath -ldflags='-s -w' -o bin/api ./cmd/api)
echo "Built frontend/dist and backend/bin/api"
echo "Run: cd backend && ./bin/api"
