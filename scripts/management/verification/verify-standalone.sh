#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/project-root.sh"
ROOT_DIR="$(resolve_h5_project_root "$SCRIPT_DIR" 3)"
cd "$ROOT_DIR"

echo "=== Verify Standalone H5 ==="

# 1) No parent-path dependency in active project files.
# Ignore archived/reference docs and node_modules/dist.
if rg -n "\.{2}/(kernel-dev|apps|packages|docker|etc|logs|ref)" \
  --glob '!node_modules/**' \
  --glob '!dist/**' \
  --glob '!check/**' \
  --glob '!docs/**' \
  . >/tmp/h5_standalone_check.txt 2>/dev/null; then
  echo "❌ Found external parent-directory references:"
  cat /tmp/h5_standalone_check.txt
  exit 1
fi

# 2) No git submodule definition in h5.
if [ -f .gitmodules ]; then
  echo "❌ .gitmodules exists in h5; remove submodule dependency."
  exit 1
fi

# 3) Build should pass standalone.
npm run build >/tmp/h5_standalone_build.log 2>&1 || {
  echo "❌ Standalone build failed"
  sed -n '1,160p' /tmp/h5_standalone_build.log
  exit 1
}

echo "✅ Standalone verification passed"
