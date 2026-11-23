#!/usr/bin/env node
// Auto-merge policy. A pull request merges without a person only when the
// repository default or its label says so AND every check on its head commit
// has completed successfully. Merges use a merge commit: never squash or rebase.
//
// Decisions are pure (decidePolicy, gateChecks) and runPolicy takes an injected
// API so the harness can drive it with fakes. Anything unclear fails closed.

export const AUTO_LABEL = 'auto-merge';
export const OPT_OUT_LABEL = 'no-auto-merge';
export const MERGE_METHOD = 'merge';

// Pure: label beats repository default; anything other than the exact string
// 'on' for the default is off.
export function decidePolicy({ labels = [], repoDefault } = {}) {
  if (labels.includes(OPT_OUT_LABEL)) return { policy: 'off', source: 'label-no-auto-merge' };
  if (labels.includes(AUTO_LABEL)) return { policy: 'on', source: 'label-auto-merge' };
  if (repoDefault === 'on') return { policy: 'on', source: 'repo-default-on' };
  return { policy: 'off', source: 'repo-default-off' };
}

// Pure: every relevant check run must be completed with conclusion success, and
// at least one must exist. Re-runs of the same check name: the newest run decides.
// `ignoreNames` excludes this policy's own check so it cannot block itself.
// `requiredNames` must each be present and successful. Without branch protection
// this list is the only way to stop a PR merging on a partial CI run, so an
// empty list fails closed.
export function gateChecks(checkRuns = [], { ignoreNames = [], requiredNames = [] } = {}) {
  if (requiredNames.length === 0) return { ok: false, reason: 'no required checks configured (AUTO_MERGE_REQUIRED_CHECKS is empty)' };
  const latest = new Map();
  for (const run of checkRuns) {
    if (ignoreNames.includes(run.name)) continue;
    const previous = latest.get(run.name);
    if (!previous || run.id > previous.id) latest.set(run.name, run);
  }
  const missing = requiredNames.filter((name) => !latest.has(name));
  if (missing.length > 0) return { ok: false, reason: `required checks missing: ${missing.join(', ')}` };
  const relevant = [...latest.values()];
  if (relevant.length === 0) return { ok: false, reason: 'no checks on the head commit' };
  const pending = relevant.filter((run) => run.status !== 'completed').map((run) => run.name);
  if (pending.length > 0) return { ok: false, reason: `pending checks: ${pending.join(', ')}` };
  const notSuccess = relevant.filter((run) => run.conclusion !== 'success').map((run) => `${run.name}=${run.conclusion}`);
  if (notSuccess.length > 0) return { ok: false, reason: `checks not successful: ${notSuccess.join(', ')}` };
  return { ok: true, reason: `${relevant.length} check(s) successful` };
}

// Drives one decision against an injected API:
//   api.getPull(number) -> { number, state, headSha, labels: [name] }
//   api.listCheckRuns(sha) -> { totalCount, checkRuns: [{ id, name, status, conclusion }] }
//   api.merge(number, { sha, method }) -> void
export async function runPolicy({ api, number, repoDefault, ignoreNames = [], requiredNames = [] }) {
  const pull = await api.getPull(number);
  const { policy, source } = decidePolicy({ labels: pull.labels, repoDefault });
  const base = { number, headSha: pull.headSha, policy, source };
  if (pull.state !== 'open') return { ...base, action: 'none', reason: `pull request is ${pull.state}` };
  if (policy !== 'on') return { ...base, action: 'none', reason: 'auto-merge is off for this pull request' };

  const checks = await api.listCheckRuns(pull.headSha);
  if (checks.checkRuns.length < checks.totalCount) {
    return { ...base, action: 'none', reason: `only ${checks.checkRuns.length} of ${checks.totalCount} check runs were listed; refusing to merge on partial evidence` };
  }
  const gate = gateChecks(checks.checkRuns, { ignoreNames, requiredNames });
  if (!gate.ok) return { ...base, action: 'none', reason: gate.reason };

  await api.merge(number, { sha: pull.headSha, method: MERGE_METHOD });
  return { ...base, action: 'merged', reason: gate.reason };
}

// Real GitHub REST client. Only used by the CLI entry point.
export function githubApi({ repo, token, fetchImpl = fetch }) {
  const base = `https://api.github.com/repos/${repo}`;
  const call = async (method, path, body) => {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  return {
    async getPull(number) {
      const pull = await call('GET', `/pulls/${number}`);
      return {
        number,
        state: pull.state,
        headSha: pull.head.sha,
        labels: pull.labels.map((label) => label.name),
      };
    },
    async listCheckRuns(sha) {
      const data = await call('GET', `/commits/${sha}/check-runs?per_page=100`);
      return { totalCount: data.total_count, checkRuns: data.check_runs };
    },
    async merge(number, { sha, method }) {
      await call('PUT', `/pulls/${number}/merge`, { merge_method: method, sha });
    },
  };
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const number = Number(process.env.PR_NUMBER);
  const repoDefault = process.env.AUTO_MERGE_DEFAULT || 'off';
  const ignoreNames = (process.env.POLICY_CHECK_NAME ? [process.env.POLICY_CHECK_NAME] : ['auto-merge-policy']);
  const requiredNames = (process.env.AUTO_MERGE_REQUIRED_CHECKS || '').split(',').map((name) => name.trim()).filter(Boolean);
  if (!repo || !token || !Number.isInteger(number) || number <= 0) {
    console.error('auto-merge policy: GITHUB_REPOSITORY, GITHUB_TOKEN and PR_NUMBER are required');
    process.exit(1);
  }
  const result = await runPolicy({ api: githubApi({ repo, token }), number, repoDefault, ignoreNames, requiredNames });
  console.log(JSON.stringify(result));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
