#!/usr/bin/env node
import assert from 'node:assert/strict';
import { classifyBranches } from './branch-retirement-core.mjs';

const repo = 'example/repo';
const pr = ({ number, state = 'closed', merged_at = null, head, headSha, base = 'main' }) => ({
  number,
  state,
  merged_at,
  head: { ref: head, sha: headSha, repo: { full_name: repo } },
  base: { ref: base, repo: { full_name: repo } },
});
const branch = (name, sha) => ({ name, commit: { sha } });

const decisions = classifyBranches({
  branches: [
    branch('main', 'm'),
    branch('dev', 'd'),
    branch('merged-clean', 'a1'),
    branch('merged-but-moved', 'new'),
    branch('open-head', 'o1'),
    branch('stack-base', 'b1'),
    branch('active-record', 'r1'),
    branch('superseded', 's1'),
    branch('superseded-moved', 's2-new'),
    branch('unknown', 'u1'),
  ],
  pullRequests: [
    pr({ number: 1, merged_at: '2026-09-15T00:00:00Z', head: 'merged-clean', headSha: 'a1' }),
    pr({ number: 2, merged_at: '2026-09-15T00:00:00Z', head: 'merged-but-moved', headSha: 'old' }),
    pr({ number: 3, state: 'open', head: 'open-head', headSha: 'o1' }),
    pr({ number: 4, state: 'open', head: 'open-head-2', headSha: 'o2', base: 'stack-base' }),
    pr({ number: 5, state: 'closed', head: 'superseded', headSha: 's1' }),
    pr({ number: 6, merged_at: '2026-09-15T00:00:00Z', head: 'successor', headSha: 'z1' }),
    pr({ number: 7, state: 'closed', head: 'superseded-moved', headSha: 's2-old' }),
  ],
  ledger: {
    protectedBranches: ['main', 'dev'],
    retirements: [
      { branch: 'superseded', expectedHeadSha: 's1', sourcePr: 5, successorPrs: [6], reason: 'audited successor' },
      { branch: 'superseded-moved', expectedHeadSha: 's2-old', sourcePr: 7, successorPrs: [6], reason: 'should not delete moved ref' },
    ],
  },
  activeWorkText: 'currently working from active-record',
});

const byName = new Map(decisions.map((decision) => [decision.branch, decision]));
assert.equal(byName.get('main').action, 'keep');
assert.equal(byName.get('dev').action, 'keep');
assert.equal(byName.get('merged-clean').action, 'retire');
assert.match(byName.get('merged-clean').reason, /PR #1/);
assert.equal(byName.get('merged-but-moved').action, 'keep');
assert.equal(byName.get('open-head').action, 'keep');
assert.equal(byName.get('stack-base').action, 'keep');
assert.equal(byName.get('active-record').action, 'keep');
assert.equal(byName.get('superseded').action, 'retire');
assert.equal(byName.get('superseded-moved').action, 'keep');
assert.match(byName.get('superseded-moved').reason, /SHA mismatch/);
assert.equal(byName.get('unknown').action, 'keep');

console.log('branch retirement harness: PASS');
