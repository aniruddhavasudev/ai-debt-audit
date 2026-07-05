# Usage guide

## Installing

**Docker (zero local installs):**
```bash
docker build -t ai-debt-audit .
docker run --rm -v /path/to/any/repo:/repo ai-debt-audit . --out ai-debt-report.md
```
All seven tools ship pre-installed. Output paths must point *inside* `/repo` (the mounted volume) or the file vanishes with the container — `--out ai-debt-report.md` lands in the repo root on your host; `--out /tmp/report.md` would not.

**Local install:**
```bash
pip3 install semgrep bandit pip-audit   # + gitleaks: https://github.com/gitleaks/gitleaks#installing

git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit && npm install && npm link

aidebt-scan /path/to/any/repo
```
`npm link` makes `aidebt-scan` available anywhere on your machine.

## All flags

```bash
aidebt-scan <path> [--out report.md] [--html report.html] [--json scores.json]
                   [--sarif results.sarif] [--csv csv-dir/] [--fail-on-score N] [--pdf report.pdf]
                   [--history history.json] [--diff base-ref] [--badge badge.json]
```

| Flag | What it does |
|---|---|
| `--out` | Markdown report path (default `./ai-debt-report.md`) |
| `--html` | Standalone HTML report path; pass `--html ""` to skip it |
| `--json` | Dumps raw scores — useful for tracking a score over time |
| `--sarif` | Writes GitHub's native code-scanning format, for the Security tab |
| `--csv csv-dir/` | Writes a small "workbook" of plain-language CSV files into that directory — `summary.csv` (one row per debt category, plain-English takeaway), `technical-debt.csv`, `knowledge-risk.csv`, and `missing-context.csv`. Severity is normalized to Critical/High/Medium/Low across every tool instead of each tool's own raw vocabulary, so it reads consistently in a spreadsheet |
| `--fail-on-score N` | Exits non-zero if the composite score is `>= N` — the hook a CI pipeline needs to actually block something |
| `--pdf` | Renders the HTML report via headless Chrome/Chromium (whichever is on `PATH`) — a deliverable format |
| `--history history.json` | Appends this run's score to a local JSON log and shows the trend vs. the previous run |
| `--diff main` | Scopes Semgrep/Bandit to files changed vs. `main` (or any ref) instead of the whole repo — answers "did this PR add debt," not "what's wrong with everything." Falls back to a full scan if the ref can't be resolved. git-mine/jscpd/gitleaks stay repo-wide regardless, since bus factor and duplication are inherently whole-codebase questions |
| `--badge badge.json` | Writes a [shields.io endpoint-badge](https://shields.io/badges/endpoint-badge) JSON file — commit it and reference it in your own README for a live score badge, the way this repo does for itself (see [`.github/workflows/self-scan.yml`](../.github/workflows/self-scan.yml)) |

## Customizing the score with `.aidebtrc.json`

Drop this at the root of the repo being scanned:

```json
{
  "weights": { "technical": 0.6, "cognitive": 0.2, "intent": 0.2 },
  "ignoreRules": ["ai-debt-console-log-debug-leftover"],
  "excludePaths": ["vendor/**", "*/migrations/*"]
}
```

All three keys are optional.
- `weights` overrides the default 50/25/25 split (they don't need to sum to 1 — the composite is a weighted average).
- `ignoreRules` drops specific rule IDs from scoring entirely, not just from the report.
- `excludePaths` does the same for whole paths, using simple glob patterns (`*` and `**`).

## Using it as a GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # required — see below

- uses: aniruddhavasudev/ai-debt-audit@v1.1.1
  with:
    path: .
    fail-on-score: '70'   # optional — omit to report without blocking the PR
```

This runs the full scan on every PR, uploads findings to GitHub's Security tab as SARIF, and attaches the Markdown/HTML reports as workflow artifacts. See [`action.yml`](../action.yml) for all inputs.

**`fetch-depth: 0` is not optional.** `actions/checkout`'s default (`fetch-depth: 1`, a single commit) silently wrecks the cognitive/intent debt scores — confirmed empirically: a shallow 50-commit clone of a mature, widely-contributed project scored cognitive debt at 86/100; the same repo with full history scored 37/100. It doesn't error, it just quietly produces a wrong number, because bus-factor and commit-message analysis both need real history to mean anything. The scanner detects a shallow clone and warns in the terminal and report if this happens anyway — but fixing the checkout step avoids the problem entirely.

## Using it as a Claude Code skill

This repo is also packaged as a Claude Code plugin ([`.claude-plugin/plugin.json`](../.claude-plugin/plugin.json), [`skills/ai-debt-audit/SKILL.md`](../skills/ai-debt-audit/SKILL.md)) — install it and Claude will run a real scan (not just describe one) when asked to audit a repo for AI-generated debt.

## About `test-fixtures/`

It's full of fake credentials — a placeholder API key, AWS's own example access key, a Django `django-insecure-` dev key, a Flask secret that's just the word "secret" with numbers on it. That's intentional: it's how every rule is verified to actually fire, not just parse cleanly. If GitHub's secret scanner ever flags one of these, that's why — none are real.
