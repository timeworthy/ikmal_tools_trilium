#!/usr/bin/env bash
# Scan staged Git objects so a smaller or sanitized worktree cannot hide what
# will actually be committed. This uses only Git and the system grep/sed tools.
if [ "${ALLOW_SECRET_SCAN_BYPASS:-0}" = "1" ]; then
  echo "⚠️  Secret scan bypass requested; CI will still scan and verify this change." >&2
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Secret scan must run from inside a Git worktree." >&2
  exit 1
fi

if [ -n "$(git ls-files -u 2>/dev/null)" ]; then
  echo "🛑 Resolve staged merge conflicts before committing." >&2
  exit 1
fi

patterns=(
  'sk-[a-zA-Z0-9]{20,}'
  'sk-proj-[-a-zA-Z0-9_]{20,}'
  'ghp_[a-zA-Z0-9]{36}'
  'gho_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}'
  'AKIA[0-9A-Z]{16}'
  'xox[baprs]-[-0-9a-zA-Z]{10,}'
  '-----BEGIN (RSA|EC|DSA|OPENSSH|PGP)? ?PRIVATE KEY-----'
  'AIza[-0-9A-Za-z_]{35}'
)
combined_pattern=$(IFS='|'; echo "${patterns[*]}")

blocked=0
scanned=0
while IFS= read -r -d '' path; do
  oid=$(git --literal-pathspecs rev-parse --verify ":$path" 2>/dev/null) || {
    echo "🛑 Could not read the staged version of a changed file." >&2
    printf '   File: %q\n' "$path" >&2
    exit 1
  }
  scanned=$((scanned + 1))

  base=${path##*/}
  case "$base" in
    id_rsa|id_dsa|id_ed25519|*.pem|*.key|*.pkcs12|*.p12|.env|.env.local|.env.production|.env.staging)
      echo "🛑 [Secret Scan Blocked] High-risk credential file staged:" >&2
      printf '   File: %q\n' "$path" >&2
      blocked=1
      continue
      ;;
  esac

  # Do not print matching lines: they may contain the credential itself.
  line_numbers=$(git cat-file blob "$oid" 2>/dev/null | grep -aE -n "$combined_pattern" | cut -d: -f1 | head -n 3 || true)
  if [ -n "$line_numbers" ]; then
    echo "🛑 [Secret Scan Blocked] Credential-like value in staged content:" >&2
    printf '   File: %q (line(s) %s)\n' "$path" "$(echo "$line_numbers" | tr '\n' ',')" >&2
    blocked=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMRT -z 2>/dev/null)

if [ "$blocked" -ne 0 ]; then
  echo "   Remove the value, re-stage the file, and retry. For reviewed mock data only, use ALLOW_SECRET_SCAN_BYPASS=1 explicitly." >&2
  exit 1
fi

if [ "$scanned" -gt 0 ]; then
  echo "✅ Secret scan checked $scanned staged file(s)."
fi
exit 0
