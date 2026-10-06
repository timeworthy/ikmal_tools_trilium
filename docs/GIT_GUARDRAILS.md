# Multi-Agent Git Guardrails, Merge Queue & Branch Management

An enterprise-grade coordination framework for human engineers and autonomous AI coding agents working concurrently on GitHub repositories without requiring GitHub Enterprise ($21+/seat/mo).

---

## The Problem Solved

On GitHub Free and Team plans (especially private repositories):
1. **Repository Merge Queues** and the branch protection rule **"Require branches to be up to date before merging"** are paywalled under GitHub Enterprise.
2. Without them, concurrent agents or developers will:
   - Squash-merge stale branches over recent work without testing the combination.
   - Merge PRs out of order, reverting or clobbering sibling PR changes.
   - Close predecessor PRs prematurely under the false claim of "superseding" them.
   - Leave dozens of dead feature branches on the remote, causing confusion over active lines of work.
   - Trigger heavy 25-minute CI suites across unrelated subsystems for minor documentation or metadata edits.
   - Push directly to protected branches by accident.
   - Accidentally leak API keys, private keys, or credentials into commit history.

This template provides a **100% free, software-defined coordination layer** using standard GitHub Actions concurrency, declarative parallel Git hooks (via Lefthook with pure-git `.githooks/` fallback), automated PR dependency chaining, exact-head serialized integration, smart workflow targeting, and automated safe branch retirement.

---

## Included Components

| Component | Path | Description |
| :--- | :--- | :--- |
| **Merge Queue Dispatcher** | `scripts/agent_merge_queue.mjs` | Serializes PR integration, syncs live base branch, verifies pre-merge freshness, and squash-merges. |
| **Queue Test Harness** | `scripts/agent_merge_queue_harness.mjs` | Fast hermetic unit/integration test suite enforcing queue invariants. |
| **PR Guardrails Check** | `scripts/check_pr_guardrails.mjs` | Validates `Depends-On: #<PR>` declarations and reports branch freshness with actionable feedback. |
| **Branch Retirement Engine** | `scripts/branch-retirement-core.mjs` | Pure classifier enforcing 5 branch retirement safety invariants (protects open PRs, stack bases, active work). |
| **Branch Retirement Harness** | `scripts/branch-retirement-harness.mjs` | Hermetic safety test suite guarding branch retirement classifications. |
| **Branch Retirement Runner** | `scripts/retire-stale-branches.mjs` | Audits remote branches against PRs/ledger and deletes verified dead refs (dry-run by default). |
| **Retirement Ledger** | `data/repository_branch_retirements.json` | SHA-pinned ledger for safely retiring superseded and closed-unmerged branches. |
| **Branch Retirement CI** | `.github/workflows/branch-retirement.yml` | Validates retirement safety on PRs; safely deletes dead branches on trusted `main` or after queue merge. |
| **Canonical Integration CI** | `.github/workflows/canonical-integration.yml` | Primary integration CI with fast-path detection for docs/metadata to preserve runner queues. |
| **Autonomous Merge Train** | `scripts/merge_train_trigger.mjs` | Scans open PRs upon base branch push and auto-queues downstream PRs once dependencies merge. |
| **PR Failure Triage** | `scripts/pr_failure_triage.py` | Automatically analyzes failed Actions runs and posts a clean sticky diagnostic comment on the PR. |
| **Queue Workflow** | `.github/workflows/agent-merge-queue.yml` | Single-slot serialized Actions workflow (`group: fleetdev-agent-merge-queue-main`). |
| **PR Guardrails CI** | `.github/workflows/pr-guardrails.yml` | Runs on pull requests to enforce dependencies with auto-cancellation of obsolete runs. |
| **Merge Train Workflow** | `.github/workflows/merge-train-trigger.yml` | Runs on push to base branch (with doc/metadata path filtering) to trigger downstream merges. |
| **Failure Triage CI** | `.github/workflows/pr-failure-triage.yml` | Runs upon workflow failure to extract logs and post targeted triage diagnostics. |
| **Lefthook Suite** | `lefthook.yml` | Declarative parallel Git hooks with actionable failure guidance (`fail_text`). |
| **Secret Detection Hook** | `.githooks/detect-secrets.sh` | Zero-dependency pre-commit scanner catching API keys (OpenAI, GitHub, AWS, Slack) and private keys. |
| **Large File Hook** | `.githooks/check-large-files.sh` | Prevents accidental staging of binary files >5MB into git history. |
| **Actions Static Checks** | `scripts/check-actions.sh` | Runs pinned actionlint and zizmor checks for workflow syntax and common security hazards. |
| **Conventional Commits Hook** | `.githooks/commit-msg` | Enforces standard `<type>(<scope>): <subject>` format. |
| **Local Pre-PR Gate** | `scripts/pre-pr-checks.sh` | Runs available Go, Node, shell, and built-in guardrails checks before functional pushes. |
| **Branch Protection Hook** | `.githooks/pre-push` | Rejects protected-branch pushes and runs local checks for functional changes. |
| **Lockfile Drift Hook** | `.githooks/post-merge` | Alerts developers when `package-lock.json`, `flake.lock`, etc. change in merges/pulls. |
| **Action Version Updates** | `.github/dependabot.yml` | Proposes weekly updates for SHA-pinned GitHub Actions. |
| **Working Contract** | `AGENTS.md` | Working rules for bounded tasks, superseded PR preservation, branch retirement, and workflow targeting. |
| **Queue Docs** | `docs/AGENT_MERGE_QUEUE.md` | Lifecycle, failure recovery, and architectural specifications. |
| **Branch Retirement Docs** | `docs/BRANCH_RETIREMENT.md` | Complete branch retirement lifecycle, safety contract, and ledger schema. |
| **Workflow Targeting Docs** | `docs/WORKFLOW_TARGETING.md` | Best practices for path filtering, fast-path evaluation, and runner queue conservation. |

