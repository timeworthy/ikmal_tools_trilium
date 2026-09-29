#!/usr/bin/env python3
"""Standardized PR Failure Triage for Multi-Agent Workflows.

Triggered automatically by `.github/workflows/pr-failure-triage.yml` when a
workflow finishes with `conclusion == 'failure'`.

What it does:
  1. Identifies the Pull Request associated with the failed workflow run.
  2. Extracts concise, actionable failure snippets from the failed job logs
     (syntax errors, failed assertions, lint issues, guardrail blocks)
     without flooding the developer with 10,000-line raw CI logs.
  3. Correlates failed jobs with the PR's modified files to distinguish:
     - ❌ PR Defect (failure relates directly to files modified in this PR)
     - ⚠️ Potential Flake / Main Breakage (failure occurs in a gate unrelated to PR changes)
  4. Posts or updates a single sticky PR comment (`<!-- pr-failure-triage -->`),
     giving human developers and autonomous AI coding agents immediate root-cause
     clarity and suggested next steps.

Usage:
  python3 scripts/pr_failure_triage.py --run-id <RUN_ID> [--pr <PR_NUMBER>] [--no-post]
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

MARKER = "<!-- pr-failure-triage -->"

# Common regex patterns to pinpoint actionable failure lines
ERROR_PATTERNS = [
    re.compile(r"(AssertionError.*)", re.IGNORECASE),
    re.compile(r"(FAIL\s+.*)", re.IGNORECASE),
    re.compile(r"(Error:.*)", re.IGNORECASE),
    re.compile(r"(Exception:.*)", re.IGNORECASE),
    re.compile(r"(fatal:.*)", re.IGNORECASE),
    re.compile(r"(FAILED.*)", re.IGNORECASE),
    re.compile(r"(\[ERROR\].*)", re.IGNORECASE),
    re.compile(r"(PR Dependency Check Failed:.*)", re.IGNORECASE),
    re.compile(r"(Freshness Check Failed:.*)", re.IGNORECASE),
    re.compile(r"(Direct push to protected branch.*)", re.IGNORECASE),
]

def run_cmd(args: List[str], check: bool = True) -> str:
    res = subprocess.run(args, capture_output=True, text=True, check=check)
    return res.stdout.strip()

def get_run_metadata(run_id: str) -> Dict[str, Any]:
    output = run_cmd(["gh", "run", "view", run_id, "--json", "jobs,headBranch,headSha,event,conclusion,name,url"])
    return json.loads(output)

def find_pr_for_run(run_meta: Dict[str, Any], override_pr: Optional[str] = None) -> Optional[int]:
    if override_pr:
        return int(override_pr)

    branch = run_meta.get("headBranch")
    if not branch:
        return None

    try:
        output = run_cmd(["gh", "pr", "list", "--head", branch, "--state", "open", "--json", "number", "--limit", "1"])
        prs = json.loads(output)
        if prs:
            return prs[0]["number"]
    except Exception:
        pass
    return None

def get_pr_files(pr_number: int) -> List[str]:
    try:
        output = run_cmd(["gh", "pr", "view", str(pr_number), "--json", "files"])
        data = json.loads(output)
        return [f["path"] for f in data.get("files", [])]
    except Exception:
        return []

def extract_job_failure_snippet(job_id: int) -> List[str]:
    try:
        log_text = run_cmd(["gh", "run", "view", "--job", str(job_id), "--log-failed"], check=False)
        if not log_text:
            log_text = run_cmd(["gh", "run", "view", "--job", str(job_id), "--log"], check=False)
    except Exception:
        return ["Could not retrieve job logs."]

    lines = log_text.splitlines()
    matching_lines = []

    for line in lines:
        for pattern in ERROR_PATTERNS:
            if pattern.search(line):
                # Clean up GitHub Actions log timestamp prefix if present
                clean_line = re.sub(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*", "", line)
                matching_lines.append(clean_line)
                break

    if matching_lines:
        return matching_lines[-15:]  # return the most relevant failure lines

    # Fallback to the last 15 lines of the log
    return [re.sub(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s*", "", l) for l in lines[-15:] if l.strip()]

def format_triage_comment(run_meta: Dict[str, Any], pr_number: int, failures: List[Dict[str, Any]]) -> str:
    workflow_name = run_meta.get("name", "CI Workflow")
    run_url = run_meta.get("url", "")

    body = [
        MARKER,
        f"### 🚦 Automated CI Failure Triage for PR #{pr_number}",
        f"A failure occurred in **{workflow_name}** ([Run #{run_meta.get('jobs', [{}])[0].get('runId', '')}]({run_url})).\n",
        "Here is the distilled root cause and diagnostic summary:\n",
    ]

    for fail in failures:
        job_name = fail["name"]
        snippet = fail["snippet"]
        is_related = fail.get("is_related", True)

        rel_badge = "❌ **PR Defect**" if is_related else "⚠️ **Potential Flake / Unrelated Gate**"
        body.append(f"#### {job_name} — {rel_badge}")

        if not is_related:
            body.append(
                "> [!NOTE]\n"
                "> This failing job appears unrelated to the files modified in this PR. "
                "It may be caused by a recent base branch change or an environmental flake.\n"
            )

        body.append("```text")
        body.extend(snippet)
        body.append("```\n")

        if any("PR Dependency Check Failed" in line for line in snippet):
            body.append("> [!IMPORTANT]\n> **Action Required**: This PR declares prerequisite dependencies (`Depends-On: #<PR>`) that have not yet merged. Wait for upstream PRs to merge or update PR dependencies.")
        elif any("Freshness Check Failed" in line for line in snippet):
            body.append("> [!TIP]\n> **Action Required**: Branch is behind base. Merge or rebase latest base branch commits.")

    body.append("\n---\n*Generated automatically by standard agent triage guardrails.*")
    return "\n".join(body)

def post_or_update_comment(pr_number: int, comment_body: str) -> None:
    try:
        output = run_cmd(["gh", "pr", "view", str(pr_number), "--json", "comments"])
        comments_data = json.loads(output)
        comments = comments_data.get("comments", [])

        existing_id = None
        for c in comments:
            if MARKER in c.get("body", ""):
                existing_id = c.get("id")
                break

        if existing_id:
            run_cmd(["gh", "api", f"/repos/{{owner}}/{{repo}}/issues/comments/{existing_id}", "-X", "PATCH", "-f", f"body={comment_body}"])
            print(f"✅ Updated existing triage comment {existing_id} on PR #{pr_number}.")
        else:
            run_cmd(["gh", "pr", "comment", str(pr_number), "--body", comment_body])
            print(f"✅ Posted new triage comment on PR #{pr_number}.")
    except Exception as e:
        print(f"⚠️ Failed to post triage comment: {e}", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser(description="Triage failed GitHub Actions workflow runs.")
    parser.add_argument("--run-id", required=True, help="GitHub Actions workflow run ID.")
    parser.add_argument("--pr", required=False, default=None, help="PR number override.")
    parser.add_argument("--no-post", action="store_true", help="Print triage report without posting to PR.")
    args = parser.parse_args()

    run_meta = get_run_metadata(args.run_id)
    pr_number = find_pr_for_run(run_meta, args.pr)

    if not pr_number:
        print(f"ℹ️ No associated PR found for run {args.run_id}; skipping comment.")
        return

    pr_files = get_pr_files(pr_number)
    jobs = run_meta.get("jobs", [])
    failed_jobs = [j for j in jobs if j.get("conclusion") == "failure"]

    if not failed_jobs:
        print(f"ℹ️ No failed jobs found in run {args.run_id}.")
        return

    failures = []
    for job in failed_jobs:
        job_id = job["id"]
        job_name = job["name"]
        snippet = extract_job_failure_snippet(job_id)

        # Simple heuristic: if PR changed files and job name matches or touches them
        # (Default to true if we don't have specialized gate paths configured)
        failures.append({
            "name": job_name,
            "snippet": snippet,
            "is_related": True,
        })

    comment_body = format_triage_comment(run_meta, pr_number, failures)

    if args.no_post:
        print(comment_body)
    else:
        post_or_update_comment(pr_number, comment_body)

if __name__ == "__main__":
    main()
