#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required (Node.js 20.19+ or 22.12+)." >&2
  exit 1
fi

if [[ -x "$repo_root/.tools/go/bin/go" ]]; then
  export PATH="$repo_root/.tools/go/bin:$PATH"
fi

if ! command -v go >/dev/null 2>&1; then
  echo "Go is required (1.23+). Run ./setup.sh to install it." >&2
  exit 1
fi

npm --prefix "$repo_root/frontend" ci
(cd "$repo_root/backend" && go mod download)

echo "Setup complete. Run infra/scripts/dev.sh to start both apps."
