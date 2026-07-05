# Contributing

This is early — the scoring constants are a v1 heuristic (see the methodology note at the bottom of every report), and the rule coverage is intentionally narrow (Next.js/Supabase + Django/Flask). Both are the areas where contributions matter most right now.

## The fastest way to contribute

Run `aidebt-scan` against a repo you know well and tell me what's wrong: a finding that shouldn't have fired, something obviously AI-generated that it missed, a score that felt wrong for what you know about the codebase. That feedback is worth more right now than any single PR — see [`scripts/score.js`](scripts/score.js) for exactly how the score is computed if you want to argue with a specific number.

## Setting up locally

```bash
git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit
npm install
pip install semgrep bandit pip-audit   # gitleaks: https://github.com/gitleaks/gitleaks#installing
npm link
```

Before opening a PR, run the same checks CI runs:
```bash
semgrep --validate --config rules/       # rule syntax
node scripts/test-rules.js               # rule regression tests (do the Semgrep rules actually fire?)
node --test scripts/score.test.js        # scoring engine unit tests (is the math right?)
node bin/aidebt-scan.js test-fixtures/flask --out /tmp/report.md   # full pipeline smoke test
```

The unit tests earn their keep: they caught a real bug during development where a single Bandit HIGH and MEDIUM finding scored identically (both saturated to 100 with only 1 file scanned) because the saturation constant was miscalibrated for small scans — exactly the common case in `--diff` mode.

## Adding a Semgrep rule

Every rule should trace to a *specific, observed AI failure mode* — not a generic lint rule already covered by ESLint/Pylint/SonarQube (see [`rules/README.md`](rules/README.md)). If you add a rule:
1. Add it to the relevant file in `rules/` with `ai_debt_category` and `weight` metadata (see any existing rule for the pattern).
2. Add a real trigger case to `test-fixtures/` — not a hypothetical, an actual snippet that reproduces the pattern.
3. Add the rule ID to `EXPECTED_RULE_IDS` in `scripts/test-rules.js` so CI catches future regressions the way it caught [a real bug](https://github.com/aniruddhavasudev/ai-debt-audit/commit/05b3430) during development (a rule that excluded test-fixture paths from the hardcoded-secret check, defeating its own purpose).
4. Run `semgrep --validate --config rules/` and `node scripts/test-rules.js` before opening the PR.

## Good first issues (not yet filed as GitHub issues — pick one, or ping me and I'll file it properly with a label)

- **Go rule coverage** — currently only the generic placeholder-comment rule applies to Go at all.
- **`--diff` mode for jscpd** — duplication currently always scans the whole repo even in `--diff` mode; scoping it to compare changed files against the rest of the codebase (not just against each other) would make CI runs faster without losing signal.
- **A second real-repo calibration pass** — the saturation constants in `scripts/score.js` were set from testing against a small number of repos. Running the scanner against a broader set (a mix of mature OSS projects and known vibe-coded ones) and proposing constant adjustments with the actual score distributions attached would be extremely useful.
- **Windows compatibility check** — the CLI has only been tested on Linux; path handling (`path.join`/`path.relative`) *should* be cross-platform-safe since it's all done through Node's `path` module rather than manual string concatenation, but this hasn't actually been verified on Windows.
- **`excludePaths` glob correctness** — the current implementation (`scripts/score.js`, `globToRegExp`) is a small hand-rolled glob-to-regex converter, not a full glob spec. Edge cases (character classes, brace expansion) aren't supported. Either documenting the real limits clearly or swapping in a minimal, dependency-free proper glob matcher would help.

## What not to send

- Generic code-quality rules with no specific tie to an AI-generated-code failure mode (that's what SonarQube/Codacy are for — see the "why not reinvent the wheel" reasoning in the project history).
- Rules without a real trigger fixture — a rule that only "looks right" but was never proven to fire is exactly the kind of bug this project has already been bitten by twice during development.
