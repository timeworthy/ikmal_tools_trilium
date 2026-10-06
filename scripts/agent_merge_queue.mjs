#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const QUEUE_DEFAULTS = Object.freeze({
  baseBranch: 'main',
  readyLabel: 'merge-ready',
  runningLabel: 'merge-running',
  blockedLabel: 'merge-blocked',
  mergeMethod: 'squash',
  requiredChecks: Object.freeze(['Canonical integration / integrity']),
  pollMs: 5000,
  checkTimeoutMs: 20 * 60 * 1000,
  updateTimeoutMs: 90 * 1000,
  mergeSettleRetries: 12,
  maxRefreshes: 8,
});

const LABELS = Object.freeze({
  'merge-ready': { color: '0E8A16', description: 'Agent work is verified and ready for serialized integration.' },
  'merge-running': { color: '1D76DB', description: 'The repository agent merge queue is integrating this pull request.' },
  'merge-blocked': { color: 'B60205', description: 'The agent merge queue stopped; fix the reported issue before re-queueing.' },
});

export class QueueBlocked extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueBlocked';
  }
}

export class QueueCancelled extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueCancelled';
  }
}

export function hasLabel(pr, name) {
  return Array.isArray(pr?.labels) && pr.labels.some(label => (label?.name ?? label) === name);
}

export function needsBaseUpdate(compareStatus) {
  return compareStatus === 'behind' || compareStatus === 'diverged';
}

export function isTransientRequiredCheckExpected(error) {
  return Number(error?.status) === 405
    && /Required status check .+ is expected/i.test(String(error?.message || ''));
}

export function classifyRequiredChecks(checkRuns, requiredNames, minimumIds = {}) {
  const byName = new Map();
  for (const run of checkRuns || []) {
    if (Number(run.id || 0) <= Number(minimumIds[run.name] || 0)) continue;
    const previous = byName.get(run.name);
    if (!previous || Number(run.id || 0) > Number(previous.id || 0)) byName.set(run.name, run);
  }

  const missing = [];
  const pending = [];
  const failed = [];
  const passed = [];
  for (const name of requiredNames) {
    const run = byName.get(name);
    if (!run) {
      missing.push(name);
      continue;
    }
    if (run.status !== 'completed') {
      pending.push({ name, status: run.status });
      continue;
    }
    if (['success', 'neutral', 'skipped'].includes(run.conclusion)) {
      passed.push(name);
    } else {
      failed.push({ name, conclusion: run.conclusion || 'unknown' });
    }
  }
  return { missing, pending, failed, passed, complete: !missing.length && !pending.length && !failed.length };
}

export function latestCheckIds(checkRuns, requiredNames) {
  const ids = {};
  for (const name of requiredNames) ids[name] = 0;
  for (const run of checkRuns || []) {
    if (!Object.hasOwn(ids, run.name)) continue;
    ids[run.name] = Math.max(ids[run.name], Number(run.id || 0));
  }
  return ids;
}

export function validatePullRequest(pr, {
  repository,
  baseBranch = QUEUE_DEFAULTS.baseBranch,
  readyLabel = QUEUE_DEFAULTS.readyLabel,
} = {}) {
  if (!pr || !Number.isInteger(pr.number)) return 'Pull request payload is missing or invalid.';
  if (pr.state !== 'open') return `PR #${pr.number} is not open.`;
  if (pr.draft) return `PR #${pr.number} is still a draft.`;
  if (pr.base?.ref !== baseBranch) return `PR #${pr.number} targets ${pr.base?.ref || 'an unknown base'}, not ${baseBranch}.`;
  if (repository && pr.head?.repo?.full_name !== repository) {
    return `PR #${pr.number} comes from ${pr.head?.repo?.full_name || 'a fork'}; the queue only updates same-repository agent branches.`;
  }
  if (pr.head?.ref === baseBranch) return `PR #${pr.number} uses ${baseBranch} as its head branch.`;
  if (!hasLabel(pr, readyLabel)) return `PR #${pr.number} no longer has the ${readyLabel} label.`;
  return null;
}