---

## Git Hooks Overview (Lefthook & Native Git)

The repository hooks operate smoothly in both environments:
1. **Lefthook (Recommended)**: Parallel execution, output grouping, and fast execution.
2. **Native Git Fallback**: When Lefthook is not installed, standard `.githooks/` execute natively via `git config core.hooksPath .githooks`.

### Hook Stages & Rules

| Hook Stage | Action | Remediation / Bypass |
| :--- | :--- | :--- |
| `pre-commit` | Scans the exact staged Git objects for credentials, private keys, `.env` files, and binaries over 5 MiB. | `ALLOW_SECRET_SCAN_BYPASS=1` or `ALLOW_LARGE_FILES=1` |
| `commit-msg` | Validates Conventional Commits: `<type>(<scope>): <message>`. | `ALLOW_RAW_COMMIT=1` |
| `pre-push` | Blocks direct pushes to `main`, `master`, or `dev`; runs local checks for functional outgoing commits. | Fix the reported issue and retry; `FLEETDEV_SKIP_LOCAL_PR_GATE=1` is an explicit local-only bypass |
| `post-merge` | Detects lockfile changes (`package-lock.json`, `flake.lock`, `requirements.txt`). | Informational alert to run package manager update |

### Testing Hooks Locally

```bash
# Test pre-commit secret detection
lefthook run pre-commit

# Or test native git script directly
.githooks/detect-secrets.sh

# Test commit-msg validation
echo "feat(test): my valid message" > /tmp/msg && .githooks/commit-msg /tmp/msg

# Run the full local pre-PR gate manually
bash scripts/pre-pr-checks.sh
```

The workflow CI repeats the same repository checks. Documentation-only pushes
skip the local test gate; functional changes to code, hooks, workflows, or
templates do not.

## Safe update and removal

Run `fleetdev guardrails` to add missing guardrails or update unchanged files.
FleetDev uses its ownership manifest to preserve edited and unrecognized files;
an explicit replacement is backed up before it happens. To inspect removal, run
`fleetdev guardrails uninstall --dry-run`. Confirmed removal backs up first and
deletes only files whose contents and permissions still match the manifest.
Edited and untracked files are kept. Older installs without an ownership
manifest are not deleted by guesswork. Use `fleetdev guardrails --replace` to
adopt matching legacy files after backup if you later want FleetDev to remove
those files too.

When GitHub Actions workflows exist, the local gate also runs
`scripts/check-actions.sh`. It uses actionlint `v1.7.12` and zizmor `1.29.0`;
install these exact versions to enable the checks locally:

```bash
go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
uv tool install --from zizmor==1.29.0 zizmor
bash scripts/pre-pr-checks.sh
```

In CI, the canonical workflow requires both pinned tools. Locally, the gate
prints a skip message if a tool and its supported runner are unavailable. The
zizmor invocation is offline after installation, so these checks need no paid
scanner or hosted analysis service.

Self-hosted runner labels select a machine; they do not prove that it is
isolated or cleaned after each job. Treat pull-request code as untrusted and
verify the runner's lifecycle, credentials, network access, and teardown
independently; a runner label is not evidence of a safe isolation boundary.

---

## Branch Retirement & Hygiene

Dead branches clutter repositories and create ambiguity. The system retires branches safely:
- **Exact Merged Heads**: Automatically retired when the live branch matches the merged PR head SHA and is not used as a base for open PRs or referenced in active work.
- **Audited Superseded Branches**: Defined in `data/repository_branch_retirements.json` with SHA-pinning and merged successor verification.
- **Protected Branches**: `main`, `dev`, open PR heads, open PR stack bases, and active work references are strictly held.

Inspect retirement decisions locally:
```bash
fleetdev branch-retire
# Or: fleetdev branch-retire
# Or:
node scripts/retire-stale-branches.mjs
```

---

## Workflow Targeting & Fast-Path

