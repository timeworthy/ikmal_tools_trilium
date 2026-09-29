#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  QUEUE_DEFAULTS,
  QueueBlocked,
  classifyRequiredChecks,
  isTransientRequiredCheckExpected,
  latestCheckIds,
  needsBaseUpdate,
  parsePullDependencies,
  processPullRequest,
  validatePullDependencies,
  validatePullRequest,
} from './agent_merge_queue.mjs';
import { triggerMergeTrain } from './merge_train_trigger.mjs';

function pr(overrides = {}) {
  return {
    number: 42,
    state: 'open',
    draft: false,
    title: 'Focused agent change',
    labels: [{ name: 'merge-ready' }],
    base: { ref: 'main' },
    head: { ref: 'agent/focused-change', sha: 'head-1', repo: { full_name: 'iansherr/fleetdev' } },
    ...overrides,
  };
}

function check(name, status = 'completed', conclusion = 'success', id = 1) {
  return { id, name, status, conclusion };
}

async function testPureContracts() {
  assert.equal(needsBaseUpdate('diverged'), true);
  assert.equal(needsBaseUpdate('behind'), true);
  assert.equal(needsBaseUpdate('ahead'), false);
  const transient = new Error('PUT /pulls/42/merge returned 405: Required status check \"Canonical integration / integrity\" is expected.');
  transient.status = 405;
  assert.equal(isTransientRequiredCheckExpected(transient), true);
  const permanent = new Error('PUT /pulls/42/merge returned 405: Pull Request is not mergeable');
  permanent.status = 405;
  assert.equal(isTransientRequiredCheckExpected(permanent), false);
  assert.equal(validatePullRequest(pr(), { repository: 'iansherr/fleetdev' }), null);
  assert.match(validatePullRequest(pr({ draft: true }), { repository: 'iansherr/fleetdev' }), /draft/);
  assert.match(validatePullRequest(pr({ head: { ref: 'x', sha: 'h', repo: { full_name: 'fork/repo' } } }), { repository: 'iansherr/fleetdev' }), /same-repository/);

  assert.deepEqual(parsePullDependencies(''), []);
  assert.deepEqual(parsePullDependencies('Depends-On: #190'), [190]);
  assert.deepEqual(parsePullDependencies('Depends-On: #190, #191'), [190, 191]);
  assert.deepEqual(parsePullDependencies('- Depends-on: https://github.com/iansherr/fleetdev/pull/192'), [192]);
  assert.deepEqual(parsePullDependencies('Depends-On: #100\n* Depends-On: #101'), [100, 101]);
  assert.deepEqual(parsePullDependencies('Depends-On: None'), []);
  assert.deepEqual(parsePullDependencies('Some description without dependencies'), []);

  const mockDepApi = {
    getPull: async (num) => {
      if (num === 10) return { number: 10, merged: true, state: 'closed' };
      if (num === 20) return { number: 20, merged: false, state: 'open' };
      if (num === 30) return { number: 30, merged: false, state: 'closed' };
      const err = new Error('Not Found');
      err.status = 404;
      throw err;
    },
  };
  assert.equal(await validatePullDependencies(mockDepApi, 42, 'Depends-On: #10'), null);
  assert.equal(await validatePullDependencies(mockDepApi, 42, 'Depends-On: #42'), 'PR #42 cannot depend on itself.');
  assert.match(await validatePullDependencies(mockDepApi, 42, 'Depends-On: #20'), /not yet merged/);
  assert.match(await validatePullDependencies(mockDepApi, 42, 'Depends-On: #30'), /closed without being merged/);
  assert.match(await validatePullDependencies(mockDepApi, 42, 'Depends-On: #999'), /could not be retrieved/);

  const good = classifyRequiredChecks([check('Canonical integration / integrity')], ['Canonical integration / integrity']);
  assert.equal(good.complete, true);
  const bad = classifyRequiredChecks([check('Canonical integration / integrity', 'completed', 'failure')], ['Canonical integration / integrity']);
  assert.equal(bad.failed.length, 1);
  const missing = classifyRequiredChecks([], ['Canonical integration / integrity']);
  assert.deepEqual(missing.missing, ['Canonical integration / integrity']);
  const oldAndFresh = [
    check('Canonical integration / integrity', 'completed', 'success', 10),
    check('Canonical integration / integrity', 'completed', 'success', 12),
  ];
  assert.deepEqual(latestCheckIds(oldAndFresh, ['Canonical integration / integrity']), { 'Canonical integration / integrity': 12 });
  assert.equal(classifyRequiredChecks(oldAndFresh, ['Canonical integration / integrity'], { 'Canonical integration / integrity': 10 }).complete, true);
}

