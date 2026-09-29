#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { classifyBranches } from './branch-retirement-core.mjs';

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const apply = process.env.BRANCH_RETIRE_APPLY === '1' || process.argv.includes('--apply');

if (!token || !repository) {
  console.log('ℹ️  GITHUB_TOKEN or GITHUB_REPOSITORY not provided; running in local inspection mode (dry run).');
}

const [owner, repo] = (repository || '').split('/');

const apiBase = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'fleetdev-branch-retirement',
};

async function api(relative, options = {}) {
  const response = await fetch(`${apiBase}${relative}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method || 'GET'} ${relative}: ${response.status} ${body}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function allPages(relative) {
  const out = [];
  for (let page = 1; ; page += 1) {
    const separator = relative.includes('?') ? '&' : '?';
    const rows = await api(`${relative}${separator}per_page=100&page=${page}`);
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

function collectActiveWorkText(root) {
  const pieces = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.md$/i.test(entry.name) && (full.includes(`${path.sep}active-work${path.sep}`) || /ACTIVE_WORK\.md$/i.test(entry.name))) {
        pieces.push(fs.readFileSync(full, 'utf8'));
      }
    }
  };
  walk(root);
  return pieces.join('\n');
}

async function main() {
  if (!token || !repository) {
    console.log('Skipping remote branch retirement: GITHUB_TOKEN and GITHUB_REPOSITORY must be set.');
    return;
  }

  const ledgerPath = process.env.BRANCH_RETIREMENT_LEDGER || 'data/repository_branch_retirements.json';
  let ledger = { protectedBranches: ['main', 'dev'], retirements: [] };
  if (fs.existsSync(ledgerPath)) {
    try {
      ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    } catch (e) {
      console.warn(`⚠️ Could not parse ledger ${ledgerPath}: ${e.message}; using defaults.`);
    }
  }

  const [branches, pullRequests] = await Promise.all([
    allPages('/branches'),
    allPages('/pulls?state=all'),
  ]);
  const activeWorkText = collectActiveWorkText('docs');
  const decisions = classifyBranches({ branches, pullRequests, ledger, activeWorkText });
  const retire = decisions.filter((decision) => decision.action === 'retire');
  const keep = decisions.filter((decision) => decision.action === 'keep');
  const deleted = [];
  const failures = [];

  console.log(`branch retirement: ${apply ? 'APPLY' : 'DRY RUN'}`);
  for (const decision of retire) console.log(`RETIRE ${decision.branch} ${decision.sha} — ${decision.reason}`);
  for (const decision of keep) console.log(`KEEP   ${decision.branch} ${decision.sha} — ${decision.reason}`);

  if (apply) {
    for (const decision of retire) {
      const encodedRef = decision.branch.split('/').map(encodeURIComponent).join('/');
      try {
        await api(`/git/refs/heads/${encodedRef}`, { method: 'DELETE' });
        deleted.push(decision);
        console.log(`DELETED ${decision.branch}`);
      } catch (error) {
        failures.push({ decision, error });
        console.error(`FAILED ${decision.branch}: ${error.message}`);
      }
    }
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      `## Branch retirement ${apply ? 'applied' : 'dry run'}`,
      '',
      `- Eligible: ${retire.length}`,
      `- Deleted: ${deleted.length}`,
      `- Delete failures: ${failures.length}`,
      `- Keep/hold: ${keep.length}`,
      '',
      ...retire.map((decision) => `- Eligible \`${decision.branch}\` at \`${decision.sha}\`: ${decision.reason}`),
      ...failures.map(({ decision, error }) => `- FAILED \`${decision.branch}\`: ${error.message}`),
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }

  if (failures.length) {
    throw new Error(`${failures.length} safe branch retirement deletion(s) failed; successful deletions were retained`);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exitCode = 1;
});