export function parsePullDependencies(body) {
  if (!body || typeof body !== 'string') return [];
  const dependencies = [];
  const lineRegex = /(?:^|\r?\n)\s*(?:[-*]\s*)?Depends-On:\s*([^\r\n]+)/gi;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(body)) !== null) {
    const content = lineMatch[1];
    const numRegex = /(?:#|\/pull\/|\b)(\d+)\b/g;
    let numMatch;
    while ((numMatch = numRegex.exec(content)) !== null) {
      const num = parseInt(numMatch[1], 10);
      if (Number.isInteger(num) && num > 0 && !dependencies.includes(num)) {
        dependencies.push(num);
      }
    }
  }
  return dependencies;
}

export async function validatePullDependencies(api, prNumber, body) {
  const dependencies = parsePullDependencies(body);
  for (const depNumber of dependencies) {
    if (depNumber === prNumber) {
      return `PR #${prNumber} cannot depend on itself.`;
    }
    let depPr;
    try {
      depPr = await api.getPull(depNumber);
    } catch (error) {
      return `PR #${prNumber} specifies dependency on PR #${depNumber}, but PR #${depNumber} could not be retrieved: ${error.message}`;
    }
    if (!depPr?.merged) {
      if (depPr?.state === 'closed') {
        return `PR #${prNumber} depends on PR #${depNumber}, which was closed without being merged.`;
      }
      return `PR #${prNumber} depends on PR #${depNumber}, which is not yet merged (state: ${depPr?.state || 'unknown'}). Re-queue PR #${prNumber} after PR #${depNumber} has landed.`;
    }
  }
  return null;
}

export class GitHubApi {
  constructor({ token, repository, fetchImpl = globalThis.fetch }) {
    if (!token) throw new Error('GITHUB_TOKEN is required.');
    if (!repository?.includes('/')) throw new Error('GITHUB_REPOSITORY must be owner/repo.');
    this.token = token;
    this.repository = repository;
    this.fetchImpl = fetchImpl;
  }

