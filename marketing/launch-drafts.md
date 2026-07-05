# Launch content drafts — for your review before posting

None of this has been posted anywhere. Everything below is a draft for you to read, edit, and post yourself under your own accounts — posting to Show HN, commenting on someone else's article, or opening a PR against a third-party repo are all actions that should go out as your own voice and judgment, not something done automatically on your behalf.

---

## Show HN

**Title options** (HN penalizes marketing-speak — plain and specific wins):
1. `Show HN: A deterministic scanner for AI-generated technical/cognitive/intent debt`
2. `Show HN: I built a tool that scores AI-debt in vibe-coded repos – no LLM calls, fully local`

**Body draft:**

> I kept seeing the same handful of bugs in AI-coded repos — disabled Supabase RLS, Flask apps with `debug=True` still on, auth checks that only exist in the happy path, secrets copy-pasted from a tutorial. So I built a scanner specifically for these AI-assistant-shaped failure modes, rather than generic code quality.
>
> It's deterministic on purpose — 44 Semgrep rules plus Bandit, pip-audit, jscpd, and gitleaks, blended into one score across three categories: technical debt (the code), cognitive debt (bus factor — is one person the only one who understands this), and intent debt (did anyone write down why). No LLM calls anywhere in the pipeline, nothing leaves your machine.
>
> It's also a GitHub Action now (`--diff` mode scopes it to just the changed files in a PR) and uploads SARIF to the Security tab.
>
> Genuinely interested in false positives/negatives if anyone runs it against their own repo — the scoring constants are a v1 heuristic, not derived from a big calibration dataset yet, and I'd rather know what's wrong now.
>
> [link to repo]

**Timing note from the original brief:** stars follow spikes, not drips — post this the same day as any teardown/announcement content, not spread across a week.

---

## Comment draft — Addy Osmani's "Comprehension Debt" post

Real post found: https://medium.com/@addyosmani/comprehension-debt-the-hidden-cost-of-ai-generated-code-285a25dac57e — this is the actual originating piece that coined "comprehension debt," which the project's tagline directly builds on. A genuine, non-spammy comment here should reference his framing specifically, not just drop a link.

**Draft:**

> This maps closely to something I've been calling "intent debt" in a scanner I built — the idea that comprehension debt often traces back to a specific, detectable root: nobody wrote down *why* the code is the way it is, so neither the next engineer nor the next AI agent can reconstruct intent without guessing. I ended up building automatic proxies for it (bus factor, commit message quality, refactor-commit ratio) alongside more traditional technical-debt signals, specifically for AI-generated code. Curious whether you've seen teams try to measure comprehension debt directly rather than just naming the problem — that was the harder part for me. [link]

---

## Awesome-list PR entries

**Target: [VahidN/awesome-static-analysis](https://github.com/VahidN/awesome-static-analysis)** (the most established fork of this list; companion site analysis-tools.dev)

Likely correct section: a general/multi-language or "security" category, given this tool spans JS/TS/Python and isn't single-language. Check the actual current README structure before opening the PR — list conventions shift.

**Suggested entry line (matches typical awesome-list format: name, one-line description):**
```markdown
- [ai-debt-audit](https://github.com/aniruddhavasudev/ai-debt-audit) - Deterministic scanner for AI-generated technical/cognitive/intent debt (JS/TS, Python) — Semgrep, Bandit, pip-audit, jscpd, gitleaks blended into one score. Fully local, no LLM calls.
```

**PR description draft:**
> Adding ai-debt-audit — a static analysis tool specifically targeting failure patterns from AI coding assistants (disabled RLS, missing auth checks, SSTI, hardcoded secrets from tutorials) rather than generic code quality. Deterministic (Semgrep + Bandit + gitleaks + jscpd + pip-audit, no LLM calls), ships as a CLI, GitHub Action, and Claude Code skill.

Also worth checking: `lukehutch/awesome-static-analysis` (a separate, also-active fork) — may be worth a second PR if its README structure differs enough to need a distinct entry placement.

**Target: [sdras/awesome-actions](https://github.com/sdras/awesome-actions)** — the primary, most well-known curated list of GitHub Actions specifically (different audience than the static-analysis lists above — people browsing this list are looking for CI/workflow tooling, not general code-quality tools).

**Suggested entry line:**
```markdown
- [ai-debt-audit](https://github.com/aniruddhavasudev/ai-debt-audit) - Scan a repo for AI-generated technical/cognitive/intent debt on every PR. Deterministic (Semgrep, Bandit, pip-audit, jscpd, gitleaks — no LLM calls), uploads SARIF to the Security tab, supports --diff mode for fast PR-scoped scans.
```

**PR description draft:**
> Adding ai-debt-audit — a GitHub Action that scans for the specific failure patterns AI coding assistants introduce (disabled RLS, missing auth checks, SSTI, hardcoded secrets, mass assignment) rather than generic code quality. Runs fully local/deterministic, uploads findings as SARIF to the Security tab, and supports `--diff` mode to scope PR checks to just the changed files.

---

## What I didn't draft

Reddit posts (r/programming, r/webdev) and a Twitter/X thread weren't drafted here — let me know if you want those too, but Show HN + the Medium comment + awesome-list PRs are the highest-leverage three from the original plan and worth testing first before spreading effort thinner.
