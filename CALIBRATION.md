# Calibration notes

The scoring constants in `scripts/scoring.js` (category weights, saturation thresholds, the team-size damping curve) were set as reasonable starting points while building the tool, not derived from a large dataset. This document is the honest v1 snapshot of what's actually been tested — a handful of real repos, not the 10-15+ repo study that would be needed to treat these constants as validated. Update this file as more evidence comes in; don't treat any number here as final.

## What's been tested so far

| Repo | Composite | Tier | Technical | Cognitive | Intent | Authors | Bus-factor risk |
|---|---|---|---|---|---|---|---|
| This repo (excluding `test-fixtures/`), before the bot-author fix below | 39 | Medium | 27 | 97 | 6 | 3 (incl. a bot) | 0.97 |
| This repo (excluding `test-fixtures/`), after the fix | 27 | Medium | 27 | 48 | 6 | 2 (bot excluded) | 0.97 |
| `test-fixtures/flask` (deliberately bad) | 23 | **Low** | 45 | 0 | 0 | 1 | 1.00 |
| Express.js, shallow clone (50 commits) | 29 | Medium | 15 | 86 | 0 | 29 | 0.86 |
| Express.js, full history (6,153 commits) | 17 | Low | 12 | 37 | 5 | 388 | 0.37 |

Small sample, gathered incidentally while building rather than as a dedicated study — but three real, actionable findings came out of it, one of which was fixed the same day it was found (see Finding 3).

## Finding 1: git history depth changes the score more than almost anything else

Same repo (Express.js), same code, same commit — only the amount of fetched history differs, and the composite score moves from 17 (Low) to 29 (Medium), with cognitive debt alone moving from 37 to 86. This is covered in the README/action.yml as the "shallow clone" warning, but it's worth stating plainly here: **cognitive and intent debt are not properties of the code, they're properties of how much git history you gave the tool.** Comparing scores across two scans is only meaningful if both had comparably deep history. This is now detected and warned about (see `git-mine.js`'s `isShallowClone` check), but the underlying sensitivity is a real, structural property of these two categories, not a bug to "fix" away entirely.

## Finding 2: thin history can make a genuinely bad repo score deceptively low

`test-fixtures/flask` is deliberately riddled with real issues (SSTI, hardcoded secrets, `debug=True`, insecure deserialization) — its technical debt sub-score of 45/100 reflects that correctly. But because the fixture only has one commit and one author, cognitive and intent debt both score 0 (correctly, per the team-size damping logic — you can't have a "knowledge silo" problem with a single commit's worth of history). The result: a repo with real, serious security findings still lands in the **Low** overall risk tier, because cognitive+intent debt (50% of the composite) structurally can't be anything but 0 when history is this thin.

This is arguably correct behavior for what those two categories are actually measuring — but it means **the composite score alone is misleading for brand-new repos or repos with very little history**, exactly the population (freshly vibe-coded MVPs) this tool is often being run against. A user reading the composite number without reading the category breakdown could walk away with false reassurance. Two possible fixes worth considering, not yet implemented:
- Surface a prominent "insufficient history for cognitive/intent debt — technical debt score alone should be weighted more heavily" note when total commit count is below some threshold (similar to the existing shallow-clone warning).
- Re-normalize the composite formula to lean more on whichever categories have enough data to be meaningful, rather than a fixed 50/25/25 split regardless of data sufficiency.

## Finding 3: bot commits inflate "team size" without distributing real knowledge

This repo's own self-scan surfaced this: `github-actions[bot]` shows up as a distinct "author" (from the automated badge-update commits), which was enough to push the team-size damping factor to its maximum (1.0) — even though the bot only ever touches `badge.json` and contributes nothing to actual knowledge distribution across the codebase. The result was a cognitive debt score of 97/100, which is *technically* an accurate reading of "97% of files have only one human-equivalent author," but the *reason* it crossed the damping threshold (3 total authors) was a bot commit, not a second real contributor.

**Fixed the same day it was found.** `scoreCognitiveDebt` now excludes any author matching `/\[bot\]$/i` from the team-size count (see `scripts/scoring.js`), covering `github-actions[bot]`, `dependabot[bot]`, and the same convention most other bots follow. Re-running the self-scan after the fix: cognitive debt dropped from 97 to 48, composite from 39 to 27 — both now correctly reflecting "1 real human contributor" instead of being fooled by CI automation. Covered by a dedicated unit test (`scripts/score.test.js`) so this can't silently regress.

Not yet fixed. A reasonable improvement: exclude known bot author patterns (`*[bot]`, or a configurable allowlist) from the team-size count used for damping, since they don't represent real knowledge redundancy. Filed as a real, specific thing to fix rather than left as a vague "needs calibration" note — see `scripts/git-mine.js`'s `mineCommitMessages`/`mineBusFactor` for where the author-counting logic lives.

## Finding 4: AI-assisted authorship is measurable, but only disclosure-adjacent risk should be scored

`scripts/git-mine.js` now detects known AI coding tool signatures (Claude Code, GitHub Copilot, Cursor) directly from commit trailers — a measured fact ("X% of commits carry a Co-Authored-By trailer"), not an inference from code patterns like everything else in this tool. The tempting mistake would have been to score a high AI-assisted ratio as debt on its own — but a well-labeled, transparent trailer is *disclosure*, the opposite of a hidden risk. Penalizing it would punish the exact projects being honest about AI involvement, while a project that used just as much AI but never disclosed it (no trailer, same underlying risk) would score better purely for staying quiet.

The first version of this shipped as a fixed 70/30 proportional split (70% generic-message ratio, 30% AI-unexplained ratio) — caught immediately after by checking a repo with generic commit messages but zero AI-assisted commits: it scored *lower* than the pre-feature formula (35 instead of 50), purely because the new signal contributed 0 and diluted the old one's weight. That's wrong for the overwhelming majority of repos this tool scans, which have no AI-assisted commits at all.

Fixed as a same-day follow-up (the flawed version did merge and ran once via the scheduled self-scan — this repo's own `badge.json` briefly reflected the diluted score until this fix landed and re-ran). Commits that are both AI-assisted *and* generic/uninformative now count as 1.5x a plain generic commit toward the score, instead of the generic-message ratio being proportionally split with a separate AI ratio. This means a repo with zero AI-assisted-generic commits scores byte-identical to the pre-feature formula (100 × genericMessageRatio) — verified by a dedicated unit test — and only repos that actually have the compounding pattern (AI wrote it, nobody explained why) see any score change at all, and only upward. A repo that's 100% AI-assisted but every commit has a real explanation still scores 0 on this signal, since that's disclosed and reviewed, not hidden risk.

## What would make this a real calibration study instead of a snapshot

- 10-15+ repos spanning a genuine range: mature/well-maintained OSS, known-vibe-coded startups (if any become available for testing), and a few in between
- Consistent, full-history clones for every comparison (per Finding 1)
- A repo age/size stratification, since Finding 2 suggests very young repos need different handling than mature ones
- Ideally, some ground truth to calibrate against — e.g., repos that are already known (from a real rescue-engineering engagement, or public post-mortems) to have been expensive to maintain, to check whether the score would have predicted that
