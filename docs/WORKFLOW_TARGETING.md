# Workflow Targeting & CI Queue Conservation

This document outlines architecture and best practices for preventing self-hosted runner starvation and CI queue congestion in multi-agent repositories.

---

## 1. The Problem: CI Queue Starvation

In repositories where autonomous agents produce multiple PRs and frequent commits:
1. **Runner Backlogs**: If broad integration workflows run on every commit or push, runner backlogs quickly grow to 100+ or 200+ queued jobs.
2. **Untargeted Edits**: Minor documentation, markdown, or config edits trigger heavy 25-minute test suites across unrelated systems.
3. **Merge Queue Blockage**: The merge queue must wait behind hours of queued, non-critical runs to execute required checks.

---

## 2. Targeting Strategies

### Strategy A: Subsystem Path Scoping (`paths:`)

Subsystem-specific workflows (such as rendering engines, asset pipelines, UI component tests) MUST include `paths:` declarations so they only run when their relevant directory is touched:

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'src/ui/**'
      - 'packages/client/**'
```

### Strategy B: Base-Branch Push Filtering (`paths-ignore:`)

Push triggers on `$BASE_BRANCH` (which run whenever any PR lands or administrative commits occur) should ignore non-code and documentation updates:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**.md'
      - '.ai/**'
      - 'data/repository_branch_retirements.json'
      - '.githooks/**'
      - 'lefthook.yml'
      - '.gitignore'
```

### Strategy C: Fast-Path Evaluation for Required Checks

When GitHub Classic Branch Protection mandates a specific required check (e.g. `Canonical integration / integrity`), setting `paths-ignore:` on the entire workflow causes branch protection to hang indefinitely because no status check is reported.

Instead, the workflow should run a **fast-path change evaluator**:
1. Check changed files against the base tip (`git diff --name-only origin/$BASE_REF...HEAD`).
2. If all changed files are non-functional (documentation, markdown, metadata, git hooks), exit immediately with success.
3. If functional source code was modified, proceed with the full test suite.

This turns a 25-minute queue-hogging job into a 3-second green check.

For local-first verification, have the pre-push hook and canonical CI call the
same repository script. Keep the local gate conservative: run it for code,
hooks, workflows, templates, and tests; skip only when the outgoing change is
verified to be docs-only. If the comparison base is unavailable, run the full
local gate instead of silently skipping it.

When workflows exist, `scripts/pre-pr-checks.sh` also runs the pinned
actionlint `v1.7.12` and zizmor `1.29.0` checks. Install the exact versions to
enable both locally:

```bash
go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
uv tool install --from zizmor==1.29.0 zizmor
bash scripts/pre-pr-checks.sh
```

The gate can use Go to run actionlint and `uvx` to run zizmor if those tools
are not installed directly. If a local tool and its supported runner are both
unavailable, it reports a clear skip; canonical CI requires both tools. zizmor
runs offline after installation, so the static checks need no paid service.

Self-hosted runner labels select a machine but do not prove that it is isolated
or cleaned after a job. Treat pull-request code as untrusted and verify the
worker lifecycle, credentials, network access, and teardown independently.

### Strategy D: Immediate PR Cancellation (`cancel-in-progress`)

When an agent pushes iterative commits to an active PR, older builds for superseded commit SHAs should be cancelled immediately:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```