class FakeApi {
  constructor(scenario) {
    this.repository = 'iansherr/fleetdev';
    this.scenario = scenario;
    this.baseSha = 'base-1';
    this.headSha = scenario.initialHead || 'head-1';
    this.updateCount = 0;
    this.checkCount = 0;
    this.mergeCalls = [];
    this.mergeAttempts = 0;
    this.transientMergeRejectsLeft = scenario.transientMergeRejects || 0;
    this.dispatchCount = 0;
    this.approvalCalls = [];
    this.refreshCanonicalApproved = false;
    this.lastCheckId = 0;
    this.labels = new Set(['merge-ready']);
  }
  async getPull(number = 42) {
    if (this.scenario.pullRequests && this.scenario.pullRequests[number]) {
      return this.scenario.pullRequests[number];
    }
    return pr({
      number,
      body: this.scenario.body || '',
      labels: [...this.labels].map(name => ({ name })),
      head: { ref: 'agent/focused-change', sha: this.headSha, repo: { full_name: this.repository } },
    });
  }
  async getBaseRef() { return { object: { sha: this.baseSha } }; }
  async compare() {
    if (this.scenario.alwaysAhead) return { status: 'ahead' };
    if (this.scenario.mainMoves && this.baseSha === 'base-2' && this.updateCount < 2) return { status: 'diverged' };
    return { status: this.updateCount ? 'ahead' : 'diverged' };
  }
  async updateBranch() {
    this.updateCount += 1;
    this.headSha = `head-updated-${this.updateCount}`;
    this.refreshCanonicalApproved = false;
    return { message: 'Updating pull request branch.' };
  }
  async getCheckRuns() {
    this.checkCount += 1;
    if (!this.dispatchCount) return { check_runs: [check('Canonical integration / integrity', 'completed', 'success', 10)] };
    if (this.scenario.mainMoves && this.dispatchCount === 1) this.baseSha = 'base-2';
    this.lastCheckId = 10 + this.dispatchCount;
    if (this.scenario.failChecks) {
      return { check_runs: [check('Canonical integration / integrity', 'completed', 'failure', this.lastCheckId)] };
    }
    return { check_runs: [check('Canonical integration / integrity', 'completed', 'success', this.lastCheckId)] };
  }
  async getPullRequestWorkflowRuns() {
    if (!this.updateCount) return { workflow_runs: [] };
    return { workflow_runs: [{
      id: 100 + this.updateCount,
      path: '.github/workflows/canonical-integration.yml',
      head_sha: this.headSha,
      event: 'pull_request',
      status: 'completed',
      conclusion: this.refreshCanonicalApproved ? 'success' : 'action_required',
    }] };
  }
  async approveWorkflowRun(runId) {
    if (this.scenario.approvalFails) {
      const error = new Error('POST approve returned 403: Resource not accessible by integration');
      error.status = 403;
      throw error;
    }
    this.approvalCalls.push(runId);
    this.refreshCanonicalApproved = true;
    return {};
  }
  async dispatchWorkflow() { this.dispatchCount += 1; return { workflow_run_id: this.dispatchCount }; }
  async mergePull(_number, payload) {
    this.mergeAttempts += 1;
    if (this.transientMergeRejectsLeft > 0) {
      this.transientMergeRejectsLeft -= 1;
      const error = new Error('PUT /pulls/42/merge returned 405: Required status check \"Canonical integration / integrity\" is expected.');
      error.status = 405;
      throw error;
    }
    if (this.scenario.permanentMergeReject) {
      const error = new Error('PUT /pulls/42/merge returned 405: Pull Request is not mergeable');
      error.status = 405;
      throw error;
    }
    this.mergeCalls.push(payload);
    return { merged: true, sha: `merge-${this.mergeCalls.length}`, message: 'Pull Request successfully merged' };
  }
  async addLabels(_number, labels) { labels.forEach(label => this.labels.add(label)); }
  async removeLabel(_number, label) { this.labels.delete(label); }
}

