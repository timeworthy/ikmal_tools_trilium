# FleetDev Git hooks

FleetDev keeps quick safety checks close to the commit and runs the broader
verification gate before code is pushed. The same local `make pre-pr` target is
also used by canonical CI for functional changes.

## Hooks

- `pre-commit` scans the exact staged Git objects for credentials and files over
  5 MiB. It handles filenames containing spaces or newlines and does not skip a
  file just because its path contains words like `test` or `example`.
- `commit-msg` enforces Conventional Commit messages.
- `pre-push` blocks direct pushes to protected branches. In the FleetDev repo it
  also runs `make pre-pr` when the outgoing commits contain code, hook, workflow,
  template, or test changes. Docs-only pushes skip that local gate. If the base
  ref is unavailable, it runs the full gate rather than assuming the push is safe.
- `post-commit` rebuilds FleetDev's local binary when Go is available. A build
  failure does not undo the commit; it tells you to run `make rebuild`.
- `post-merge` reports dependency lockfile drift.

There is no automatic push after commit. Use `make pr-send` when you want the
explicit push-and-rebuild workflow; feature work should still go through a PR.

## Install

```bash
bash .githooks/install-hooks.sh
```

The installer prefers Lefthook when it is available, otherwise it configures
Git's native fallback with `core.hooksPath=.githooks`. To select explicitly:

```bash
bash .githooks/install-hooks.sh --native
bash .githooks/install-hooks.sh --lefthook
```

An existing custom `core.hooksPath` is never replaced; the installer stops and
asks you to review it first. The script works in linked worktrees because Git
resolves the worktree's `.git` file itself.

## Local PR gate

Run the full check set before opening a PR:

```bash
make pre-pr
```

The pre-push hook may skip only when it can verify that the outgoing commits
contain no covered functional paths. Set `FLEETDEV_SKIP_LOCAL_PR_GATE=1` only
for an intentional local bypass; canonical CI remains required. To change the
comparison base, set `FLEETDEV_PR_BASE_REF=origin/main` (or the appropriate
remote-tracking ref).

Reviewed emergency exceptions for the staged scanners are explicit:
`ALLOW_SECRET_SCAN_BYPASS=1` or `ALLOW_LARGE_FILES=1`. CI does not honor these
local environment variables.
