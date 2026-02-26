#!/usr/bin/env bash
set -euo pipefail

# Resolve h5 project root from current script directory.
# Usage:
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "$SCRIPT_DIR/../lib/project-root.sh"
#   PROJECT_ROOT="$(resolve_h5_project_root "$SCRIPT_DIR" 3)"
#   cd "$PROJECT_ROOT"
resolve_h5_project_root() {
  local script_dir="$1"
  local levels_up="${2:-1}"
  local root="$script_dir"
  local i=0

  while [ "$i" -lt "$levels_up" ]; do
    root="$(dirname "$root")"
    i=$((i + 1))
  done

  if [ ! -f "$root/package.json" ] || [ ! -d "$root/src" ]; then
    echo "Failed to resolve h5 project root from: $script_dir" >&2
    return 1
  fi

  echo "$root"
}
