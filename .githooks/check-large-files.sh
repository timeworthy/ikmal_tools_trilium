#!/usr/bin/env bash
# Enforce repository hygiene using the size of each staged Git object.
if [ "${ALLOW_LARGE_FILES:-0}" = "1" ]; then
  echo "⚠️  Large-file check bypass requested; CI will still verify the change." >&2
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Large-file check must run from inside a Git worktree." >&2
  exit 1
fi

MAX_BYTES=$((5 * 1024 * 1024))
too_large=0
scanned=0
while IFS= read -r -d '' path; do
  oid=$(git --literal-pathspecs rev-parse --verify ":$path" 2>/dev/null) || {
    echo "🛑 Could not read the staged version of a changed file." >&2
    printf '   File: %q\n' "$path" >&2
    exit 1
  }
  size=$(git cat-file -s "$oid" 2>/dev/null) || {
    echo "🛑 Could not measure a staged file." >&2
    printf '   File: %q\n' "$path" >&2
    exit 1
  }
  scanned=$((scanned + 1))
  if [ "$size" -gt "$MAX_BYTES" ]; then
    mb=$(awk "BEGIN {printf \"%.2f\", $size / 1048576}")
    printf '🛑 [Large Files Blocked] %s is %sMB in the staged commit (limit: 5MB).\n' "$path" "$mb" >&2
    too_large=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACMRT -z 2>/dev/null)

if [ "$too_large" -ne 0 ]; then
  echo "   Remove the file from the index or use an appropriate external asset store." >&2
  echo "   For a reviewed exception only, use ALLOW_LARGE_FILES=1 explicitly." >&2
  exit 1
fi

if [ "$scanned" -gt 0 ]; then
  echo "✅ Large-file check measured $scanned staged file(s)."
fi
exit 0
