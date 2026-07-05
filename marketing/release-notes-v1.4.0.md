# v1.4.0 — GitHub Marketplace launch

Scan a repo for AI-generated technical, cognitive, and intent debt — deterministic, fully local, no LLM calls. Built specifically for the failure patterns AI coding assistants leave behind (disabled Supabase RLS, Flask SSTI, Django `DEBUG=True`, Rails mass assignment, missing auth checks, silently swallowed errors) rather than generic code quality.

## Use it as a GitHub Action

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # required — see below

- uses: aniruddhavasudev/ai-debt-audit@v1.4.0
  with:
    path: .
    fail-on-score: '70'   # optional — omit to report without blocking the PR
```

Runs on every PR, uploads findings to GitHub's Security tab as SARIF, attaches Markdown/HTML/PDF reports as artifacts, and can gate the check on a score threshold. `--diff` mode scopes it to just the changed files for fast, PR-relevant runs.

**`fetch-depth: 0` is not optional** — the default shallow checkout silently produces wrong cognitive/intent debt scores (confirmed empirically: 86/100 shallow vs 37/100 with full history on the same repo). The action detects and warns if this happens, but setting it correctly avoids the problem entirely.

## What's under the hood

54 custom Semgrep rules across JavaScript/TypeScript, Python, and Ruby (Next.js/Supabase, Django, Flask, and Rails specifically), plus Bandit, pip-audit, jscpd, and gitleaks — blended into one composite 0-100 score across three categories:

- **Technical debt** — the code itself
- **Cognitive debt** — knowledge concentration (bus factor)
- **Intent debt** — whether anyone documented *why*

Every finding traces to a specific rule and line. Nothing calls an LLM; nothing leaves the runner.

## Also available as

- A CLI (`npx`/`npm link`) for local use
- A Docker image with all six tools pre-installed
- A Claude Code plugin/skill

## License

AGPL-3.0 — free to use, self-host, and modify, including commercially. If you run a modified version as a network service, you're required to release your modifications too.

Full docs: [README](https://github.com/aniruddhavasudev/ai-debt-audit#readme) · Feedback on false positives/negatives is genuinely the most useful thing you can send right now — see [CONTRIBUTING.md](https://github.com/aniruddhavasudev/ai-debt-audit/blob/main/CONTRIBUTING.md).