async function testIntegrationContracts() {
  const config = { ...QUEUE_DEFAULTS, pollMs: 0, checkTimeoutMs: 50, updateTimeoutMs: 50, maxRefreshes: 4 };
  const sleep = async () => {};
  const log = () => {};

  const stale = new FakeApi({});
  const staleResult = await processPullRequest({ api: stale, prNumber: 42, config, sleep, log });
  assert.equal(stale.updateCount, 1, 'stale PR should be updated exactly once');
  assert.equal(stale.approvalCalls.length, 1, 'queue refresh should approve its canonical pull_request run');
  assert.equal(stale.dispatchCount, 1);
  assert.equal(stale.mergeCalls.length, 1);
  assert.equal(staleResult.merged, true);

  const movingMain = new FakeApi({ mainMoves: true });
  const movingResult = await processPullRequest({ api: movingMain, prNumber: 42, config, sleep, log });
  assert.equal(movingMain.updateCount, 2, 'main movement should force a second integration refresh');
  assert.equal(movingMain.approvalCalls.length, 2, 'each queue-owned refresh should approve its new canonical pull_request run');
  assert.equal(movingMain.dispatchCount, 2);
  assert.equal(movingMain.mergeCalls.length, 1);
  assert.equal(movingResult.refreshes, 2);

  const approvalFailure = new FakeApi({ approvalFails: true });
  await assert.rejects(
    () => processPullRequest({ api: approvalFailure, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /Could not approve refresh-created canonical run/.test(error.message),
  );
  assert.equal(approvalFailure.dispatchCount, 0, 'queue must not dispatch final CI when refresh-created canonical approval failed');
  assert.equal(approvalFailure.mergeCalls.length, 0);

  const failing = new FakeApi({ alwaysAhead: true, failChecks: true });
  await assert.rejects(
    () => processPullRequest({ api: failing, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /Required check failed/.test(error.message),
  );
  assert.equal(failing.mergeCalls.length, 0);

  const settling = new FakeApi({ alwaysAhead: true, transientMergeRejects: 2 });
  const settlingResult = await processPullRequest({ api: settling, prNumber: 42, config, sleep, log });
  assert.equal(settlingResult.merged, true);
  assert.equal(settling.mergeAttempts, 3, 'transient required-check propagation should retry the merge');
  assert.equal(settling.mergeCalls.length, 1);

  const permanentMergeReject = new FakeApi({ alwaysAhead: true, permanentMergeReject: true });
  await assert.rejects(
    () => processPullRequest({ api: permanentMergeReject, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /GitHub rejected the merge/.test(error.message),
  );
  assert.equal(permanentMergeReject.mergeAttempts, 1, 'non-transient merge rejection must not be retried');
  assert.equal(permanentMergeReject.mergeCalls.length, 0);

  const changed = new FakeApi({ alwaysAhead: true, externalHeadChange: true });
  // First check is completed immediately, so force one pending read before the external change.
  changed.getCheckRuns = async function getCheckRuns() {
    this.checkCount += 1;
    if (!this.dispatchCount) return { check_runs: [check('Canonical integration / integrity', 'completed', 'success', 10)] };
    if (this.checkCount === 2) return { check_runs: [check('Canonical integration / integrity', 'in_progress', null, 11)] };
    this.headSha = 'head-external';
    return { check_runs: [check('Canonical integration / integrity', 'completed', 'success', 11)] };
  };
  await assert.rejects(
    () => processPullRequest({ api: changed, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /changed (from|after)/.test(error.message),
  );
  assert.equal(changed.mergeCalls.length, 0);

  const unmergedDep = new FakeApi({
    alwaysAhead: true,
    body: 'Depends-On: #99',
    pullRequests: {
      99: { number: 99, state: 'open', merged: false },
    },
  });
  await assert.rejects(
    () => processPullRequest({ api: unmergedDep, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /depends on PR #99, which is not yet merged/.test(error.message),
  );
  assert.equal(unmergedDep.mergeCalls.length, 0);
  assert.equal(unmergedDep.labels.has('merge-running'), false, 'blocked PR should never be marked running');

  const mergedDep = new FakeApi({
    alwaysAhead: true,
    body: 'Depends-On: #99',
    pullRequests: {
      99: { number: 99, state: 'closed', merged: true },
    },
  });
  const mergedDepResult = await processPullRequest({ api: mergedDep, prNumber: 42, config, sleep, log });
  assert.equal(mergedDepResult.merged, true);
  assert.equal(mergedDep.mergeCalls.length, 1);

  const nonFreshPreMerge = new FakeApi({ alwaysAhead: true });
  let compareCall = 0;
  nonFreshPreMerge.compare = async function compare() {
    compareCall += 1;
    if (compareCall === 2) return { status: 'identical' };
    return { status: 'ahead' };
  };
  await assert.rejects(
    () => processPullRequest({ api: nonFreshPreMerge, prNumber: 42, config, sleep, log }),
    error => error instanceof QueueBlocked && /freshness comparison against main/.test(error.message),
  );
  assert.equal(nonFreshPreMerge.mergeCalls.length, 0);
}

async function testWorkflowSecurityContract() {
  const workflow = await readFile(new URL('../.github/workflows/agent-merge-queue.yml', import.meta.url), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /group:\s*fleetdev-agent-merge-queue-main/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /ref:\s*main/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /actions:\s*write/);
  assert.match(workflow, /node scripts\/agent_merge_queue\.mjs/);
  assert.doesNotMatch(workflow, /checkout[^\n]*pull_request\.head|ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
}

async function testMergeTrainContract() {
  const pulls = [
    {
      number: 101,
      body: 'Depends-On: #100',
      labels: [{ name: 'merge-blocked' }],
    },
    {
      number: 102,
      body: 'Depends-On: #100',
      labels: [],
    },
  ];

  const addedLabels = [];
  const removedLabels = [];
  const comments = [];

  const mockApi = {
    repository: 'iansherr/fleetdev',
    request: async (method, path) => {
      if (path.startsWith('/pulls?state=open')) {
        return pulls;
      }
      return [];
    },
    getPull: async (num) => {
      if (num === 100) return { number: 100, merged: true, state: 'closed' };
      throw new Error(`PR ${num} not found`);
    },
    addLabels: async (num, labels) => {
      addedLabels.push({ num, labels });
    },
    removeLabel: async (num, label) => {
      removedLabels.push({ num, label });
    },
    comment: async (num, body) => {
      comments.push({ num, body });
    },
  };

  const result = await triggerMergeTrain({ AGENT_QUEUE_BASE_BRANCH: 'main' }, { api: mockApi, log: () => {} });
  assert.equal(result.triggeredCount, 2);
  assert.deepEqual(removedLabels, [{ num: 101, label: 'merge-blocked' }]);
  assert.equal(addedLabels.length, 2);
  assert.deepEqual(addedLabels[0], { num: 101, labels: ['merge-ready'] });
  assert.deepEqual(addedLabels[1], { num: 102, labels: ['merge-ready'] });
  assert.equal(comments.length, 2);
  assert.match(comments[0].body, /Autonomous Merge Train Triggered/);

  const workflow = await readFile(new URL('../.github/workflows/merge-train-trigger.yml', import.meta.url), 'utf8');
  assert.match(workflow, /push:\s*\n\s*branches:\s*\[/);
  assert.match(workflow, /node scripts\/merge_train_trigger\.mjs/);
}

await testPureContracts();
await testIntegrationContracts();
await testWorkflowSecurityContract();
await testMergeTrainContract();
console.log('agent merge queue harness: PASS');