  async request(method, path, { body, ok = [200] } = {}) {
    const url = path.startsWith('http') ? path : `https://api.github.com/repos/${this.repository}${path}`;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'fleetdev-agent-merge-queue',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = { message: text }; }
    }
    if (!ok.includes(response.status)) {
      const detail = payload?.message ? `: ${payload.message}` : '';
      const error = new Error(`${method} ${path} returned ${response.status}${detail}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  getPull(number) { return this.request('GET', `/pulls/${number}`); }
  getBaseRef(branch) { return this.request('GET', `/git/ref/heads/${encodeURIComponent(branch)}`); }
  compare(baseSha, headSha) { return this.request('GET', `/compare/${baseSha}...${headSha}`); }
  updateBranch(number, expectedHeadSha) {
    return this.request('PUT', `/pulls/${number}/update-branch`, {
      body: { expected_head_sha: expectedHeadSha }, ok: [202],
    });
  }
  getCheckRuns(sha) {
    return this.request('GET', `/commits/${sha}/check-runs?filter=latest&per_page=100`);
  }
  getPullRequestWorkflowRuns(sha) {
    return this.request('GET', `/actions/runs?head_sha=${encodeURIComponent(sha)}&event=pull_request&per_page=100`);
  }
  approveWorkflowRun(runId) {
    return this.request('POST', `/actions/runs/${Number(runId)}/approve`, { ok: [201] });
  }
  dispatchWorkflow(workflowId, ref) {
    return this.request('POST', `/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
      body: { ref }, ok: [200, 204],
    });
  }
  mergePull(number, { sha, method, title }) {
    return this.request('PUT', `/pulls/${number}/merge`, {
      body: {
        sha,
        merge_method: method,
        commit_title: `${title} (#${number})`,
        commit_message: 'Merged by the FleetDev agent integration queue.',
      }, ok: [200],
    });
  }
  async ensureLabel(name, metadata = LABELS[name]) {
    try {
      await this.request('GET', `/labels/${encodeURIComponent(name)}`);
      return;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    try {
      await this.request('POST', '/labels', {
        body: { name, color: metadata?.color || 'D4C5F9', description: metadata?.description || null },
        ok: [201],
      });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }
  addLabels(number, labels) {
    return this.request('POST', `/issues/${number}/labels`, { body: { labels }, ok: [200] });
  }
  removeLabel(number, label) {
    return this.request('DELETE', `/issues/${number}/labels/${encodeURIComponent(label)}`, { ok: [200, 404] });
  }
  comment(number, body) {
    return this.request('POST', `/issues/${number}/comments`, { body: { body }, ok: [201] });
  }
}

const sleepDefault = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getBaseSha(api, branch) {
  const ref = await api.getBaseRef(branch);
  return ref?.object?.sha;
}

async function waitForUpdatedHead(api, prNumber, previousHeadSha, {
  readyLabel,
  repository,
  baseBranch,
  timeoutMs,
  pollMs,
  sleep,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pr = await api.getPull(prNumber);
    const validation = validatePullRequest(pr, { repository, baseBranch, readyLabel });
    if (validation) {
      if (!hasLabel(pr, readyLabel) || pr.state !== 'open') throw new QueueCancelled(validation);
      throw new QueueBlocked(validation);
    }
    if (pr.head.sha !== previousHeadSha) return pr.head.sha;
    await sleep(pollMs);
  }
  throw new QueueBlocked(`Timed out waiting for GitHub to update PR #${prNumber} with the latest ${baseBranch}.`);
}

function matchesWorkflowFile(run, workflowFile) {
  const path = String(run?.path || '').split('@', 1)[0];
  return path === workflowFile || path.endsWith(`/${workflowFile}`);
}

async function approveAndWaitForRefreshCanonical(api, prNumber, headSha, {
  workflowFile,
  readyLabel,
  repository,
  baseBranch,
  timeoutMs,
  pollMs,
  sleep,
  log,
}) {
  const deadline = Date.now() + timeoutMs;
  let lastSummary = '';
  let approvedRunId = null;

  while (Date.now() < deadline) {
    const pr = await api.getPull(prNumber);
    if (pr.head?.sha !== headSha) {
      throw new QueueBlocked(`PR #${prNumber} changed from ${headSha.slice(0, 12)} while waiting for its refresh-created canonical run.`);
    }
    const validation = validatePullRequest(pr, { repository, baseBranch, readyLabel });
    if (validation) {
      if (!hasLabel(pr, readyLabel) || pr.state !== 'open') throw new QueueCancelled(validation);
      throw new QueueBlocked(validation);
    }

    const payload = await api.getPullRequestWorkflowRuns(headSha);
    const runs = (payload?.workflow_runs || [])
      .filter(run => run?.head_sha === headSha && run?.event === 'pull_request' && matchesWorkflowFile(run, workflowFile))
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const canonical = runs[0];

    if (!canonical) {
      const summary = 'waiting for refresh-created canonical pull_request run';
      if (summary !== lastSummary) { log(`PR #${prNumber} ${summary}.`); lastSummary = summary; }
      await sleep(pollMs);
      continue;
    }

    if (canonical.conclusion === 'action_required') {
      if (approvedRunId !== canonical.id) {
        try {
          await api.approveWorkflowRun(canonical.id);
        } catch (error) {
          throw new QueueBlocked(`Could not approve refresh-created canonical run ${canonical.id} for PR #${prNumber}. ${error.message}`);
        }
        approvedRunId = canonical.id;
        log(`Approved refresh-created canonical pull_request run ${canonical.id} for PR #${prNumber}@${headSha.slice(0, 12)}.`);
      }
      await sleep(pollMs);
      continue;
    }

    if (canonical.status === 'completed') {
      if (canonical.conclusion === 'success') return canonical;
      throw new QueueBlocked(`Refresh-created canonical pull_request run ${canonical.id} for PR #${prNumber} completed with ${canonical.conclusion || 'an unknown conclusion'}.`);
    }

    const summary = `refresh-created canonical run ${canonical.id} is ${canonical.status || 'pending'}`;
    if (summary !== lastSummary) { log(`PR #${prNumber} ${summary}.`); lastSummary = summary; }
    await sleep(pollMs);
  }

  throw new QueueBlocked(`Timed out waiting for the refresh-created canonical pull_request run on PR #${prNumber}@${headSha.slice(0, 12)}.`);
}

async function waitForRequiredChecks(api, prNumber, headSha, requiredChecks, {
  minimumIds,
  readyLabel,
  repository,
  baseBranch,
  timeoutMs,
  pollMs,
  sleep,
  log,
}) {
  const deadline = Date.now() + timeoutMs;
  let lastSummary = '';
  while (Date.now() < deadline) {
    const pr = await api.getPull(prNumber);
    if (pr.head?.sha !== headSha) {
      throw new QueueBlocked(`PR #${prNumber} changed from ${headSha.slice(0, 12)} to ${String(pr.head?.sha || 'unknown').slice(0, 12)} while queued. Re-verify the new head before re-queueing.`);
    }
    const validation = validatePullRequest(pr, { repository, baseBranch, readyLabel });
    if (validation) {
      if (!hasLabel(pr, readyLabel) || pr.state !== 'open') throw new QueueCancelled(validation);
      throw new QueueBlocked(validation);
    }

    const payload = await api.getCheckRuns(headSha);
    const state = classifyRequiredChecks(payload?.check_runs || [], requiredChecks, minimumIds);
    if (state.failed.length) {
      throw new QueueBlocked(`Required check failed on ${headSha.slice(0, 12)}: ${state.failed.map(item => `${item.name} (${item.conclusion})`).join(', ')}.`);
    }
    if (state.complete) return state;

    const summary = [
      state.missing.length ? `waiting to start: ${state.missing.join(', ')}` : '',
      state.pending.length ? `running: ${state.pending.map(item => `${item.name} (${item.status})`).join(', ')}` : '',
    ].filter(Boolean).join('; ');
    if (summary !== lastSummary) {
      log(`PR #${prNumber} ${summary}`);
      lastSummary = summary;
    }
    await sleep(pollMs);
  }
  throw new QueueBlocked(`Timed out waiting for required checks on PR #${prNumber}: ${requiredChecks.join(', ')}.`);
}

async function markRunning(api, prNumber, config) {
  await api.removeLabel(prNumber, config.blockedLabel);
  await api.addLabels(prNumber, [config.runningLabel]);
}

async function clearQueueLabels(api, prNumber, config, log) {
  for (const label of [config.readyLabel, config.runningLabel, config.blockedLabel]) {
    try { await api.removeLabel(prNumber, label); }
    catch (error) { log(`Merged PR #${prNumber}, but could not remove ${label}: ${error.message}`); }
  }
}

async function markBlocked(api, prNumber, config, error, log) {
  const message = String(error?.message || error).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 1800);
  try { await api.removeLabel(prNumber, config.readyLabel); } catch (cleanupError) { log(`Could not remove ${config.readyLabel}: ${cleanupError.message}`); }
  try { await api.removeLabel(prNumber, config.runningLabel); } catch (cleanupError) { log(`Could not remove ${config.runningLabel}: ${cleanupError.message}`); }
  try { await api.addLabels(prNumber, [config.blockedLabel]); } catch (cleanupError) { log(`Could not add ${config.blockedLabel}: ${cleanupError.message}`); }
  try {
    await api.comment(prNumber,
      `### Agent merge queue blocked\n\n${message}\n\nFix or re-verify the PR, then remove \`${config.blockedLabel}\` if appropriate and add \`${config.readyLabel}\` again to re-enter the queue.`);
  } catch (cleanupError) {
    log(`Could not comment on blocked PR: ${cleanupError.message}`);
  }
}

