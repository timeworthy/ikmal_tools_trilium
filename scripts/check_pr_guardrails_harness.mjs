#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkPrGuardrails } from './check_pr_guardrails.mjs';

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'fleetdev-pr-guardrails-'));
try {
  const summaryPath = path.join(tempRoot, 'summary.md');
  const logs = [];
  const errors = [];
  let commentWrites = 0;
  const baseEnv = {
    GITHUB_TOKEN: 'read-only-test-token',
    GITHUB_REPOSITORY: 'fleetdev/example',
    PR_NUMBER: '44',
    GITHUB_STEP_SUMMARY: summaryPath,
  };
  const makeAPI = ({ blockedDependency = false } = {}) => ({
    async getPull(number) {
      if (number === 44) {
        return {
          number,
          body: 'Depends-On: #43',
          base: { ref: 'main', sha: 'base-sha' },
          head: { sha: 'head-sha' },
        };
      }
      return blockedDependency ? { number, merged: false, state: 'open' } : { number, merged: true, state: 'closed' };
    },
    async getBaseRef() { return { object: { sha: 'base-sha' } }; },
    async compare() { return { status: 'behind', ahead_by: 0, behind_by: 1 }; },
    async comment() { commentWrites += 1; },
  });

  await writeFile(summaryPath, '');
  const ok = await checkPrGuardrails(baseEnv, {
    log: message => logs.push(message),
    errorLog: message => errors.push(message),
    apiFactory: () => makeAPI(),
  });
  assert.equal(ok.ok, true);
  assert.match(await readFile(summaryPath, 'utf8'), /PR branch freshness/);

  await writeFile(summaryPath, '');
  await assert.rejects(() => checkPrGuardrails(baseEnv, {
    log: message => logs.push(message),
    errorLog: message => errors.push(message),
    apiFactory: () => makeAPI({ blockedDependency: true }),
  }), /PR Dependency Check Failed/);
  const summary = await readFile(summaryPath, 'utf8');
  assert.match(summary, /PR dependencies need attention/);
  assert.match(summary, /PR #43/);
  assert.equal(errors.some(message => message.includes('Dependency Check Failed')), true);
  assert.equal(commentWrites, 0, 'the read-only PR check must not attempt to write a PR comment');
  console.log('PR guardrails acceptance: dependency failures are actionable in logs and job summary with no comment-write API.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
