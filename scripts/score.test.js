#!/usr/bin/env node
// Unit tests for the pure scoring functions in score.js — complements
// scripts/test-rules.js (which tests whether Semgrep *rules* fire) by
// testing the *math* that turns findings into a score. Uses Node's
// built-in test runner (node:test, available since Node 18) — no new
// dependency for a project that's otherwise deliberately dependency-light.
//
// Run directly: node scripts/score.test.js
// Or via the built-in runner: node --test scripts/

import { test } from "node:test";
import assert from "node:assert/strict";
import { globToRegExp } from "./config.js";
import { parseArgs } from "../lib/args.js";
import {
  teamSizeDampingFactor,
  riskTier,
  scoreDuplication,
  scoreHistoricalSecrets,
  scoreBandit,
  scoreDependencyVulnerabilities,
  combineTechnicalDebt,
  scoreCognitiveDebt,
  scoreIntentDebt,
} from "./scoring.js";

test("teamSizeDampingFactor — 1 author means zero, not a knowledge-silo signal", () => {
  assert.equal(teamSizeDampingFactor(1), 0);
});

test("teamSizeDampingFactor — 2 authors is a linear midpoint (0.5)", () => {
  assert.equal(teamSizeDampingFactor(2), 0.5);
});

test("teamSizeDampingFactor — 3+ authors reaches full weight (1.0) and stays capped", () => {
  assert.equal(teamSizeDampingFactor(3), 1);
  assert.equal(teamSizeDampingFactor(50), 1);
});

test("teamSizeDampingFactor — never goes negative for 0 authors (edge case)", () => {
  assert.equal(teamSizeDampingFactor(0), 0);
});

test("riskTier — boundary values land in the documented tier, not the adjacent one", () => {
  assert.equal(riskTier(0), "Low");
  assert.equal(riskTier(25), "Low");
  assert.equal(riskTier(26), "Medium");
  assert.equal(riskTier(50), "Medium");
  assert.equal(riskTier(51), "High");
  assert.equal(riskTier(75), "High");
  assert.equal(riskTier(76), "Critical");
  assert.equal(riskTier(100), "Critical");
});

test("globToRegExp — '*' matches within a path segment but not across '/'", () => {
  const re = globToRegExp("*.generated.js");
  assert.ok(re.test("foo.generated.js"));
  assert.ok(!re.test("src/foo.generated.js"), "'*' should not cross a path separator");
});

test("globToRegExp — '**' matches across path separators", () => {
  const re = globToRegExp("vendor/**");
  assert.ok(re.test("vendor/foo/bar.js"));
  assert.ok(!re.test("src/vendor/foo.js"), "pattern is anchored, not a substring match");
});

test("globToRegExp — dots in the pattern are literal, not 'any character'", () => {
  const re = globToRegExp("*.py");
  assert.ok(re.test("main.py"));
  assert.ok(!re.test("mainXpy"), "a literal dot shouldn't match an arbitrary character");
});

test("scoreDuplication — null input (tool didn't run) returns null, not a fabricated zero", () => {
  assert.equal(scoreDuplication(null), null);
});

test("scoreDuplication — percentage at the saturation threshold caps at 100", () => {
  const result = scoreDuplication({ statistics: { total: { percentage: 20, duplicatedLines: 200, lines: 1000, clones: 5 } } });
  assert.equal(result.score, 100);
});

test("scoreDuplication — percentage well above threshold still caps at 100, doesn't overflow", () => {
  const result = scoreDuplication({ statistics: { total: { percentage: 80, duplicatedLines: 800, lines: 1000, clones: 20 } } });
  assert.equal(result.score, 100);
});

test("scoreHistoricalSecrets — zero leaks scores zero, not null (tool did run, just found nothing)", () => {
  const result = scoreHistoricalSecrets([]);
  assert.equal(result.score, 0);
  assert.equal(result.leakCount, 0);
});

test("scoreHistoricalSecrets — a single leak already scores as a severe risk (25/100)", () => {
  const result = scoreHistoricalSecrets([{ RuleID: "aws-key", File: "a.py", StartLine: 1, Commit: "abc123def456" }]);
  assert.equal(result.score, 25);
});

