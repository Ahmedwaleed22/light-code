#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$repo_root/infra/scripts/install-go.sh"
"$repo_root/infra/scripts/setup.sh"
