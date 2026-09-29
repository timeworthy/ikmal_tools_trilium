#!/usr/bin/env node
/**
 * Autonomous Reactive Merge Train Trigger
 *
 * When a commit lands on the base branch (e.g. main), this script:
 * 1. Fetches all open pull requests targeting the base branch.
 * 2. Parses their `Depends-On: #<PR>` headers.
 * 3. If an open PR's dependencies are now ALL merged:
 *    - Automatically labels the PR `merge-ready` (if not already labeled).
 *    - Removes `merge-blocked` if present.
 *    - Posts a notification comment on the PR.
 */

import {
  GitHubApi,
  QUEUE_DEFAULTS,
  parsePullDependencies,
  validatePullDependencies,
} from './agent_merge_queue.mjs';

export async function triggerMergeTrain(env = process.env, { api: injectedApi, log = console.log } = {}) {
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  const baseBranch = env.AGENT_QUEUE_BASE_BRANCH || QUEUE_DEFAULTS.baseBranch;

  if (!injectedApi && (!token || !repository)) {
    log('ℹ️  GITHUB_TOKEN or GITHUB_REPOSITORY not provided; skipping merge train trigger.');
    return { skipped: true };
  }

  const api = injectedApi || new GitHubApi({ token, repository });
  log(`🚂 Checking for downstream dependent PRs targeting ${baseBranch} in ${repository || api.repository}...`);

  let openPulls = [];
  try {
    openPulls = await api.request('GET', `/pulls?state=open&base=${encodeURIComponent(baseBranch)}&per_page=100`);
  } catch (err) {
    log(`⚠️  Could not fetch open pull requests: ${err.message}`);
    return { skipped: true };
  }

  let triggeredCount = 0;
  for (const pr of openPulls) {
    const dependencies = parsePullDependencies(pr.body);
    if (dependencies.length === 0) continue;

    const hasBlocked = Array.isArray(pr.labels) && pr.labels.some(l => (l?.name ?? l) === QUEUE_DEFAULTS.blockedLabel);
    const hasReady = Array.isArray(pr.labels) && pr.labels.some(l => (l?.name ?? l) === QUEUE_DEFAULTS.readyLabel);

    const depError = await validatePullDependencies(api, pr.number, pr.body);
    if (!depError) {
      log(`🚂 PR #${pr.number} dependencies (${dependencies.map(d => `#${d}`).join(', ')}) are now ALL MERGED!`);
      if (hasBlocked || !hasReady) {
        if (hasBlocked) {
          try { await api.removeLabel(pr.number, QUEUE_DEFAULTS.blockedLabel); } catch {}
        }
        await api.addLabels(pr.number, [QUEUE_DEFAULTS.readyLabel]);
        try {
          await api.comment(pr.number, `### 🚂 Autonomous Merge Train Triggered\n\nAll prerequisite PRs (${dependencies.map(d => `#${d}`).join(', ')}) have successfully merged to \`${baseBranch}\`!\n\nThis PR has been automatically enqueued with \`${QUEUE_DEFAULTS.readyLabel}\`.`);
        } catch {}
        triggeredCount += 1;
        log(`✅ Added ${QUEUE_DEFAULTS.readyLabel} to PR #${pr.number}.`);
      }
    } else {
      log(`⏳ PR #${pr.number} is still waiting: ${depError}`);
    }
  }

  log(`🚂 Merge train scan complete: ${triggeredCount} downstream PRs enqueued.`);
  return { triggeredCount };
}

const isDirect = process.argv[1] && import.meta.url.endsWith(process.argv[1]);
if (isDirect) {
  triggerMergeTrain().catch(err => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
