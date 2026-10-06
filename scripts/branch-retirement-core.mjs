export function classifyBranches({ branches, pullRequests, ledger, activeWorkText = '' }) {
  const protectedNames = new Set(ledger.protectedBranches || ['main', 'dev']);
  const openHeads = new Set();
  const openBases = new Set();
  const prsByHead = new Map();
  const prsByNumber = new Map();

  for (const pr of pullRequests) {
    prsByNumber.set(pr.number, pr);
    const head = pr.head?.ref;
    const base = pr.base?.ref;
    const sameRepoHead = !pr.head?.repo?.full_name || !pr.base?.repo?.full_name || pr.head.repo.full_name === pr.base.repo.full_name;
    if (head && sameRepoHead) {
      if (!prsByHead.has(head)) prsByHead.set(head, []);
      prsByHead.get(head).push(pr);
      if (pr.state === 'open') openHeads.add(head);
    }
    if (base && pr.state === 'open') openBases.add(base);
  }

  const explicit = new Map((ledger.retirements || []).map((entry) => [entry.branch, entry]));
  const decisions = [];

  for (const branch of branches) {
    const name = branch.name;
    const sha = branch.commit?.sha;
    const hold = (reason) => decisions.push({ branch: name, sha, action: 'keep', reason });
    const retire = (reason) => decisions.push({ branch: name, sha, action: 'retire', reason });

    if (protectedNames.has(name)) {
      hold('long-lived protected branch');
      continue;
    }
    if (openHeads.has(name)) {
      hold('head of an open pull request');
      continue;
    }
    if (openBases.has(name)) {
      hold('base of an open pull request stack');
      continue;
    }
    if (activeWorkText && activeWorkText.includes(name)) {
      hold('referenced by an active-work record');
      continue;
    }

    const branchPrs = prsByHead.get(name) || [];
    const exactMerged = branchPrs.find((pr) => pr.merged_at && pr.head?.sha === sha);
    if (exactMerged) {
      retire(`exact merged head of PR #${exactMerged.number}`);
      continue;
    }

    const entry = explicit.get(name);
    if (!entry) {
      hold(branchPrs.length ? 'no exact merged head and no explicit audited retirement' : 'no pull-request provenance and no explicit audited retirement');
      continue;
    }
    if (entry.expectedHeadSha !== sha) {
      hold(`audited retirement SHA mismatch: expected ${entry.expectedHeadSha}`);
      continue;
    }

    if (entry.sourcePr) {
      const source = prsByNumber.get(entry.sourcePr);
      if (!source || source.state !== 'closed') {
        hold(`source PR #${entry.sourcePr} is not confirmed closed`);
        continue;
      }
    }

    const missingSuccessor = (entry.successorPrs || []).find((number) => !prsByNumber.get(number)?.merged_at);
    if (missingSuccessor) {
      hold(`successor PR #${missingSuccessor} is not confirmed merged`);
      continue;
    }

    retire(entry.reason || 'explicit SHA-pinned audited retirement');
  }

  return decisions;
}
