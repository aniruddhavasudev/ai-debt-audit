#!/usr/bin/env node
/**
 * test-config-integration.js — end-to-end regression test for
 * .aidebtrc.json's excludePaths and ignoreRules.
 *
 * This exists because of a real bug: excludePaths patterns are documented
 * (and written by users) as relative to the repo root ("vendor/**"), but
 * Semgrep/Bandit report absolute paths, and config filtering used to run
 * *before* paths were relativized — so excludePaths silently matched
 * nothing, ever. scripts/score.test.js's unit tests didn't catch this
 * because they test the pure filtering function directly with paths
 * already relative; the bug was in main()'s orchestration, not the
 * function itself. Only running the real CLI against a real repo with a
 * real .aidebtrc.json surfaced it — so that's what this test does.
 *
 * Usage: node scripts/test-config-integration.js
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(PACKAGE_ROOT, "bin", "aidebt-scan.js");
const FIXTURE_SOURCE = path.join(PACKAGE_ROOT, "test-fixtures", "flask");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// excludePaths/ignoreRules only ever apply to Semgrep/Bandit findings (the
// Technical Debt section) — git-mine and jscpd are documented as repo-wide
// regardless of exclusions (see docs/USAGE.md's --diff flag), so a file can
// legitimately still be named in the Cognitive Debt "files only one person
// has touched" list, or a jscpd clone pair, after being excluded from
// Technical Debt. Scope the check to that section instead of the whole
// report so this test verifies the actual contract, not an accidental one.
function technicalDebtSection(report) {
  const start = report.indexOf("## Technical Debt");
  const end = report.indexOf("\n## ", start + 1);
  return report.slice(start, end === -1 ? undefined : end);
}

function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-config-test-"));
  fs.cpSync(FIXTURE_SOURCE, workDir, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: workDir });
  execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", "add", "-A"], { cwd: workDir });
  execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-q", "-m", "init"], {
    cwd: workDir,
  });

  // Sanity check: without any config, app.py's findings should show up —
  // establishes the baseline before proving exclusion actually works.
  const baselineOut = path.join(workDir, "baseline.md");
  execFileSync("node", [CLI, workDir, "--out", baselineOut, "--html", ""], { stdio: "ignore" });
  const baseline = fs.readFileSync(baselineOut, "utf8");
  if (!technicalDebtSection(baseline).includes("app.py")) {
    fail("baseline scan (no config) didn't flag app.py at all — fixture or CLI itself is broken, not just config filtering");
  }

  // Now exclude app.py via .aidebtrc.json and confirm its findings disappear
  // from Technical Debt specifically (it may still legitimately appear
  // elsewhere — see the comment on technicalDebtSection()).
  fs.writeFileSync(path.join(workDir, ".aidebtrc.json"), JSON.stringify({ excludePaths: ["app.py"] }));
  const excludedOut = path.join(workDir, "excluded.md");
  execFileSync("node", [CLI, workDir, "--out", excludedOut, "--html", ""], { stdio: "ignore" });
  const excluded = fs.readFileSync(excludedOut, "utf8");
  if (technicalDebtSection(excluded).includes("app.py")) {
    fail("excludePaths: [\"app.py\"] did not remove app.py's findings — the bug this test exists to catch has regressed");
  }

  // And confirm ignoreRules works the same way, on a specific rule ID.
  fs.writeFileSync(
    path.join(workDir, ".aidebtrc.json"),
    JSON.stringify({ ignoreRules: ["ai-debt-flask-debug-true"] })
  );
  const ignoredOut = path.join(workDir, "ignored.md");
  execFileSync("node", [CLI, workDir, "--out", ignoredOut, "--html", ""], { stdio: "ignore" });
  const ignored = fs.readFileSync(ignoredOut, "utf8");
  if (technicalDebtSection(ignored).includes("ai-debt-flask-debug-true")) {
    fail("ignoreRules: [\"ai-debt-flask-debug-true\"] did not remove that rule's findings");
  }

  fs.rmSync(workDir, { recursive: true, force: true });
  console.log("PASS: .aidebtrc.json excludePaths and ignoreRules both verified end-to-end via the real CLI.");
}

main();
