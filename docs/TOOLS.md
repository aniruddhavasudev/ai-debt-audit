# The seven tools

`ai-debt-audit` doesn't reinvent detection — it orchestrates seven existing, deterministic tools and layers AI-debt-specific rules and scoring on top.

| Tool | Catches |
|---|---|
| **Semgrep**, 74 custom rules | AI-specific patterns: disabled Supabase RLS, Flask SSTI via `render_template_string`, Django `DEBUG=True`, Rails mass-assignment via `params.permit!`, Go's silently swallowed `if err != nil {}`, Spring's `.csrf().disable()`, stub `NotImplementedError`s left in main |
| Semgrep registry packs — `p/django`, `p/flask`, `p/golang`, `p/java` | Broader framework-specific coverage the community registry already does well (`p/spring` doesn't exist as a pack, so Spring gets custom rules only) |
| **Bandit** | Python security linting — hardcoded passwords, `pickle.loads`, etc. |
| **pip-audit** | Pinned Python dependency versions vs. known CVEs |
| **npm audit** | Same for JS/TS, run directly against `package-lock.json` — never installs the target's dependencies, so it never executes an untrusted repo's install scripts |
| **jscpd** | Copy-paste detection |
| **gitleaks** | Secrets anywhere in git history, not just the current snapshot — a key committed and deleted three months ago still counts |

Plus [`scripts/git-mine.js`](../scripts/git-mine.js), a custom script mining `git log` for what none of the above can see: bus factor, generic commit messages, whether refactoring is happening or just piling up, and which commits carry a known AI coding tool's own signature (Claude Code, GitHub Copilot, Cursor) — measured directly from commit trailers, not inferred from code patterns like everything else here.

## How the score is composed

- **Technical debt (50%)** — Semgrep (35%), Bandit (15%), duplication (15%), historical secrets (20%), dependency vulns (15%)
- **Cognitive debt (25%)** — bus factor from real git history (bot authors excluded)
- **Intent debt (25%)** — generic/uninformative commit messages (70%) blended with AI-assisted commits that are *also* generic (30%) — a disclosed AI-assisted commit with a real explanation isn't penalized; one with neither is the unreviewed-dump pattern this exists to catch. Refactor cadence is reported as a trend indicator but not currently scored.

Every constant above is a v1 heuristic, not yet calibrated against a large repo sample — see [CALIBRATION.md](../CALIBRATION.md) for the real findings so far.
