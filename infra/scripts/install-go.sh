#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
go_version="1.27.1"
go_home="$repo_root/.tools/go"

if command -v go >/dev/null 2>&1 && go version | awk '{ split($3, v, "go"); split(v[2], n, "."); exit !(n[1] > 1 || (n[1] == 1 && n[2] >= 23)) }'; then
  echo "Using installed $(go version)"
  exit 0
fi

if [[ -x "$go_home/bin/go" ]] && [[ "$("$go_home/bin/go" version)" == *"go${go_version} "* ]]; then
  echo "Using project Go $go_version"
  exit 0
fi

case "$(uname -m)" in
  x86_64) arch="amd64" ;;
  aarch64) arch="arm64" ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT
curl --fail --location --silent --show-error "https://go.dev/dl/go${go_version}.linux-${arch}.tar.gz" -o "$archive"
mkdir -p "$repo_root/.tools"
rm -rf "$go_home"
tar -C "$repo_root/.tools" -xzf "$archive"
echo "Installed Go $go_version at $go_home"
