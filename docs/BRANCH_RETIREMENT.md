# Automated & Enforceable Branch Retirement

This document specifies the remote branch retirement and dead-branch cleanup architecture for repositories using the FleetDev git guardrails framework.

---

## 1. The Problem

In high-velocity multi-agent environments:
1. **Dead Branch Accumulation**: Feature branches remain on the remote indefinitely after their PRs are merged or closed, cluttering the namespace and obscuring which work is active.
2. **Premature Deletion Risks**: Naive deletion scripts can accidentally delete open pull request branches, bases of stacked pull requests, or active-work branches.
3. **Loss of Provenance**: Overly aggressive cleanup without commit/SHA records risks losing context for superseded or closed-unmerged experiments.

---

## 2. Invariants & Safety Contract

The branch retirement classifier (`scripts/branch-retirement-core.mjs`) enforces five strict safety invariants:

| Category | Invariant | Action |
| :--- | :--- | :--- |
| **Long-Lived** | Base branch or release lines (`main`, `master`, `dev`, `release/*`) | **HOLD** |
| **Open PR Heads** | Head of any currently open PR | **HOLD** |
| **Open Stack Bases** | Base branch of any currently open PR (prevents severing stacked chains) | **HOLD** |
| **Active-Work** | Branches with active work markers or unclosed review | **HOLD** |
| **Audit Ledger** | Branches marked retired in `repository_branch_retirements.json` matching exact SHA | **RETIRE** |
| **Merged PR Heads** | Head branch of an already merged PR (with no downstream dependencies) | **RETIRE** |

If a branch does not meet the exact merged head condition and has no verified entry in the ledger, it is **held**.

---

## 3. Audited Ledger (`data/repository_branch_retirements.json`)

To prevent accidental data loss for non-merged branches that are explicitly retired (e.g. superseded or cancelled work), repositories maintain an audited ledger:

```json
{
  "expectedHeadSha": "7ba6c48d9d07878ef21c4bb3da4cc7b451afd5ce",
  "sourcePr": 199,
  "successorPrs": [259, 267],
  "reason": "PR #199 superseded by verified merged successors #259 and #267."
}
```

- If `successorPrs` are still open, the retirement engine **holds** the branch until they land.
- If `expectedHeadSha` does not match the live branch tip, the engine **holds** the branch.

---

## 4. Execution Model & CI Workflow

Branch retirement is orchestrated by `.github/workflows/branch-retirement.yml`:

- **Pull Request Trigger**: Evaluates `branch-retirement-harness.mjs` with read-only permissions when retirement files change.
- **Workflow Run Trigger**: Automatically triggers following completion of `Agent merge queue`.
- **Push Trigger**: Runs from trusted `main` after commits land.
- **Manual Dispatch**: Provides a dry-run report by default; pass `apply: true` to execute deletions.

### Local Inspection & CLI Usage

Run a local dry-run audit:
```bash
fleetdev branch-retire
# Or: fleetdev branch-retire
# Or directly:
GITHUB_TOKEN=$GITHUB_TOKEN GITHUB_REPOSITORY=owner/repo node scripts/retire-stale-branches.mjs
```

Apply deletions locally:
```bash
BRANCH_RETIRE_APPLY=1 GITHUB_TOKEN=$GITHUB_TOKEN GITHUB_REPOSITORY=owner/repo node scripts/retire-stale-branches.mjs
```
