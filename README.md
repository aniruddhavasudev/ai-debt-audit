<div align="center">
  <img src="assets/logo.svg" width="120" height="120" alt="ai-debt-audit logo">

  # ai-debt-audit

  **Measure comprehension debt in AI-generated code.**

  [![CI](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
  ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
  ![PRs welcome](https://img.shields.io/badge/PRs-welcome-blueviolet)
  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)
  [![AI-Debt Score](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json)](https://github.com/aniruddhavasudev/ai-debt-audit/blob/main/examples/sample-report.md)

  *That last badge is this repo scanning itself, on a schedule — a live number, not a claim.*
</div>

---

A repo scanner for the mess AI coding assistants leave behind: disabled RLS, auth checks that only exist in the happy path, `debug=True` left on, tutorial-pasted secrets — plus the quieter stuff, one person owning half the codebase, commits that just say "fix."

Point it at a repo, it runs seven tools, you get one score and a full breakdown. Fully local — nothing calls an LLM, nothing leaves your machine.

<table>
<tr>
<td width="33%" valign="top">

### 🔧 Technical debt
Security holes, duplicated logic, unfinished stubs. 74 custom Semgrep rules + Bandit, pip-audit, npm audit, jscpd.

</td>
<td width="33%" valign="top">

### 🧠 Cognitive debt
Knowledge concentration — what happens if the one person who understands this leaves. Measured from real git history.

</td>
<td width="33%" valign="top">

### 📝 Intent debt
Whether anyone wrote down *why*. Proxied from commit quality and refactor cadence.

</td>
</tr>
</table>

![demo](assets/demo-terminal.svg)

Real example: [`examples/sample-report.md`](examples/sample-report.md) — a scan of a real, public Next.js/Supabase SaaS starter, unedited.

![sample report](assets/sample-report.png)

If you run this and it finds something real, a star helps other people find it too 👇

## The seven tools

| Tool | Catches |
|---|---|
| Semgrep, 74 custom rules | AI-specific patterns: disabled Supabase RLS, Flask SSTI, Django `DEBUG=True`, Rails mass-assignment, Go's swallowed `if err != nil {}`, Spring's `.csrf().disable()`, stub `NotImplementedError`s left in main |
| Semgrep registry packs (`p/django`, `p/flask`, `p/golang`, `p/java`) | Broader framework-specific coverage |
| Bandit | Python security linting |
| pip-audit / npm audit | Pinned dependency versions vs. known CVEs (Python / JS) |
| jscpd | Copy-paste detection |
| gitleaks | Secrets anywhere in git history, not just the current snapshot |

Plus `scripts/git-mine.js`, a custom script mining git log for bus factor, generic commit messages, and refactor cadence.

## Getting it running

**Docker (zero local installs):**
```bash
docker build -t ai-debt-audit .
docker run --rm -v /path/to/any/repo:/repo ai-debt-audit . --out ai-debt-report.md
```
Output paths must point *inside* `/repo` or they vanish with the container.

**Local install:**
```bash
pip install semgrep bandit pip-audit   # + gitleaks: https://github.com/gitleaks/gitleaks#installing

git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit && npm install && npm link

aidebt-scan /path/to/any/repo
```

## What comes out

```
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
A real run, not a mockup — Markdown + styled standalone HTML, every time.

## Flags

```bash
aidebt-scan <path> [--out report.md] [--html report.html] [--json scores.json]
                   [--sarif results.sarif] [--fail-on-score N] [--pdf report.pdf]
                   [--history history.json] [--diff base-ref] [--badge badge.json]
```

| Flag | What it does |
|---|---|
| `--out` / `--html` | Report paths (pass `--html ""` to skip) |
| `--json` | Raw scores, for tracking over time |
| `--sarif` | GitHub code-scanning format (see Action below) |
| `--fail-on-score N` | Exit non-zero if composite score `>= N` — the CI gate |
| `--pdf` | Renders the HTML report via headless Chrome, for handing off as a deliverable |
| `--history` | Appends this run's score to a JSON log, shows trend vs. last run |
| `--diff <ref>` | Scopes Semgrep/Bandit to changed files only — "did this PR add debt" instead of a full rescan |
| `--badge` | Writes a [shields.io endpoint-badge](https://shields.io/badges/endpoint-badge) JSON, like the one at the top of this file |

## Customizing with `.aidebtrc.json`

Drop this at the scanned repo's root:

```json
{
  "weights": { "technical": 0.6, "cognitive": 0.2, "intent": 0.2 },
  "ignoreRules": ["ai-debt-console-log-debug-leftover"],
  "excludePaths": ["vendor/**", "*/migrations/*"]
}
```

All keys optional. `weights` overrides the 50/25/25 split. `ignoreRules` drops rule IDs from scoring entirely. `excludePaths` does the same for whole paths (`*`/`**` globs).

## As a GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # required — see below

- uses: aniruddhavasudev/ai-debt-audit@v1.1.1
  with:
    path: .
    fail-on-score: '70'   # optional — omit to report without blocking the PR
```

Runs the scan on every PR, uploads SARIF to GitHub's Security tab, attaches Markdown/HTML as artifacts. Full inputs in [`action.yml`](action.yml).

**`fetch-depth: 0` is not optional.** A shallow clone silently wrecks cognitive/intent scores — confirmed empirically, a 50-commit shallow clone scored cognitive debt 86/100 vs. 37/100 with full history. The scanner warns if this happens, but fixing the checkout step avoids it entirely.

## As a Claude Code skill

Packaged as a Claude Code plugin ([`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), [`skills/ai-debt-audit/SKILL.md`](skills/ai-debt-audit/SKILL.md)) — install it and Claude runs a real scan when asked to audit a repo for AI-generated debt.

## License

[AGPL-3.0](LICENSE) — use, modify, and self-host freely, including commercially. If you run a modified version as a network service, you must share your modified source with its users. That's deliberate: it stops a silent closed-source fork of a hosted competitor.

## Notes

- **`test-fixtures/`** is full of intentionally fake credentials (placeholder keys, AWS's own example key, Django/Flask dev secrets) — that's how every rule is verified to actually fire. None are real.
- **Scoring weights are a v1 heuristic**, not yet calibrated against a large repo sample. See [CALIBRATION.md](CALIBRATION.md) for real findings so far, including the shallow-clone effect above and a bot-commit bug (found via this repo's own self-scan, fixed same-day) that was inflating knowledge-concentration scores.
- If a finding looks wrong against your own repo, that's more useful to report than a star.