test("scoreHistoricalSecrets — many leaks cap at 100, don't overflow past it", () => {
  const leaks = Array.from({ length: 10 }, (_, i) => ({ RuleID: "x", File: `f${i}.py`, StartLine: 1, Commit: "abc" }));
  const result = scoreHistoricalSecrets(leaks);
  assert.equal(result.score, 100);
});

test("scoreBandit — severity weights order HIGH > MEDIUM > LOW in the resulting score", () => {
  const oneHigh = scoreBandit({ results: [{ issue_severity: "HIGH", test_id: "B1" }] }, 1);
  const oneMedium = scoreBandit({ results: [{ issue_severity: "MEDIUM", test_id: "B2" }] }, 1);
  const oneLow = scoreBandit({ results: [{ issue_severity: "LOW", test_id: "B3" }] }, 1);
  assert.ok(oneHigh.score > oneMedium.score);
  assert.ok(oneMedium.score > oneLow.score);
});

test("scoreDependencyVulnerabilities — counts vulnerable packages, not raw CVE count", () => {
  // One package with 5 CVEs should score less than two packages with 1 CVE
  // each — this is deliberate (see POINTS_PER_VULNERABLE_PACKAGE comment
  // in score.js): a single ancient dependency with a long CVE history
  // shouldn't dominate the score disproportionately to actual dependency risk.
  const onePackageManyVulns = scoreDependencyVulnerabilities({
    dependencies: [{ name: "old-pkg", version: "1.0", vulns: Array(5).fill({ id: "X", fix_versions: [] }) }],
  });
  const twoPackagesOneVulnEach = scoreDependencyVulnerabilities({
    dependencies: [
      { name: "pkg-a", version: "1.0", vulns: [{ id: "A", fix_versions: [] }] },
      { name: "pkg-b", version: "1.0", vulns: [{ id: "B", fix_versions: [] }] },
    ],
  });
  assert.ok(twoPackagesOneVulnEach.score > onePackageManyVulns.score);
});

test("scoreDependencyVulnerabilities — merges pip-audit (Python) and npm audit (JS/TS) into one signal", () => {
  const pipOnly = scoreDependencyVulnerabilities(
    { dependencies: [{ name: "flask", version: "0.12", vulns: [{ id: "PYSEC-1", fix_versions: [] }] }] },
    null
  );
  assert.equal(pipOnly.vulnerablePackageCount, 1, "pip-only should count just the pip package");

  const npmOnly = scoreDependencyVulnerabilities(null, {
    vulnerabilities: { lodash: { range: "<4.17.5", severity: "critical", via: ["CVE-2018-1234"], fixAvailable: false } },
  });
  assert.equal(npmOnly.vulnerablePackageCount, 1, "npm-only should count just the npm package");

  const both = scoreDependencyVulnerabilities(
    { dependencies: [{ name: "flask", version: "0.12", vulns: [{ id: "PYSEC-1", fix_versions: [] }] }] },
    { vulnerabilities: { lodash: { range: "<4.17.5", severity: "critical", via: ["CVE-2018-1234"], fixAvailable: false } } }
  );
  assert.equal(both.vulnerablePackageCount, 2, "both ecosystems present should merge into a combined count");
  assert.ok(
    both.packages.some((p) => p.ecosystem === "pip") && both.packages.some((p) => p.ecosystem === "npm"),
    "merged packages should retain which ecosystem each came from"
  );
});

test("combineTechnicalDebt — missing tools redistribute weight instead of averaging in a phantom zero", () => {
  // A semgrep-only score of 80 should stay high even though duplication/
  // secrets/bandit/dependencyVulns weren't run — averaging in zeros for
  // the tools that didn't run would silently understate real risk.
  const semgrepOnly = combineTechnicalDebt(80, null, null, null, null);
  assert.ok(semgrepOnly >= 75, `expected semgrep-only score to stay close to 80, got ${semgrepOnly}`);
});

test("combineTechnicalDebt — a clean bill from every tool scores 0, not some non-zero floor", () => {
  const allClean = combineTechnicalDebt(
    0,
    { score: 0 },
    { score: 0 },
    { score: 0 },
    { score: 0 }
  );
  assert.equal(allClean, 0);
});