export async function processPullRequest({
  api,
  prNumber,
  config = QUEUE_DEFAULTS,
  sleep = sleepDefault,
  log = console.log,
}) {
  let pr = await api.getPull(prNumber);
  const validation = validatePullRequest(pr, {
    repository: api.repository,
    baseBranch: config.baseBranch,
    readyLabel: config.readyLabel,
  });
  if (validation) {
    if (!hasLabel(pr, config.readyLabel) || pr.state !== 'open') throw new QueueCancelled(validation);
    throw new QueueBlocked(validation);
  }

  const dependencyError = await validatePullDependencies(api, prNumber, pr.body);
  if (dependencyError) {
    throw new QueueBlocked(dependencyError);
  }

  await markRunning(api, prNumber, config);
  log(`PR #${prNumber} entered the serialized integration slot.`);

  for (let refresh = 1; refresh <= config.maxRefreshes; refresh += 1) {
    pr = await api.getPull(prNumber);
    const currentValidation = validatePullRequest(pr, {
      repository: api.repository,
      baseBranch: config.baseBranch,
      readyLabel: config.readyLabel,
    });
    if (currentValidation) {
      if (!hasLabel(pr, config.readyLabel) || pr.state !== 'open') throw new QueueCancelled(currentValidation);
      throw new QueueBlocked(currentValidation);
    }

    const baseSha = await getBaseSha(api, config.baseBranch);
    if (!baseSha) throw new QueueBlocked(`Could not resolve ${config.baseBranch}.`);
    let headSha = pr.head.sha;
    const comparison = await api.compare(baseSha, headSha);

    if (needsBaseUpdate(comparison.status)) {
      log(`PR #${prNumber} is ${comparison.status} against ${config.baseBranch}@${baseSha.slice(0, 12)}; asking GitHub to merge the base into the PR branch.`);
      try {
        await api.updateBranch(prNumber, headSha);
      } catch (error) {
        throw new QueueBlocked(`GitHub could not update PR #${prNumber} with ${config.baseBranch}. Resolve its merge conflict and re-queue it. ${error.message}`);
      }
      headSha = await waitForUpdatedHead(api, prNumber, headSha, {
        readyLabel: config.readyLabel,
        repository: api.repository,
        baseBranch: config.baseBranch,
        timeoutMs: config.updateTimeoutMs,
        pollMs: config.pollMs,
        sleep,
      });
      const newestBase = await getBaseSha(api, config.baseBranch);
      if (newestBase !== baseSha) {
        log(`${config.baseBranch} moved during the update (${baseSha.slice(0, 12)} -> ${newestBase.slice(0, 12)}); refreshing before CI.`);
        continue;
      }
      // GitHub deliberately marks pull_request workflows created by a
      // GITHUB_TOKEN-authored PR update as approval-required. Approve and wait
      // for the real PR-event canonical check before the queue's separate
      // workflow_dispatch gate; otherwise branch protection continues to see
      // the required PR check as expected even when the dispatched copy passes.
      await approveAndWaitForRefreshCanonical(api, prNumber, headSha, {
        workflowFile: 'canonical-integration.yml',
        readyLabel: config.readyLabel,
        repository: api.repository,
        baseBranch: config.baseBranch,
        timeoutMs: config.checkTimeoutMs,
        pollMs: config.pollMs,
        sleep,
        log,
      });
    } else if (comparison.status === 'identical') {
      throw new QueueBlocked(`PR #${prNumber} has no commits ahead of ${config.baseBranch}.`);
    }

    const beforeDispatch = await api.getCheckRuns(headSha);
    const minimumIds = latestCheckIds(beforeDispatch?.check_runs || [], config.requiredChecks);
    log(`Dispatching a fresh canonical integration run for PR #${prNumber}@${headSha.slice(0, 12)}.`);
    try {
      await api.dispatchWorkflow('canonical-integration.yml', pr.head.ref);
    } catch (error) {
      throw new QueueBlocked(`Could not dispatch canonical integration for PR #${prNumber}. ${error.message}`);
    }
    log(`Waiting for required checks on PR #${prNumber}@${headSha.slice(0, 12)}.`);
    await waitForRequiredChecks(api, prNumber, headSha, config.requiredChecks, {
      minimumIds,
      readyLabel: config.readyLabel,
      repository: api.repository,
      baseBranch: config.baseBranch,
      timeoutMs: config.checkTimeoutMs,
      pollMs: config.pollMs,
      sleep,
      log,
    });

    const finalPr = await api.getPull(prNumber);
    if (finalPr.head.sha !== headSha) {
      throw new QueueBlocked(`PR #${prNumber} changed after its checks passed. Re-verify and re-queue the new head.`);
    }
    if (!hasLabel(finalPr, config.readyLabel)) throw new QueueCancelled(`PR #${prNumber} was removed from the queue.`);

    const newestBase = await getBaseSha(api, config.baseBranch);
    if (newestBase !== baseSha) {
      log(`${config.baseBranch} moved while PR #${prNumber} was being checked (${baseSha.slice(0, 12)} -> ${newestBase.slice(0, 12)}); refreshing the same PR instead of racing the merge.`);
      continue;
    }

    const preMergeComparison = await api.compare(newestBase, headSha);
    if (preMergeComparison.status !== 'ahead') {
      if (needsBaseUpdate(preMergeComparison.status)) {
        log(`PR #${prNumber}@${headSha.slice(0, 12)} is ${preMergeComparison.status} against ${config.baseBranch}@${newestBase.slice(0, 12)}; refreshing before merge.`);
        continue;
      }
      throw new QueueBlocked(`PR #${prNumber}@${headSha.slice(0, 12)} cannot merge: freshness comparison against ${config.baseBranch}@${newestBase.slice(0, 12)} is ${preMergeComparison.status}.`);
    }

    let merged;
    let refreshAfterMergeRace = false;
    for (let settleAttempt = 0; settleAttempt <= config.mergeSettleRetries; settleAttempt += 1) {
      try {
        merged = await api.mergePull(prNumber, { sha: headSha, method: config.mergeMethod, title: finalPr.title });
        break;
      } catch (error) {
        const afterFailureBase = await getBaseSha(api, config.baseBranch);
        if (afterFailureBase !== baseSha && refresh < config.maxRefreshes) {
          log(`${config.baseBranch} moved during the merge request; retrying PR #${prNumber} against the new base.`);
          refreshAfterMergeRace = true;
          break;
        }
        if (!isTransientRequiredCheckExpected(error) || settleAttempt >= config.mergeSettleRetries) {
          throw new QueueBlocked(`GitHub rejected the merge for PR #${prNumber}. ${error.message}`);
        }

        const retryPr = await api.getPull(prNumber);
        if (retryPr.head.sha !== headSha) {
          throw new QueueBlocked(`PR #${prNumber} changed after its checks passed. Re-verify and re-queue the new head.`);
        }
        const retryValidation = validatePullRequest(retryPr, {
          repository: api.repository,
          baseBranch: config.baseBranch,
          readyLabel: config.readyLabel,
        });
        if (retryValidation) {
          if (!hasLabel(retryPr, config.readyLabel) || retryPr.state !== 'open') throw new QueueCancelled(retryValidation);
          throw new QueueBlocked(retryValidation);
        }

        const retryChecks = await api.getCheckRuns(headSha);
        const retryState = classifyRequiredChecks(retryChecks?.check_runs || [], config.requiredChecks, minimumIds);
        if (!retryState.complete) {
          throw new QueueBlocked(`Required checks were no longer complete while waiting for GitHub to recognize them on ${headSha.slice(0, 12)}.`);
        }

        log(`GitHub has not recognized the just-passed required check for PR #${prNumber}; waiting ${config.pollMs}ms before merge retry ${settleAttempt + 1}/${config.mergeSettleRetries}.`);
        await sleep(config.pollMs);
      }
    }
    if (refreshAfterMergeRace) continue;
    if (!merged?.merged) {
      throw new QueueBlocked(`GitHub did not merge PR #${prNumber}: ${merged?.message || 'unknown merge response'}.`);
    }

    await clearQueueLabels(api, prNumber, config, log);
    log(`Merged PR #${prNumber} as ${merged.sha}.`);
    return { merged: true, sha: merged.sha, prNumber, headSha, baseSha, refreshes: refresh };
  }

  throw new QueueBlocked(`PR #${prNumber} could not catch a stable ${config.baseBranch} after ${config.maxRefreshes} refreshes. Re-queue it when the current merge burst settles.`);
}

