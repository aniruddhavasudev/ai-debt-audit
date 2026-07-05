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
import {
  globToRegExp,
  teamSizeDampingFactor,
  riskTier,
  scoreDuplication,
  scoreHistoricalSecrets,
  scoreBandit,
  scoreDependencyVulnerabilities,
  combineTechnicalDebt,
} from "./score.js";

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