test("scoreCognitiveDebt — a bot author (e.g. github-actions[bot]) does not count toward team size", () => {
  // Found via this repo's own self-scan: a solo human + a CI bot's badge-
  // update commits pushed totalAuthors to 2, which is enough to start
  // un-damping the score, even though the bot distributes zero real
  // knowledge. Two real humans should un-dampen; one human + one bot
  // should not.
  const soloPlusBot = scoreCognitiveDebt({
    busFactorStats: { busFactorRiskRatio: 1.0 },
    commitStats: { authorCounts: { "Solo Builder": 10, "github-actions[bot]": 3 } },
  });
  assert.equal(soloPlusBot.totalAuthors, 1, "the bot should not be counted as a second author");
  assert.equal(soloPlusBot.score, 0, "one real author (bot excluded) should still fully damp the score");

  const twoRealHumans = scoreCognitiveDebt({
    busFactorStats: { busFactorRiskRatio: 1.0 },
    commitStats: { authorCounts: { "Alice": 10, "Bob": 3, "dependabot[bot]": 5 } },
  });
  assert.equal(twoRealHumans.totalAuthors, 2, "two real humans should count even alongside a bot");
  assert.ok(twoRealHumans.score > 0, "two real humans should partially un-damp the score");
});

test("scoreIntentDebt — a repo with zero AI-assisted commits scores byte-identical to the pre-feature formula", () => {
  // 5 of 10 commits generic, none AI-assisted at all — must equal the old
  // 100 * genericMessageRatio formula exactly, not a diluted fraction of it.
  const result = scoreIntentDebt({
    commitStats: {
      totalCommits: 10,
      genericMessageRatio: 0.5,
      genericMessageCommits: 5,
      aiAssistedGenericRatio: 0,
      aiAssistedGenericCommits: 0,
    },
  });
  assert.equal(result.score, 50, "must match 100 * genericMessageRatio exactly when the new signal is inactive");
});

test("scoreIntentDebt — disclosed AI use with well-explained commits is not penalized", () => {
  // All 10 commits AI-assisted, but none generic — a transparent,
  // well-labeled trailer shouldn't itself raise the score.
  const result = scoreIntentDebt({
    commitStats: {
      totalCommits: 10,
      genericMessageRatio: 0,
      genericMessageCommits: 0,
      aiAssistedRatio: 1.0,
      aiAssistedGenericRatio: 0,
      aiAssistedGenericCommits: 0,
    },
  });
  assert.equal(result.score, 0);
  assert.equal(result.aiAssistedRatio, 1.0);
});

test("scoreIntentDebt — AI-assisted AND generic commits compound into a higher score than the same generic ratio alone", () => {
  const genericOnly = scoreIntentDebt({
    commitStats: { totalCommits: 10, genericMessageRatio: 0.5, genericMessageCommits: 5, aiAssistedGenericCommits: 0 },
  });
  // Same 5 generic commits, but 3 of them are also AI-assisted.
  const genericAndAiUnexplained = scoreIntentDebt({
    commitStats: { totalCommits: 10, genericMessageRatio: 0.5, genericMessageCommits: 5, aiAssistedGenericCommits: 3 },
  });
  assert.ok(
    genericAndAiUnexplained.score > genericOnly.score,
    "an AI-assisted+generic commit pattern should score worse than the same generic ratio alone"
  );
});

test("scoreIntentDebt — surfaces aiToolCounts and aiAssistedCommitList unchanged for reporting", () => {
  const result = scoreIntentDebt({
    commitStats: {
      totalCommits: 10,
      genericMessageRatio: 0,
      genericMessageCommits: 0,
      aiAssistedRatio: 0.4,
      aiAssistedGenericRatio: 0,
      aiAssistedGenericCommits: 0,
      aiAssistedCommits: 2,
      aiToolCounts: { "Claude Code": 2 },
      aiAssistedCommitList: [{ hash: "abc1234", author: "Dev", tool: "Claude Code", subject: "feat: x" }],
    },
  });
  assert.equal(result.aiAssistedCommits, 2);
  assert.deepEqual(result.aiToolCounts, { "Claude Code": 2 });
  assert.equal(result.aiAssistedCommitList.length, 1);
});

