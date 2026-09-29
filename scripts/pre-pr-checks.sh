#!/usr/bin/env bash
# Local verification used by FleetDev's generic Git pre-push hook and CI.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this check from inside a Git repository." >&2
  exit 1
}
cd "$ROOT"

run() {
  printf '\n==> %s\n' "$1"
  shift
  "$@"
}

if [ -f go.mod ]; then
  command -v go >/dev/null 2>&1 || { echo "Go is required because this repository has go.mod." >&2; exit 1; }
  format_output="$(find . -type f -name '*.go' -not -path './vendor/*' -print0 | xargs -0 gofmt -l)"
  if [ -n "$format_output" ]; then
    echo "Go files need formatting:" >&2
    printf '%s\n' "$format_output" >&2
    exit 1
  fi
  run 'Go tests' go test -count=1 ./...
  run 'Go vet' go vet ./...
  run 'Go build' go build ./...
fi

if [ -f package.json ]; then
  command -v npm >/dev/null 2>&1 || { echo "npm is required because this repository has package.json." >&2; exit 1; }
  run 'JavaScript package tests (when defined)' npm run test --if-present
fi

for harness in scripts/agent_merge_queue_harness.mjs scripts/branch-retirement-harness.mjs scripts/check_pr_guardrails_harness.mjs; do
  if [ -f "$harness" ]; then
    command -v node >/dev/null 2>&1 || { echo "Node.js is required to run $harness." >&2; exit 1; }
    run "Guardrails harness: $harness" node "$harness"
  fi
done

shell_dirs=()
for directory in .githooks scripts tests; do
  [ -d "$directory" ] && shell_dirs+=("$directory")
done
if [ "${#shell_dirs[@]}" -gt 0 ]; then
  if [ -f scripts/check-shell-syntax.sh ]; then
    bash scripts/check-shell-syntax.sh "${shell_dirs[@]}"
  else
    # Compatibility for installations made before the shared checker shipped.
    while IFS= read -r -d '' script; do bash -n "$script"; done < <(find "${shell_dirs[@]}" -type f -name '*.sh' -print0)
  fi
fi

if [ -d .github/workflows ] && find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) -print -quit | grep -q .; then
  if [ -f scripts/check-actions.sh ]; then
    run 'GitHub Actions syntax and security' bash scripts/check-actions.sh
  else
    echo "GitHub Actions workflows are present but scripts/check-actions.sh is missing." >&2
    exit 1
  fi
fi

echo "✅ Local pre-PR checks passed."
