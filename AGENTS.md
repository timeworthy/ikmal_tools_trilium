# Repository Agent Working Contract

Task-specific design, queue, ownership, verification, and commit rules remain in
the relevant `docs/` files. This file defines the repository-wide behavior expected
of agents (and human developers) working concurrently and the handoff to `main`.

---

## 1. Before You Start

- Re-read the **live repository state** before beginning or resuming work. Check
  current `main`, relevant open PRs/branches, the applicable roadmap or loop queue,
  and any active-work/ownership notes. Do not rely on an earlier agent's branch
  assumptions when the repository may have moved.
- Read the relevant task-specific docs before editing.
- Confirm the work is safe to claim. Preserve unrelated branches, files, generated
  output, and other agents' active work.
- **Worktree Isolation**: When working across concurrent tasks, prefer using git
  worktrees (`git worktree add ../<repo>-worktree -b <branch>`) to avoid dirtying
  or disturbing active workspaces.

---

## 2. While You Work

- Keep the task **bounded to what it claims**. Do not opportunistically start the
  next roadmap/queue item, redesign adjacent systems, or clean up unrelated code.
- Prefer **shared primitives, contracts, and utilities** over one-off local fixes
  when behavior is conceptually shared across games, renderers, production and
  reference implementations, or other sibling systems.
- Preserve production/reference parity where a prototype, harness, fixture, or
  reference implementation is intended to model production. If they intentionally
  diverge, document why.
- A passing build or harness is evidence, not proof that the product is correct or
  release-ready. For visual, interaction, animation, layout, or rendering changes,
  inspect representative real UI/screenshots at the relevant desktop/mobile states.
  If it looks wrong, numerical green checks do not overrule the visual failure.
- Verify narrowly first, then broadly: run the focused harness for the change, then
  the surrounding regression family that protects the system. Rebuild and verify
  generated artifacts whenever their source changes.
- Do not silently weaken existing tests merely to make a new implementation pass.
  If an old assertion encodes behavior that is intentionally changing, preserve the
  underlying invariant and update the test/documentation explicitly.
- Do not claim to "supersede" earlier PRs or branches without porting and verifying
  their changes. If a PR replaces an earlier PR, every intended feature, UI shell,
  and passing harness from the predecessor must be preserved and verified in the
  successor before closing the predecessor. Never drop earlier work as "deferred"
  when closing an earlier agent's PR unless explicitly requested by the user.
- Do not close an older PR as "superseded" merely because a newer branch exists.
  First account for its unique intended behavior, preserve or explicitly decline
  that behavior, verify the clean successor, and only retire the older PR after the
  successor has actually merged. Preserve provenance in the PR discussion and record
  the retired branch's final head SHA before deleting the remote branch.

---

## 3. Git Hooks & Repository Hygiene

This repository enforces automated quality and safety guardrails via **Lefthook**
(with pure git `.githooks/` fallback). All agents and developers must respect these:

### A. Pre-Commit Secret Scanning & Hygiene
- Every commit automatically scans staged changes for leaked API keys (OpenAI,
  GitHub PATs, AWS, Slack, etc.) and private keys (`.pem`, `.key`, `id_rsa`).
- High-risk credential files (like `.env`, `.env.local`) are strictly blocked.
- Large binary files (>5MB) are blocked from git history.
- **Emergency override**: If a legitimate mock credential in a test needs to pass:
  `ALLOW_SECRET_SCAN_BYPASS=1 git commit -m "..."`

### B. Commit Messages: Conventional Commits
- Commit messages MUST adhere to the Conventional Commits specification:
  `<type>(<optional-scope>): <description>`
- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`
- Examples:
  - `feat(queue): add autonomous reactive merge train`
  - `fix(guardrails): handle restricted token permissions gracefully`
- **Emergency override**: `ALLOW_RAW_COMMIT=1 git commit -m "..."`

### C. Pre-Push Protected Branch Guard
- Direct `git push origin main` or `git push origin dev` is blocked.
- All code must enter `main` through a Pull Request.
- **Emergency override**: `ALLOW_DIRECT_PUSH=1 git push origin main` (recovery only).

### D. Post-Merge Dependency Drift
- After `git pull` or `git merge`, the post-merge hook detects changes to
  `package-lock.json`, `flake.lock`, `requirements.txt`, etc., and alerts you
  to refresh dependencies.

### E. Remote Branch Retirement & Dead Branch Hygiene
- Retire remote feature branches after their PR merges. A branch for a closed,
  unmerged PR may likewise be deleted once that PR is fully dispositioned and any
  required successor has merged.
- Before deleting either kind of branch, verify that no open PR uses it as a head
  or base and no active-work record still depends on it.
- The PR, discussion, final head SHA, merge/supersession record, and landed commits
  are the normal provenance record; a remote branch is not archival storage. Keep a
  branch only when it is still active, is a required base for an open stack, is a
  long-lived repository branch such as `main`/`dev`, or has an explicit documented
  forensic/archival reason to remain.
- Closed-unmerged/superseded branches require a SHA-pinned entry in the repository
  ledger (`data/repository_branch_retirements.json`) plus verification that all declared
  successor PRs have merged before the branch ref is retired.
- Branch retirement runs safely and automatically via `.github/workflows/branch-retirement.yml`
  from trusted `main` following merge queue completion or base pushes. Manual inspection
  runs in dry-run mode by default (`node scripts/retire-stale-branches.mjs`).

---

## 4. PR Dependencies & Autonomous Merge Queue

- A feature agent owns implementation and verification. The integration queue owns
  base freshness, required checks, and the final merge.
- Open a same-repository, **non-draft** PR targeting `main` when the bounded work is
  ready for review/integration.
- Do **not** repeatedly rebase merely because unrelated work lands on `main`.

### PR Chaining (`Depends-On: #<PR>`)
- If a PR builds on or depends on another unmerged PR, declare it in the PR description:
  ```markdown
  Depends-On: #190, #191
  ```
- The queue will automatically block dependent PRs until their prerequisites merge,
  preventing out-of-order squashing and accidental regressions.

### Merging via `merge-ready`
- Once your branch verification is green and diff is clean, add the `merge-ready` label.
- **Stop pushing commits once `merge-ready` is applied.**
- The queue will:
  1. Acquire the single serialized integration slot.
  2. Sync latest `main` into the PR branch.
  3. Run integration verification.
  4. Verify exact-head freshness against `main`.
  5. Squash-merge into `main`.
  6. Trigger downstream PRs waiting on this PR.

### Queue Failure & Triage (`merge-blocked`)
- If the queue fails or detects unmerged dependencies, it applies `merge-blocked`
  and posts a comment with pinpoint diagnostics.
- The automated **PR Failure Triage** system also posts sticky diagnostic comments
  extracting exact failed steps, exit codes, and log snippets.
- When an agent sees `merge-blocked` or a triage comment:
  1. Read the sticky comment and diagnostic logs.
  2. Remove `merge-ready`.
  3. Fix and verify the branch locally.
  4. Re-add `merge-ready` to re-enter at the back of the queue.

Full queue behavior and recovery instructions:
[`docs/AGENT_MERGE_QUEUE.md`](docs/AGENT_MERGE_QUEUE.md).

---

## 5. Workflow Targeting & CI Queue Hygiene

Shared self-hosted runners and free-tier Action minutes are finite resources. Untargeted
workflows that trigger broadly on every commit cause massive backlog queues and block
merges:

1. **Targeted Workflow Scoping**:
   - Subsystem-specific workflows (renderers, asset builders, UI packages, docs) MUST
     define specific `paths:` filters. Do not trigger full test suites across unrelated
     subsystems for localized edits.
2. **Base Branch Push Filtering**:
   - Workflows triggered on pushes to `main` MUST use `paths-ignore:` for
     documentation, markdown files, AI configurations, and metadata:
     ```yaml
     paths-ignore:
       - 'docs/**'
       - '**.md'
       - '.ai/**'
       - 'data/repository_branch_retirements.json'
       - '.githooks/**'
       - 'lefthook.yml'
       - '.gitignore'
     ```
3. **Fast-Path Required Checks**:
   - When branch protection mandates a monolithic check (e.g. `Canonical integration / integrity`),
     the workflow MUST implement targeted change evaluation (`fast-path`). If a PR touches only
     documentation, markdown, or non-functional metadata, the check immediately passes in seconds,
     preserving runner capacity for code integration.
4. **Obsolete Run Cancellation**:
   - All PR-triggered workflows MUST configure concurrency with `cancel-in-progress: true`:
     ```yaml
     concurrency:
       group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
       cancel-in-progress: ${{ github.event_name == 'pull_request' }}
     ```
   - When pushing multiple commits in rapid succession, obsolete intermediate builds are
     terminated immediately, preventing queue buildup.
