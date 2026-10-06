#!/usr/bin/env bash
# Version-pinned, local-first GitHub Actions syntax and security checks.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ACTIONLINT_VERSION="v1.7.12"
ZIZMOR_VERSION="1.29.0"
REQUIRE_TOOLS="${FLEETDEV_REQUIRE_WORKFLOW_LINTERS:-0}"
ACTIONLINT_CMD=()
ZIZMOR_CMD=()

resolve_actionlint() {
  if command -v actionlint >/dev/null 2>&1 && actionlint -version 2>&1 | grep -Fq "$ACTIONLINT_VERSION"; then
    ACTIONLINT_CMD=(actionlint)
    return 0
  fi
  if command -v go >/dev/null 2>&1; then
    ACTIONLINT_CMD=(go run "github.com/rhysd/actionlint/cmd/actionlint@$ACTIONLINT_VERSION")
    return 0
  fi
  if [[ "$REQUIRE_TOOLS" == "1" ]]; then
    echo "FAIL: actionlint $ACTIONLINT_VERSION is required; install Go or the exact actionlint release." >&2
    return 1
  fi
  echo "SKIP: actionlint $ACTIONLINT_VERSION unavailable (install Go or actionlint to enable this local check)." >&2
  return 2
}

resolve_zizmor() {
  if command -v zizmor >/dev/null 2>&1 && zizmor --version 2>&1 | grep -Fq "$ZIZMOR_VERSION"; then
    ZIZMOR_CMD=(zizmor)
    return 0
  fi
  if command -v uvx >/dev/null 2>&1; then
    ZIZMOR_CMD=(uvx --from "zizmor==$ZIZMOR_VERSION" zizmor)
    return 0
  fi
  if [[ "$REQUIRE_TOOLS" == "1" ]]; then
    echo "FAIL: zizmor $ZIZMOR_VERSION is required; install that version or uv with the pinned package cached." >&2
    return 1
  fi
  echo "SKIP: zizmor $ZIZMOR_VERSION unavailable (install it or uv to enable this local check)." >&2
  return 2
}

run_actionlint() {
  "${ACTIONLINT_CMD[@]}" -no-color "$@"
}

run_zizmor() {
  "${ZIZMOR_CMD[@]}" --offline --strict-collection --no-progress --format=plain "$@"
}

main() {
  local actionlint_status=0 zizmor_status=0
  local -a workflows

  if (($#)); then
    workflows=("$@")
  else
    shopt -s nullglob
    workflows=("$ROOT"/.github/workflows/*.yml "$ROOT"/templates/git-guardrails/.github/workflows/*.yml)
    shopt -u nullglob
  fi
  if ((${#workflows[@]} == 0)); then
    echo "FAIL: no GitHub Actions workflow files were found." >&2
    return 1
  fi

  printf 'Checking %d workflow file(s) with pinned actionlint %s and zizmor %s.\n' \
    "${#workflows[@]}" "$ACTIONLINT_VERSION" "$ZIZMOR_VERSION"

  if resolve_actionlint; then
    printf '\n==> actionlint %s\n' "$ACTIONLINT_VERSION"
    run_actionlint "${workflows[@]}"
    echo '✓ Workflow syntax and expressions'
  else
    actionlint_status=$?
    if ((actionlint_status == 2)); then
      actionlint_status=0
    fi
  fi

  if resolve_zizmor; then
    printf '\n==> zizmor %s (offline audit)\n' "$ZIZMOR_VERSION"
    run_zizmor "${workflows[@]}"
    echo '✓ Workflow security audit'
  else
    zizmor_status=$?
    if ((zizmor_status == 2)); then
      zizmor_status=0
    fi
  fi

  if ((actionlint_status != 0 || zizmor_status != 0)); then
    return 1
  fi
}

main "$@"