Untargeted workflows cause massive self-hosted runner backlogs (e.g. 200+ queued jobs). This setup employs:
1. **Targeted Subsystem Triggers**: Subsystem CI runs only when its relevant paths change (`paths:`).
2. **Push Path Filters**: Pushes to `main` ignore documentation and metadata (`paths-ignore:`).
3. **Fast-Path Required Checks**: `canonical-integration.yml` checks if a PR is docs/metadata-only. If so, it passes in seconds instead of running 25-minute test suites, satisfying branch protection without congesting runners.
4. **Obsolete Run Cancellation**: PR workflows use `cancel-in-progress: true` to abort superseded builds.

---

## Quick Setup Instructions

### Automated Setup via FleetDev
From your target repository root:
```bash
# Install or safely update FleetDev guardrails:
fleetdev guardrails

# Common Options:
#   --runner "[self-hosted, linux, digitalocean, k8s-runner]"   # For k8s runners (default: k8s-runner)
#   --runner ubuntu-latest                                       # For public/hosted repos
#   --base-branch main                                           # Target base branch
#   --replace                                                    # Replace matching files after backup
#   --add-only                                                   # Add missing files; keep all existing files
#   --force                                                      # Compatibility alias for --replace
```

### Safe updates and older installations

FleetDev records installed file fingerprints in
`.fleetdev/guardrails-manifest.json`. Later runs add new files and update files
that still match FleetDev's last installed version. Locally edited files,
unrecognized files, and files you removed are preserved and reported.

An older install without a manifest is detected by its guardrail files. The
default is add-only for conflicts: nothing existing is replaced. In a terminal,
choose safe update, add-only, or replace. `--replace` is an explicit
confirmation for scripted use. Before an update run that encounters existing
guardrail files, FleetDev saves a backup under
`~/.config/fleetdev/backups/guardrails/` (or your configured FleetDev config
directory) and prints the exact path. Preserved conflicts also include proposed
new versions under `proposed/`, so you can compare them with `current/`. FleetDev
never deletes unrecognized files or files that you removed yourself.

### Option B: Manual File Copy
```bash
cp -R templates/git-guardrails/.github .
cp -R templates/git-guardrails/.githooks .
cp -R templates/git-guardrails/scripts .
cp -R templates/git-guardrails/docs .
cp -R templates/git-guardrails/data .
cp templates/git-guardrails/AGENTS.md .
cp templates/git-guardrails/lefthook.yml .

# Make hooks and scripts executable
chmod +x .githooks/* scripts/*.mjs scripts/*.py

# Install hooks without replacing a custom core.hooksPath:
bash .githooks/install-hooks.sh

# Verify harnesses pass:
node scripts/agent_merge_queue_harness.mjs
node scripts/branch-retirement-harness.mjs
```

---

## GitHub Branch Protection Setup ($0 Cost)

In your GitHub repository settings (**Settings -> Branches -> Add Classic Branch Protection rule** for `main`):
1. Check **"Require a pull request before merging"**.
2. Check **"Require status checks to pass before merging"**.
3. Under Required checks, search for and check:
   - `PR Dependencies & Freshness Check` (from `pr-guardrails.yml`).
   - `Canonical integration / integrity` (from `canonical-integration.yml`).
4. **Leave "Require branches to be up to date before merging" UNCHECKED**:
   - The queue software programmatically compares `newestBase` and `headSha` right before merge and verifies `status === 'ahead'`.
   - Feature agents are freed from having to rebase manually every time unrelated PRs land on `main`.

---

## How PR Chaining Works (`Depends-On:`)

When a feature branch logically builds upon another unmerged pull request, declare the dependency in the PR body:

```markdown
### Summary of changes
Depends-On: #190, #191

- Adds UI components dependent on the diorama shell in #190.
```

1. **CI Enforcement**: `pr-guardrails.yml` parses the header and marks the status check ❌ failing if prerequisite PRs are still open or closed without merging.
2. **Queue Enforcement**: If labeled `merge-ready` prematurely, the queue fast-fails the PR with `merge-blocked` and posts an explanatory comment, immediately releasing the integration slot so prerequisite PRs can proceed without deadlock.
3. **Autonomous Merge Train**: When the prerequisite PR merges into `main`, `merge-train-trigger.yml` detects dependent PRs and queues them automatically.

---

## Recovery & Emergency Bypass Cheatsheet

| Scenario | Command |
| :--- | :--- |
| Valid test secret blocked by pre-commit | `ALLOW_SECRET_SCAN_BYPASS=1 git commit -m "..."` |
| Valid large file (>5MB) blocked by pre-commit | `ALLOW_LARGE_FILES=1 git commit -m "..."` |
| Raw commit message needed (e.g. cherry-pick) | `ALLOW_RAW_COMMIT=1 git commit -m "..."` |
| Direct emergency push to main needed | `ALLOW_DIRECT_PUSH=1 git push origin main` |
| Dry-run audit of dead branches | `fleetdev branch-retire` |
| Bypass all Lefthook hooks temporarily | `LEFTHOOK=0 git commit -m "..."` |
| Re-enable Lefthook hooks | `lefthook install` |
| Switch back to native git hooks | `git config core.hooksPath .githooks` |
