#!/usr/bin/env node
/**
 * test-degraded.js — end-to-end test for graceful degradation: with ZERO
 * external tools installed (no semgrep, bandit, pip-audit, gitleaks), the
 * scanner must still complete, produce a scored report, say exactly which
 * checks were skipped, and never fabricate a zero for a tool that didn't
 * run. This is the contract behind "npx ai-debt-audit works with nothing
 * but Node installed."
 *
 * Simulated by running the CLI with a PATH containing only node, git, npm
 * and core utilities — the same environment a fresh machine has.
 *
 * Usage: node scripts/test-degraded.js
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(PACKAGE_ROOT, "bin", "aidebt-scan.js");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function main() {
  // Minimal PATH: just enough for the CLI itself (node, git, npm for the
  // audit step, sh/which for binExists) — no scanners.
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-minpath-"));
  for (const tool of ["node", "git", "npm", "sh", "which", "env"]) {
    try {
      const real = execFileSync("which", [tool], { encoding: "utf8" }).trim();
      fs.symlinkSync(real, path.join(binDir, tool));
    } catch {
      /* tool not present on host — fine, the point is scanners aren't */
    }
  }

  // A tiny repo with one commit — the only hard requirement.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-degraded-"));
  fs.writeFileSync(path.join(repo, "a.js"), "export const a = 1;\n");
  const git = (args) => execFileSync("git", ["-C", repo, ...args], {
    env: { ...process.env, GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t" },
  });
  git(["init", "-q"]);
  git(["add", "-A"]);
  git(["commit", "-q", "--no-verify", "-m", "wip"]);

  const outMd = path.join(repo, "report.md");
  const outJson = path.join(repo, "scores.json");
  const run = spawnSync(
    "node",
    [CLI, repo, "--out", outMd, "--json", outJson, "--html", "", "--csv", "", "--pdf", ""],
    { encoding: "utf8", env: { ...process.env, PATH: binDir } }
  );

  if (run.status !== 0) fail(`scan should exit 0 with no scanners installed, got ${run.status}\n${run.stderr}`);

  const combined = run.stdout + run.stderr;
  for (const notice of ["semgrep not found", "bandit not found", "pip-audit not found", "gitleaks not found"]) {
    if (!combined.includes(notice)) fail(`missing skip notice: "${notice}"`);
  }
  if (!combined.includes("Install:")) fail("skip notices should include an install one-liner");

  const scores = JSON.parse(fs.readFileSync(outJson, "utf8"));
  if (typeof scores.composite !== "number") fail("composite score missing from degraded scan");
  if (scores.technical.skipped !== true) fail("technical.skipped should be true when semgrep didn't run");
  if (scores.historicalSecrets !== null) fail("historicalSecrets must be null (didn't run), not a fabricated zero");
  if (scores.bandit !== null) fail("bandit must be null (didn't run), not a fabricated zero");
  if (scores.intent.score !== 100) fail(`single 'wip' commit should score intent 100, got ${scores.intent.score}`);

  const report = fs.readFileSync(outMd, "utf8");
  if (!report.includes("Semgrep not installed, pattern rules skipped")) {
    fail("Markdown report should state that pattern rules were skipped");
  }

  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(binDir, { recursive: true, force: true });
  console.log("PASS: zero-external-tools scan completes, scores, and reports every skipped check with an install hint.");
}

main();
