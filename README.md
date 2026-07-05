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

A repo scanner for the specific mess that AI coding assistants leave behind: disabled RLS policies, auth checks that only exist in the happy path, `debug=True` still on, secrets copy-pasted from a tutorial, and the quieter stuff — one person owning half the codebase, commits that just say "fix," nobody writing down why anything is the way it is.

Point it at a repo, it runs six tools, you get one score and a full breakdown. Takes a few seconds. Fully local — nothing calls an LLM, nothing leaves your machine.

<table>
<tr>
<td width="33%" valign="top">

### 🔧 Technical debt
The code itself — security holes, duplicated logic, unfinished stubs. Caught by 54 custom Semgrep rules plus Bandit, pip-audit, and jscpd.

</td>
<td width="33%" valign="top">

### 🧠 Cognitive debt
Knowledge concentration — what happens if the one person who understands this leaves. Measured from real git history, not a guess.

</td>
<td width="33%" valign="top">

### 📝 Intent debt
Whether anyone wrote down *why*, so the next engineer (or the next AI agent) doesn't have to guess. Proxied from commit quality and refactor cadence.

</td>
</tr>
</table>

![demo](assets/demo-terminal.svg)

Real example: [`examples/sample-report.md`](examples/sample-report.md) — a scan of a real, public Next.js/Supabase SaaS starter, unedited. Nothing here is a mockup.

![sample report](assets/sample-report.png)

If you run this and it finds something real, a star helps other people find it too 👇

## Why this exists

By some counts, roughly 10,000 startups shipped a production app built mostly by an AI assistant in the last year or so. More than 8,000 of them are now looking at a partial rebuild. That gap — between "it works" and "it's fine to build on" — is what this tries to measure before it becomes a $50k+ surprise.

I built it deterministic on purpose. Every finding traces back to a specific rule and a specific line — no "the model thinks this looks risky," because that's not something you can hand to a VC doing diligence or argue with when it's wrong. (And it is sometimes wrong — see the note below about the auth-check rule.) Nothing in this pipeline calls out to an LLM. Nothing leaves your machine.

## The six tools, and what each one actually catches

| Tool | What it's for |
|---|---|
| Semgrep, 54 custom rules | The AI-specific stuff: disabled Supabase RLS, Flask SSTI via `render_template_string`, Django `DEBUG=True`, Rails mass-assignment via `params.permit!`, swallowed exceptions, `NotImplementedError` stubs that made it to main |
| Semgrep's own `p/django` + `p/flask` packs | Didn't want to hand-write every Django/Flask rule when Semgrep's community registry already covers XSS and mass-assignment better than I would |
| Bandit | Python security linting — hardcoded passwords, `pickle.loads`, that kind of thing |
| pip-audit | Checks your actual pinned dependency versions against known CVEs |
| jscpd | Copy-paste detection |
| gitleaks | Secrets anywhere in git history, not just the current snapshot — a key that was committed and deleted three months ago still counts |

Plus a small custom script (`scripts/git-mine.js`) that mines git log for the stuff none of the above can see: bus factor, generic commit messages, whether refactoring is actually happening or just piling up.

## Getting it running

**Option A — Docker, zero local installs:**
```bash
docker build -t ai-debt-audit .
docker run --rm -v /path/to/any/repo:/repo ai-debt-audit . --out ai-debt-report.md
```
All six tools ship pre-installed in the image — nothing to `pip install` yourself. One thing to know: any `--out`/`--html`/`--pdf` path needs to point *inside* `/repo` (the mounted volume) or the file vanishes with the container when it exits — `--out ai-debt-report.md` lands in the repo root on your host; `--out /tmp/report.md` would not.

**Option B — local install:**

