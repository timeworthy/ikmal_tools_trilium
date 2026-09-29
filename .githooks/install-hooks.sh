#!/usr/bin/env bash
# Install repository hooks without replacing a developer's custom hook path.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install-hooks.sh [--native|--lefthook] [repository-path]

By default, use Lefthook when available; otherwise configure Git to run
the repository's .githooks directory directly. Existing custom hook paths
are preserved and cause the installer to stop with guidance.
EOF
}

mode=auto
repo_path=.
for arg in "$@"; do
  case "$arg" in
    --native) mode=native ;;
    --lefthook) mode=lefthook ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
    *) repo_path="$arg" ;;
  esac
done

repo_root="$(git -C "$repo_path" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Error: '$repo_path' is not inside a Git repository." >&2
  exit 1
}
hooks_dir="$repo_root/.githooks"
if [ ! -d "$hooks_dir" ]; then
  echo "Error: .githooks directory not found at $hooks_dir" >&2
  exit 1
fi

configured_path="$(git -C "$repo_root" config --local --get core.hooksPath || true)"
if [ -n "$configured_path" ] && [ "$configured_path" != ".githooks" ] && [ "$configured_path" != "$hooks_dir" ]; then
  echo "A custom core.hooksPath is already configured: $configured_path" >&2
  echo "FleetDev left it unchanged. Review that hook setup before choosing another path." >&2
  exit 1
fi

if [ "$mode" = auto ]; then
  if command -v lefthook >/dev/null 2>&1 && [ -f "$repo_root/lefthook.yml" ]; then
    mode=lefthook
  else
    mode=native
  fi
fi

case "$mode" in
  lefthook)
    if ! command -v lefthook >/dev/null 2>&1; then
      echo "Lefthook was requested but is not installed. Install it or use --native." >&2
      exit 1
    fi
    if [ ! -f "$repo_root/lefthook.yml" ]; then
      echo "Lefthook was requested but lefthook.yml is missing." >&2
      exit 1
    fi
    (cd "$repo_root" && lefthook install)
    echo "Installed FleetDev hooks with Lefthook."
    ;;
  native)
    git -C "$repo_root" config --local core.hooksPath .githooks
    echo "Installed native Git hooks from $hooks_dir."
    ;;
  *) echo "Internal error: unknown install mode '$mode'." >&2; exit 2 ;;
esac

echo "Run 'make pre-pr' before opening a pull request."