export async function ensureQueueLabels(api, config = QUEUE_DEFAULTS) {
  await api.ensureLabel(config.readyLabel, LABELS[config.readyLabel]);
  await api.ensureLabel(config.runningLabel, LABELS[config.runningLabel]);
  await api.ensureLabel(config.blockedLabel, LABELS[config.blockedLabel]);
}

function configFromEnv(env) {
  const requiredChecks = (env.AGENT_QUEUE_REQUIRED_CHECKS || QUEUE_DEFAULTS.requiredChecks.join('\n'))
    .split(/\n|,/).map(value => value.trim()).filter(Boolean);
  return {
    ...QUEUE_DEFAULTS,
    baseBranch: env.AGENT_QUEUE_BASE_BRANCH || QUEUE_DEFAULTS.baseBranch,
    mergeMethod: env.AGENT_QUEUE_MERGE_METHOD || QUEUE_DEFAULTS.mergeMethod,
    requiredChecks,
    pollMs: Number(env.AGENT_QUEUE_POLL_MS || QUEUE_DEFAULTS.pollMs),
    checkTimeoutMs: Number(env.AGENT_QUEUE_CHECK_TIMEOUT_MS || QUEUE_DEFAULTS.checkTimeoutMs),
    updateTimeoutMs: Number(env.AGENT_QUEUE_UPDATE_TIMEOUT_MS || QUEUE_DEFAULTS.updateTimeoutMs),
    mergeSettleRetries: Number(env.AGENT_QUEUE_MERGE_SETTLE_RETRIES || QUEUE_DEFAULTS.mergeSettleRetries),
  };
}