test("scoreCognitiveDebt — zero giant-dump commits scores byte-identical to the pre-feature formula", () => {
  const result = scoreCognitiveDebt({
    busFactorStats: { busFactorRiskRatio: 0.5 },
    commitStats: { authorCounts: { Alice: 5, Bob: 5, Carol: 5 } },
    churnStats: { giantDumpRatio: 0 },
  });
  // dampingFactor at 3 authors is 1.0, so score should be exactly 100 * 0.5 * 1.0 = 50
  assert.equal(result.score, 50, "must match the pre-feature bus-factor-only formula when giantDumpRatio is 0");
});

test("scoreCognitiveDebt — giant-dump commits add to the score without team-size damping", () => {
  // Even a solo repo (dampingFactor 0, so bus factor contributes nothing)
  // should still be pushed up by a real giant-dump-commit pattern — an
  // unreviewed dump is risky regardless of team size.
  const soloWithDumps = scoreCognitiveDebt({
    busFactorStats: { busFactorRiskRatio: 1.0 },
    commitStats: { authorCounts: { "Solo Builder": 10 } },
    churnStats: { giantDumpRatio: 0.5 },
  });
  assert.equal(soloWithDumps.dampingFactor, 0, "a single author should fully damp bus factor");
  assert.ok(soloWithDumps.score > 0, "giant-dump ratio should still raise the score despite full bus-factor damping");
});

test("scoreCognitiveDebt — surfaces giantDumpCommits and giantDumpCommitList for reporting", () => {
  const result = scoreCognitiveDebt({
    busFactorStats: { busFactorRiskRatio: 0 },
    commitStats: { authorCounts: { Alice: 5, Bob: 5, Carol: 5 } },
    churnStats: {
      giantDumpRatio: 0.2,
      giantDumpCommits: 1,
      giantDumpCommitList: [{ hash: "abc1234", author: "Alice", subject: "feat: big change", filesChanged: 40, linesAdded: 900, linesDeleted: 10 }],
    },
  });
  assert.equal(result.giantDumpCommits, 1);
  assert.equal(result.giantDumpCommitList.length, 1);
});

// --- parseArgs (lib/args.js) — regression tests for the flag parser ---

test("parseArgs — a bare flag followed by another flag does not swallow it as a value", () => {
  // Regression: `--out --html x` used to make "--html" the output path and
  // "x" a positional scan target.
  const args = parseArgs(["--out", "--html", "x"]);
  assert.equal(args.out, undefined, "bare --out should not consume --html as its value");
  assert.equal(args.html, "x");
  assert.deepEqual(args._, []);
});

test("parseArgs — flag with a value, empty-string opt-out, and positional args all parse", () => {
  const args = parseArgs(["/some/repo", "--out", "r.md", "--html", "", "--fail-on-score", "70"]);
  assert.deepEqual(args._, ["/some/repo"]);
  assert.equal(args.out, "r.md");
  assert.equal(args.html, "", "empty string is the documented opt-out, must not be dropped");
  assert.equal(args["fail-on-score"], "70");
});

test("parseArgs — a trailing bare flag is undefined, not a crash", () => {
  const args = parseArgs(["repo", "--json"]);
  assert.equal(args.json, undefined);
  assert.deepEqual(args._, ["repo"]);
});

test("combineTechnicalDebt — null semgrep (not installed) redistributes its weight, no phantom zero", () => {
  // Secrets score of 50 with everything else clean should stay meaningful
  // when semgrep didn't run — not be diluted by a fabricated semgrep zero.
  const withoutSemgrep = combineTechnicalDebt(null, { score: 0 }, { score: 50 }, { score: 0 }, { score: 0 });
  const withSemgrepZero = combineTechnicalDebt(0, { score: 0 }, { score: 50 }, { score: 0 }, { score: 0 });
  assert.ok(withoutSemgrep > withSemgrepZero, "skipping semgrep must weigh remaining tools higher than semgrep-ran-clean");
});

test("combineTechnicalDebt — nothing ran at all returns 0, not NaN", () => {
  assert.equal(combineTechnicalDebt(null, null, null, null, null), 0);
});
