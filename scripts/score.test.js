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
import {
  teamSizeDampingFactor,
  riskTier,
  scoreDuplication,
  scoreHistoricalSecrets,
  scoreBandit,
  scoreDependencyVulnerabilities,
  combineTechnicalDebt,
  scoreCognitiveDebt,
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