You'll need these installed first:
```bash
pip install semgrep bandit pip-audit
```
and gitleaks — [instructions here](https://github.com/gitleaks/gitleaks#installing), it's a single binary, no package manager needed.

Then:
```bash
git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit
npm install
npm link
```

That last command makes `aidebt-scan` available anywhere on your machine. Try it on something:
```bash
aidebt-scan /path/to/any/repo
```

## What comes out

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

That's a real run, not a mockup. You get a Markdown report with every finding and a styled standalone HTML version, side by side, every time.

## Flags

```bash
aidebt-scan <path-to-repo> [--out report.md] [--html report.html] [--json scores.json]
                           [--sarif results.sarif] [--fail-on-score N] [--pdf report.pdf]
                           [--history history.json] [--diff base-ref] [--badge badge.json]
```

`--out` picks where the Markdown goes (`./ai-debt-report.md` if you don't say). `--html` does the same for the HTML version — pass `--html ""` if you don't want one. `--json` dumps the raw numbers, useful if you want to track a score over time instead of just reading one report. `--sarif` writes GitHub's native code-scanning format (see the GitHub Action below). `--fail-on-score N` exits non-zero if the composite score is `>= N` — the hook a CI pipeline needs to actually block something, not just print a number. `--pdf` renders the HTML report to an actual PDF via headless Chrome/Chromium (whichever is on `PATH`) — the format you'd actually hand someone as a deliverable.

`--history history.json` appends this run's score to a small local JSON file and shows the trend against the previous run right in the terminal summary — improving or worsening, not just a snapshot. Point it at the same file every time you scan a given repo and it becomes a running log.

`--diff main` scopes Semgrep/Bandit to only the files that actually changed vs `main` (or any ref), instead of the whole repo — faster, and it answers "did this PR add debt" instead of "what's wrong with everything." Falls back to a full scan if the ref can't be resolved. (git-mine/jscpd/gitleaks stay repo-wide regardless — bus factor and duplication are inherently whole-codebase questions, not per-file ones.)

`--badge badge.json` writes a [shields.io endpoint-badge](https://shields.io/badges/endpoint-badge) JSON file — commit it and reference `https://img.shields.io/endpoint?url=<raw-url-to-badge.json>` in your own README for a live AI-Debt score badge, the same way this repo does for itself (see the badge at the top of this file, regenerated by [`.github/workflows/self-scan.yml`](.github/workflows/self-scan.yml) on a schedule).

## Customizing the score with `.aidebtrc.json`

Drop this at the root of the repo being scanned to override the defaults:

```json
{
  "weights": { "technical": 0.6, "cognitive": 0.2, "intent": 0.2 },
  "ignoreRules": ["ai-debt-console-log-debug-leftover"],
  "excludePaths": ["vendor/**", "*/migrations/*"]
}
```

All three keys are optional. `weights` overrides the 50/25/25 default split (they don't need to sum to 1 — the composite is just a weighted average). `ignoreRules` drops specific rule IDs from scoring entirely, not just from the report. `excludePaths` does the same for whole paths, using simple glob patterns (`*` and `**`).

## Using it as a GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # required — see the warning below

- uses: aniruddhavasudev/ai-debt-audit@v1.1.1
  with:
    path: .
    fail-on-score: '70'   # optional — omit to report without blocking the PR
```

This runs the full scan on every PR, uploads findings to GitHub's Security tab as SARIF, and attaches the Markdown/HTML reports as workflow artifacts. See [`action.yml`](action.yml) for all inputs.

**`fetch-depth: 0` is not optional.** `actions/checkout`'s default (`fetch-depth: 1`, a single commit) silently wrecks the cognitive/intent debt scores — confirmed empirically: a shallow 50-commit clone of a mature, widely-contributed project scored cognitive debt at 86/100; the same repo with full history scored 37/100. It doesn't error, it just quietly produces a wrong number, because bus-factor and commit-message analysis both need real history to mean anything. The scanner detects a shallow clone and prints a warning both in the terminal and in the report if this happens anyway — but fixing the checkout step avoids the problem entirely.

## Using it as a Claude Code skill

This repo is also packaged as a Claude Code plugin ([`.claude-plugin/plugin.json`](.claude-plugin/plugin.json), [`skills/ai-debt-audit/SKILL.md`](skills/ai-debt-audit/SKILL.md)) — install it and Claude will know to run a real scan (not just describe one) when you ask it to audit a repo for AI-generated debt.

## License

[AGPL-3.0](LICENSE). Practically: you can use, modify, and self-host this freely, including commercially — the one condition is that if you run a modified version as a network service, you have to make your modified source available to the people using it. That's a deliberate choice, not the default permissive license — it means a competitor can't quietly fork this, rebrand it, and run a closed competing hosted version without giving back.

## About that `test-fixtures/` folder

It's full of fake credentials — a placeholder API key, AWS's own example access key, a Django `django-insecure-` dev key, a Flask secret that's just the word "secret" with numbers on it. That's on purpose, it's how I verified every rule actually fires instead of just parsing cleanly. If GitHub's secret scanner ever flags one of these, that's why — none of them are real.

## Where this actually stands

Honest version: the scoring weights (why technical debt counts for 50% and not 40%, why 20% duplication maxes out the duplication score) are a first pass, not something derived from a pile of calibration data yet. I tested it against a handful of real repos while building it and found real bugs this way — the "missing auth check" rule used to false-positive on any app using centralized middleware for auth, which is most of them, until I added a check for that. There's probably more like it I haven't found yet.

If you run this against your own repo and a finding looks wrong, that's more useful to me right now than a star.
