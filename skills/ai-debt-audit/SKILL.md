---
name: ai-debt-audit
description: Scan a repository for AI-generated technical, cognitive, and intent debt. Use when the user asks to audit a codebase for AI/vibe-coding risk, check for issues an AI coding assistant may have introduced (disabled RLS, hardcoded secrets, missing auth checks, SSTI, debug mode left on), assess technical debt after heavy use of Copilot/Cursor/Claude/Lovable/Bolt, or wants a due-diligence-style debt score before a funding round, acquisition, or handoff.
---

# ai-debt-audit

Runs seven deterministic, fully local tools against a target repo and produces one composite 0-100 AI-Debt Score, broken into technical, cognitive, and intent debt. Nothing calls an LLM and no code leaves the machine — every finding traces to a specific rule and line, which is what makes it usable as evidence (a due-diligence report, a PR gate), not just a vibe check.

## When to use this skill

Trigger this when the user:
- Asks to "audit," "scan," or "check" a repo for AI-generated code quality/debt/risk
- Mentions vibe coding, Cursor/Copilot/Lovable/Bolt-generated code, and wants to know how bad it is
- Wants a score or report before a funding round, acquisition, handoff, or hiring decision
- Asks about disabled RLS, hardcoded secrets, missing auth checks, or similar AI-coding-assistant failure patterns specifically

Do not trigger for generic code review requests unrelated to AI-generated-code risk — use the project's normal code-review tooling for that.

## Prerequisites

Check these are installed before running; if missing, tell the user how to install rather than silently failing:
```bash
pip install semgrep bandit pip-audit   # gitleaks: https://github.com/gitleaks/gitleaks#installing
```
Node.js is also required (the CLI itself is a Node script).

## Running the scan

From this plugin's root directory:
```bash
node bin/aidebt-scan.js <path-to-target-repo> --out /tmp/ai-debt-report.md --html /tmp/ai-debt-report.html
```

Useful flags to know about (full list in the main README):
- `--diff <base-ref>` — scope to only files changed vs a branch/commit, much faster for "did this PR add debt"
- `--fail-on-score N` — for CI use; exits non-zero if the composite score is `>= N`
- `--pdf report.pdf` — client-deliverable PDF export (requires Chrome/Chromium on PATH)
- `--history history.json` — track the score over multiple scans and show the trend

## Presenting results to the user

1. Read the generated Markdown report (`--out` path) rather than re-deriving anything — it already contains the composite score, category breakdown, and every finding with file:line detail.
2. Lead with the composite score and risk tier, then the category breakdown (technical/cognitive/intent), then the highest-severity findings — don't dump the raw findings list first.
3. If the score seems surprisingly high or low, check whether `.aidebtrc.json` exists in the target repo (custom weights/exclusions) before assuming something's wrong with the scan itself.
4. Be honest that the underlying scoring constants are a v1 heuristic (this is stated directly in the report's own methodology footer) — don't present the score as more scientifically precise than it is.
5. If the user wants to act on findings, offer to open the flagged files and help fix them directly, rather than just repeating the report text back.
