#!/usr/bin/env bash
# Check shell scripts without losing failures from a per-file find command.
set -euo pipefail

mode="syntax"
if [[ "${1:-}" == "--shellcheck" ]]; then
  mode="shellcheck"
  shift
fi
if [[ $# -eq 0 ]]; then
  echo "Usage: check-shell-syntax.sh [--shellcheck] DIRECTORY..." >&2
  exit 2
fi

while IFS= read -r -d '' script; do
  if [[ "$mode" == "shellcheck" ]]; then
    shellcheck "$script"
  else
    bash -n "$script"
  fi
done < <(find "$@" -type f -name '*.sh' -print0)
