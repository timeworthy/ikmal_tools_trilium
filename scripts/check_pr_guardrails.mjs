#!/usr/bin/env node
/**
 * PR Guardrails: Dependencies and Freshness Checker
 *
 * Verifies that:
 * 1. All `Depends-On: #<PR>` prerequisite pull requests are already merged.
 * 2. The PR branch is fresh against the base branch (warns or fails based on mode).
 *
 * Usage:
 *   node scripts/check_pr_guardrails.mjs
 * Environment variables:
 *   GITHUB_TOKEN - Required for GitHub API access
 *   GITHUB_REPOSITORY - owner/repo (defaults to iansherr/fleetdev)
 *   PR_NUMBER - Optional PR number (or read from GITHUB_EVENT_PATH)
 *   STRICT_FRESHNESS - Set to '1' or 'true' to fail if behind base branch
 */

import { appendFile, readFile } from 'node:fs/promises';
import {
  GitHubApi,
  QUEUE_DEFAULTS,
  parsePullDependencies,
  validatePullDependencies,
} from './agent_merge_queue.mjs';

async function readEvent(path) {
  if (!path) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return {};
  }
}

async function writeStepSummary(env, heading, details) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  try {
    await appendFile(env.GITHUB_STEP_SUMMARY, `### ${heading}\n\n${details}\n\n`, 'utf8');
  } catch (err) {
    console.error(`Could not write the PR guardrails summary: ${err.message}`);
  }
}

export async function checkPrGuardrails(env = process.env, {
  log = console.log,
  errorLog = console.error,
  apiFactory = options => new GitHubApi(options),
} = {}) {
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY || 'iansherr/fleetdev';
  const strictFreshness = env.STRICT_FRESHNESS === '1' || env.STRICT_FRESHNESS === 'true';

  if (!token) {
    log('ℹ️  GITHUB_TOKEN not provided; skipping remote PR guardrails check.');
    return { skipped: true, reason: 'no-token' };
  }

  const event = await readEvent(env.GITHUB_EVENT_PATH);
  let prNumber = Number(env.PR_NUMBER || event.pull_request?.number || 0);

  // Parse command-line args: --pr <number>
  const prArgIndex = process.argv.indexOf('--pr');
  if (prArgIndex !== -1 && process.argv[prArgIndex + 1]) {
    prNumber = parseInt(process.argv[prArgIndex + 1], 10);
  }

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    log('ℹ️  No active PR number detected in environment or event; skipping PR guardrails check.');
    return { skipped: true, reason: 'no-pr' };
  }

  const api = apiFactory({ token, repository });
  log(`🔍 Checking PR guardrails for PR #${prNumber} in ${repository}...`);

  let pr;
  try {
    pr = await api.getPull(prNumber);
  } catch (err) {
    if (err.status === 403) {
      log(`⚠️  Notice: GITHUB_TOKEN has insufficient permission (403) to read PR #${prNumber}; skipping PR dependency inspection in this workflow.`);
      return { skipped: true, reason: 'insufficient-permission' };
    }
    throw err;
  }
  const baseBranch = pr.base?.ref || QUEUE_DEFAULTS.baseBranch;
  const baseSha = pr.base?.sha;
  const headSha = pr.head?.sha;

  // 1. Dependency Validation (Depends-On: #<PR>)
  const dependencies = parsePullDependencies(pr.body);
  if (dependencies.length > 0) {
    log(`📋 Declared PR dependencies: ${dependencies.map(n => `#${n}`).join(', ')}`);
    const depError = await validatePullDependencies(api, prNumber, pr.body);
    if (depError) {
      errorLog(`❌ PR Dependency Check Failed: ${depError}`);
      await writeStepSummary(env, 'PR dependencies need attention', `${depError}\n\nMerge the declared prerequisite PRs into \`${baseBranch}\`, then retry.`);
      throw new Error(`PR Dependency Check Failed: ${depError}`);
    }
    log(`✅ All ${dependencies.length} declared PR dependencies are merged.`);
  } else {
    log('ℹ️  No PR dependencies declared (use "Depends-On: #<PR>" if needed).');
  }

  // 2. Freshness Verification against Base Branch
  let latestBaseSha = baseSha;
  try {
    const baseRef = await api.getBaseRef(baseBranch);
    latestBaseSha = baseRef?.object?.sha || baseSha;
  } catch (err) {
    log(`⚠️  Could not fetch live ref for ${baseBranch}: ${err.message}`);
  }

  const comparison = await api.compare(latestBaseSha, headSha);
  log(`📊 Branch freshness against ${baseBranch}@${latestBaseSha.slice(0, 8)}: status='${comparison.status}' (ahead by ${comparison.ahead_by}, behind by ${comparison.behind_by})`);

  if (comparison.status === 'ahead') {
    log(`✅ PR #${prNumber} is strictly fresh and up-to-date with ${baseBranch}.`);
  } else if (comparison.status === 'identical') {
    log(`ℹ️  PR #${prNumber} is identical to ${baseBranch}.`);
  } else {
    const message = `PR #${prNumber} is ${comparison.status} against ${baseBranch} (${comparison.behind_by} commits behind).`;
    if (strictFreshness) {
      errorLog(`❌ Freshness Check Failed: ${message} (STRICT_FRESHNESS is enabled)`);
      await writeStepSummary(env, 'PR branch needs an update', `${message}\n\nUpdate the branch from \`${baseBranch}\`, then retry.`);
      throw new Error(`Freshness Check Failed: ${message}`);
    } else {
      log(`⚠️  Notice: ${message} The agent merge queue will automatically sync ${baseBranch} when queued.`);
      await writeStepSummary(env, 'PR branch freshness', `${message} The merge queue will sync \`${baseBranch}\` before integration.`);
    }
  }

  return { ok: true, prNumber, dependencies, freshness: comparison.status };
}

const isDirect = process.argv[1] && import.meta.url.endsWith(process.argv[1]);
if (isDirect) {
  checkPrGuardrails().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
