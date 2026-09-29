# Agent merge queue

This repository uses an Enterprise-free merge queue driven by GitHub Actions concurrency.
It serializes PR integration against `main` and guarantees exact-head freshness.

## Key Invariants
1. **FIFO Queue**: PRs process in the order `merge-ready` is applied.
2. **PR Chaining**: `Depends-On: #<PR>` blocks dependent PRs until prerequisites merge.
3. **Automated Base Sync**: The queue updates the PR branch with latest `main` before testing.
4. **Pre-Merge Strict Freshness**: Compares `headSha` with live base before merge; fails if not `ahead`.
