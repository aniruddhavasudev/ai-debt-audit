# ai-debt-audit

How much AI-generated debt is hiding in your codebase?

AI-generated code contains 1.7x more issues per pull request than human-written code, and technical debt rises 30-41% in the year after teams adopt AI coding assistants. `ai-debt-audit` scans a repo and produces a single, explainable score across three kinds of debt:

- **Technical debt** — the code itself: security holes, duplicated logic, unfinished stubs
- **Cognitive debt** — how concentrated the knowledge is (what happens if the one person who understands this leaves)
- **Intent debt** — whether anyone wrote down *why*, so the next person (or the next AI agent) doesn't have to guess

Every finding is deterministic and explainable — a specific rule, a specific line, a specific reason. Nothing is a model's opinion that changes between runs, and **no code ever leaves your machine.** Every tool in the pipeline runs entirely locally.

## What it runs

Six tools, all free and open-source, in one pass:

| Tool | What it checks |
|---|---|
| [Semgrep](https://semgrep.dev/) (44 custom rules) | AI-specific smells: disabled Supabase RLS, hallucinated Next.js auth checks, Flask SSTI, Django `DEBUG=True`, silently-swallowed errors, placeholder stubs |
| Semgrep official `p/django` + `p/flask` packs | Broader framework-specific coverage (XSS, mass assignment, open redirects) |
| [Bandit](https://bandit.readthedocs.io/) | Python security (hardcoded secrets, insecure deserialization, weak crypto) |
| [pip-audit](https://github.com/pypa/pip-audit) | Known-CVE scanning of your actual pinned dependency versions |
| [jscpd](https://github.com/kucherenko/jscpd) | Copy-paste/duplication detection |
| [gitleaks](https://github.com/gitleaks/gitleaks) | Secrets committed anywhere in git *history*, not just current files |
| `scripts/git-mine.js` (custom) | Bus-factor/knowledge-concentration and commit-message quality — the cognitive/intent debt signals nothing else measures |

## Quick start

**Prerequisites** (install once):
```bash
pip install semgrep bandit pip-audit
# gitleaks: https://github.com/gitleaks/gitleaks#installing
```

**Install and run:**
```bash
git clone <this-repo-url>
cd ai-debt-audit
npm install
npm link            # makes `aidebt-scan` available globally

aidebt-scan /path/to/any/repo
```

## Sample output

```
AI-Debt Scan — /path/to/repo

✓ Semgrep (technical debt) (3500ms)
✓ git-mine (cognitive + intent debt) (34ms)
✓ jscpd (duplication) (46ms)
✓ gitleaks (historical secrets) (141ms)
✓ bandit (Python security) (140ms)
✓ Scoring (26ms)

────────────────────────────────────────────────────────
  AI-DEBT REPORT
────────────────────────────────────────────────────────
  Composite Score: 28/100   [Medium Risk]
────────────────────────────────────────────────────────
  Technical debt   ███░░░░░░░░░░░░░░░░░░░░░   14/100  (50%)
  Cognitive debt   ███████████████████░░░░░   81/100  (25%)
  Intent debt      █░░░░░░░░░░░░░░░░░░░░░░░    3/100  (25%)
────────────────────────────────────────────────────────
  Markdown: ai-debt-report.md
  HTML:     ai-debt-report.html
────────────────────────────────────────────────────────
```

`aidebt-scan` writes both a Markdown report (every finding, full detail) and a standalone styled HTML report by default.

## Usage

```bash
aidebt-scan <path-to-repo> [--out report.md] [--html report.html] [--json scores.json]
```

- `--out` — Markdown report path (default: `./ai-debt-report.md`)
- `--html` — HTML report path (default: same name, `.html`; pass `--html ""` to skip)
- `--json` — also dump the raw numeric scores as JSON

## A note on `test-fixtures/`

This repo's `test-fixtures/` directory contains **deliberately fake credentials** (placeholder API keys, an AWS example key, a Django `django-insecure-` dev key) used to verify the detection rules actually fire against real trigger patterns. None of them are real secrets.

## Status

This is v1. The scoring constants (category weights, saturation thresholds) are an initial heuristic pending calibration against a broader set of real-world repos — see the comments in `scripts/score.js` for exact formulas. Feedback on findings that feel wrong (false positives or things it missed) is genuinely useful right now.