async function readEvent(path) {
  if (!path) return {};
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function runFromEnvironment(env = process.env, { fetchImpl = globalThis.fetch, sleep = sleepDefault, log = console.log } = {}) {
  const config = configFromEnv(env);
  const api = new GitHubApi({ token: env.GITHUB_TOKEN, repository: env.GITHUB_REPOSITORY, fetchImpl });
  await ensureQueueLabels(api, config);

  const event = await readEvent(env.GITHUB_EVENT_PATH);
  const eventName = env.GITHUB_EVENT_NAME || '';
  let prNumber = null;

  if (eventName === 'pull_request_target') {
    if (event.action !== 'labeled' || event.label?.name !== config.readyLabel) {
      log(`Ignoring pull_request_target action ${event.action || 'unknown'} / label ${event.label?.name || 'none'}.`);
      return { bootstrapped: true };
    }
    prNumber = Number(event.pull_request?.number);
  } else if (eventName === 'workflow_dispatch') {
    prNumber = Number(event.inputs?.pr_number || 0) || null;
    if (prNumber) await api.addLabels(prNumber, [config.readyLabel]);
  } else if (eventName === 'push') {
    log('Agent merge queue labels are installed.');
    return { bootstrapped: true };
  } else {
    log(`No queue action for event ${eventName || 'unknown'}; labels were ensured.`);
    return { bootstrapped: true };
  }

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    log('No PR number supplied; labels were ensured only.');
    return { bootstrapped: true };
  }

  try {
    return await processPullRequest({ api, prNumber, config, sleep, log });
  } catch (error) {
    if (error instanceof QueueCancelled) {
      try { await api.removeLabel(prNumber, config.runningLabel); } catch {}
      log(error.message);
      return { cancelled: true, prNumber };
    }
    await markBlocked(api, prNumber, config, error, log);
    throw error;
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  runFromEnvironment().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}
