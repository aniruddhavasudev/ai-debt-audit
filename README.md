# ai-debt-audit

[![CI](https://img.shields.io/github/actions/workflow/status/aniruddhavasudev/ai-debt-audit/ci.yml?label=CI)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/ai-debt-audit)](https://www.npmjs.com/package/ai-debt-audit)
[![license](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![self-scan](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json)](examples/sample-report.md)

AI assistants ship code fast; the garbage ships faster. `ai-debt-audit` catches what they leave behind — security shortcuts, secrets buried in git history, files only one person has ever touched, commits that never say why — and turns it into one 0–100 score with every finding traced to a file and line. Fully local, no LLM in the loop, deterministic.

## What a scan looks like

Real output, scanning a deliberately vibe-coded fixture repo:

```
$ aidebt-scan .

→ Semgrep (technical debt)...            ✓ (4.6s)
→ git-mine (cognitive + intent debt)...  ✓ (47ms)
→ jscpd (duplication)...                 ✓ (36ms)
→ gitleaks (historical secrets)...       ✓ (80ms)
→ bandit (Python security)...            ✓ (156ms)
→ pip-audit (dependency vulns)...        ✗ skipped — no requirements.txt
→ npm audit (dependency vulns)...        ✗ skipped — no package.json
→ Scoring...                             ✓

────────────────────────────────────────────────────────
  AI-DEBT REPORT
────────────────────────────────────────────────────────
  Composite Score: 52/100   [High Risk]
────────────────────────────────────────────────────────
  Technical debt   ███████░░░░░░░░░░░░░░░░░   31/100  (50%)
  Cognitive debt   ████████████████████████  100/100  (25%)
  Intent debt      ███████████░░░░░░░░░░░░░   44/100  (25%)
────────────────────────────────────────────────────────
```

And a few of the findings behind those numbers, verbatim from the Markdown report the scan writes:

```
- [ERROR]   ai-debt-insecure-pickle-loads — smelly.py:7 — pickle.loads() on data that may
            originate outside the process ... a direct remote-code-execution primitive
- [WARNING] ai-debt-empty-catch-block-js — smelly.js:2 — Empty catch block. AI-generated code
            frequently wraps calls in try/catch to "make the error go away"
- aws-access-token in config.py:1 (commit e9c688b3)   ← deleted from the code, still in history
- 1 AI-assisted commit that is *also* generic/uninformative ("update", Co-Authored-By: Claude)
```

## Install and first scan

```bash
npx ai-debt-audit /path/to/repo
```

Or, from source in one command: `curl -fsSL https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/install.sh | bash`

That's a complete scored scan with nothing installed beyond Node — git-history analysis, duplication, and dependency checks all run; the report states exactly which optional checks were skipped. For the full ruleset (74 AI-debt Semgrep patterns, Python security, secrets in git history):

```bash
pip3 install semgrep bandit pip-audit   # + gitleaks: github.com/gitleaks/gitleaks#installing
```

Every scan writes Markdown, HTML, PDF, and a CSV workbook by default. Add `--json scores.json` for machine-readable output. Full flag reference: [docs/USAGE.md](docs/USAGE.md).

## The detectors

**1. AI-pattern static analysis** — 74 custom Semgrep rules plus Bandit, targeting the specific shortcuts LLMs take: `subprocess.call(cmd, shell=True)` because it's the path of least resistance, `except: pass` to make an error disappear, `pickle.loads()` on request data, Flask `debug=True` left on, Supabase RLS disabled, `eval()` in glue code. These aren't generic lint rules — each one encodes a failure mode observed in AI-generated code, and each fires with a file:line and an explanation of why it matters.

```python
def run(cmd, payload):
    subprocess.call(cmd, shell=True)   # ← ai-debt-subprocess-shell-true: shell injection
    return pickle.loads(payload)       # ← ai-debt-insecure-pickle-loads: RCE primitive
```

**2. Git-history mining** — reads `git log` directly, no external tool. Bus factor: which files has only one person ever touched (with team-size damping, so a solo repo isn't penalized for being solo). Giant-dump commits: 15+ files or 500+ churned lines landed in one shot — the "wasn't reviewed incrementally" pattern. AI-assisted commits: measured from real `Co-Authored-By` trailers (Claude Code, Copilot, Cursor), not inferred from style. A disclosed AI commit with a real message costs nothing; an AI commit whose message is `update` is exactly the unreviewed-dump pattern and scores accordingly.

```
commit 3f2a1c9   Carol Dev
    update                                          ← generic message
    Co-Authored-By: Claude <noreply@anthropic.com>  ← AI-assisted + unexplained: compounds
```

**3. Historical secret scanning** — gitleaks over the full commit history, not the current snapshot. A credential committed once and deleted the next day is still recoverable by anyone who clones the repo; snapshot-only scanners never see it. In the sample above the AWS key lives only in commit `e9c688b3` — the working tree is clean.

```python
# committed in Jan, deleted in Feb, findable forever:
AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCyEXAMPLEKEY"
```

**4. Duplication and dependency risk** — jscpd for copy-paste mass (AI assistants regenerate similar blocks instead of extracting shared code), plus `npm audit` and `pip-audit` for known-vulnerable dependencies. The npm check works on repos that never committed a lockfile — most JS libraries — by deriving one from `package.json` in a temp directory with `--ignore-scripts`, so scanning an untrusted repo never executes its install hooks.

Scoring: technical debt (the blend of the above) is 50% of the composite; knowledge concentration is 25%; commit-message intent is 25%. A tool that didn't run has its weight redistributed — never averaged in as a phantom zero. Every constant is a documented v1 heuristic; the score is calibrated against [50 real open-source repos](CALIBRATION_50_REPOS.md) (50/50 scanned, zero failures, all scores landing 2–43 where mature OSS should).

## CI/CD

Fail a PR when the score crosses a threshold. The exit code is the contract: non-zero when `composite >= N`.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0        # required — a shallow clone silently distorts history-based scores

- uses: aniruddhavasudev/ai-debt-audit@main
  with:
    path: .
    fail-on-score: '50'   # block the PR at Medium/High boundary
    diff: ${{ github.event.pull_request.base.sha }}   # scan only what this PR changed
```

The action also uploads findings as SARIF to GitHub's Security tab and attaches the full report as a workflow artifact. From a plain shell: `aidebt-scan . --fail-on-score 50`.

## Claude Code plugin

```
/plugin marketplace add aniruddhavasudev/ai-debt-audit
/plugin install ai-debt-audit@ai-debt-audit
```

Then ask in plain language — "audit this repo for AI-generated debt" — and Claude runs the actual scanner and walks you through the findings. Setup details: [docs/USAGE.md](docs/USAGE.md#using-it-as-a-claude-code-plugin).

## JSON output

`--json scores.json` emits a stable schema for tooling (same keys and types every run; a tool that didn't run is `null`, never a fabricated zero — the distinction matters if you aggregate):

```jsonc
{
  "composite": 52,                  // 0-100, higher = more debt
  "tier": "High",                   // Low | Medium | High | Critical
  "technical": { "score": 31, "blendedScore": 31, "byCategory": {...}, "totalFindings": 9 },
  "duplication":       { "score": 12, "percentage": 2.4, "clonePairs": [...] },   // or null
  "historicalSecrets": { "score": 25, "leakCount": 1, "leaks": [...] },           // or null
  "bandit":            { "score": 18, "totalFindings": 4, "top": [...] },         // or null
  "dependencyVulns":   null,        // null = didn't apply (no manifests found)
  "cognitive": { "score": 100, "busFactorRiskRatio": 1, "totalAuthors": 3,
                 "riskyFiles": [...], "giantDumpCommits": 1, "giantDumpCommitList": [...] },
  "intent":    { "score": 44, "genericCommits": [...], "aiAssistedCommits": 1,
                 "aiToolCounts": { "Claude Code": 1 }, "aiAssistedGenericCommits": 1 },
  "weights":   { "technical": 0.5, "cognitive": 0.25, "intent": 0.25 }
}
```

The schema is enforced by tests; breaking changes to it are treated as breaking releases.

## Limitations

Honest list — these are measured, not hypothetical:

- **The score is a v1 heuristic.** Weights and saturation constants are documented starting points, calibrated for sanity (stable, bounded, reproducible) against 50 real repos — not derived from labeled outcome data. Treat it as a triage signal, not a verdict.
- **It cannot tell you whether code was AI-written.** Trailer detection measures *disclosed* AI assistance only; undisclosed AI code is indistinguishable from human code, and the tool doesn't pretend otherwise.
- **Historical-secret findings on open-source repos are noisy.** In the 50-repo calibration, 29 repos had gitleaks hits — overwhelmingly test fixtures and example keys. On a private codebase the signal is much stronger. Findings are capped in the score and always need human review.
- **Python dependency scanning requires `requirements.txt`.** `pyproject.toml`-only projects are skipped, because resolving those dependencies means building the project, which executes its code — a line this scanner doesn't cross.
- **Known false positive:** the Flask CORS rule matches its own pattern text inside Semgrep rule YAML files, so repos that *contain* Semgrep rules get a spurious hit.
- **History-based scores need history.** A shallow clone (`fetch-depth: 1`, the GitHub Actions default) distorts cognitive/intent scores badly — measured at 86/100 shallow vs 37/100 full on the same repo. The scanner detects this and warns, but can't fix your checkout.
- **Linux/macOS only.** Tool discovery uses `which`; native Windows isn't supported (WSL works).

## Roadmap

- **npm publish** so `npx ai-debt-audit` resolves without a clone (package is ready; name is reserved-free)
- **GitHub Action marketplace listing** — the action exists and works from a ref; marketplace packaging is next
- **More detectors**: Rust and C# rule packs, lockfile-less Python dependency resolution via PyPI metadata, PR-comment output mode
- **Hosted dashboard** for tracking scores across an org's repos over time (the CLI stays free and local; AGPL protects exactly this boundary)

## Recording a demo

Two options, both scanning the same reproducible fixture (`node scripts/make-demo-repo.mjs /tmp/demo-app`):

- **vhs** (GIF): `vhs assets/demo.tape` → `assets/demo.gif`
- **asciinema**: a real recorded cast is at `assets/demo.cast` — play with `asciinema play assets/demo.cast`, or convert to GIF with [agg](https://github.com/asciinema/agg): `agg assets/demo.cast assets/demo.gif`

## License

AGPL-3.0. Free to use, modify, and self-host, commercially included; offering a modified version as a hosted service requires sharing changes back. See [LICENSE](LICENSE).
