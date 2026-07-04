#!/usr/bin/env node
/**
 * aidebt-scan — orchestrates the four scanning tools (Semgrep, git-mine.js,
 * jscpd, gitleaks) against a target repo and produces one AI-Debt Report.
 *
 * This file intentionally contains no scoring logic of its own — it only
 * wires processes together and hands their output to scripts/score.js.
 * That separation is deliberate: calibrating the score later should never
 * require touching this file.
 *
 * Usage:
 *   aidebt-scan <path-to-repo> [--out report.md] [--json raw.json]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES_DIR = path.join(PACKAGE_ROOT, "rules");
const GIT_MINE_SCRIPT = path.join(PACKAGE_ROOT, "scripts", "git-mine.js");
const SCORE_SCRIPT = path.join(PACKAGE_ROOT, "scripts", "score.js");
const JSCPD_BIN = path.join(PACKAGE_ROOT, "node_modules", ".bin", "jscpd");

// Calibration fix #1: the ai-debt-nextjs-api-route-missing-auth-check rule
// can only see auth calls made *inside* the flagged function. It cannot see
// auth enforced centrally in Next.js middleware — a very common, legitimate
// pattern — so as written it false-positives on every route in any app that
// does this. We can't fix that inside Semgrep itself (a single rule can't
// reason across files), so we detect the middleware here, where we have
// direct filesystem access to the target repo, and dampen the finding's
// weight rather than trusting it at full confidence.
const AUTH_MIDDLEWARE_CANDIDATES = ["middleware.ts", "middleware.js", "src/middleware.ts", "src/middleware.js"];
const AUTH_KEYWORDS_RE = /(auth|session|getUser|getSession|jwt)/i;
const MISSING_AUTH_CHECK_RULE = "ai-debt-nextjs-api-route-missing-auth-check";
const MIDDLEWARE_DAMPING_FACTOR = 0.2; // 80% confidence discount, not full suppression

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}

function binExists(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function detectCentralizedAuthMiddleware(targetPath) {
  for (const candidate of AUTH_MIDDLEWARE_CANDIDATES) {
    const candidatePath = path.join(targetPath, candidate);
    if (fileExists(candidatePath) && AUTH_KEYWORDS_RE.test(fs.readFileSync(candidatePath, "utf8"))) {
      return candidatePath;
    }
  }
  return null;
}

function dampenMiddlewareCoveredFindings(semgrepOutPath, targetPath) {
  const middlewarePath = detectCentralizedAuthMiddleware(targetPath);
  if (!middlewarePath) return;

  const data = JSON.parse(fs.readFileSync(semgrepOutPath, "utf8"));
  const relMiddlewarePath = path.relative(targetPath, middlewarePath);
  let adjustedCount = 0;

  for (const result of data.results || []) {
    if (!result.check_id.endsWith(MISSING_AUTH_CHECK_RULE)) continue;
    const originalWeight = Number(result.extra?.metadata?.weight ?? 4);
    result.extra.metadata.weight = Math.round(originalWeight * MIDDLEWARE_DAMPING_FACTOR * 10) / 10;
    result.extra.metadata.dampened_reason =
      `Repo has centralized auth middleware at ${relMiddlewarePath} — this finding's confidence ` +
      `is reduced 80% since auth may be enforced there instead of per-route. Verify manually.`;
    adjustedCount++;
  }

  if (adjustedCount > 0) {
    fs.writeFileSync(semgrepOutPath, JSON.stringify(data));
    console.error(
      `  ℹ Found centralized auth middleware (${relMiddlewarePath}) — dampened ${adjustedCount} auth-check finding(s)`
    );
  }
}

function runSemgrep(targetPath, outPath) {
  console.error("→ Running Semgrep (technical debt)...");
  try {
    execFileSync(
      "semgrep",
      ["--config", RULES_DIR, targetPath, "--json", "--output", outPath, "--quiet"],
      { stdio: ["ignore", "ignore", "inherit"] }
    );
    return outPath;
  } catch (err) {
    // Semgrep exits non-zero when findings exist AND when it errors — the
    // only reliable signal is whether it actually wrote a valid JSON file.
    if (fileExists(outPath)) return outPath;
    console.error("  ✗ Semgrep failed to run — is it installed? (pip install semgrep)");
    return null;
  }
}

function runGitMine(targetPath, outPath) {
  console.error("→ Running git-mine (cognitive + intent debt)...");
  try {
    execFileSync("node", [GIT_MINE_SCRIPT, targetPath], {
      stdio: ["ignore", fs.openSync(outPath, "w"), "inherit"],
    });
    return outPath;
  } catch (err) {
    console.error("  ✗ git-mine failed — is this a git repo with at least one commit?");
    return null;
  }
}

function runJscpd(targetPath, outDir) {
  console.error("→ Running jscpd (duplication)...");
  if (!fileExists(JSCPD_BIN)) {
    console.error("  ⚠ jscpd not found in node_modules — skipping duplication check (run `npm install`)");
    return null;
  }
  try {
    execFileSync(JSCPD_BIN, [targetPath, "--reporters", "json", "--output", outDir, "--silent"], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    const reportPath = path.join(outDir, "jscpd-report.json");
    return fileExists(reportPath) ? reportPath : null;
  } catch {
    // jscpd exits non-zero on some duplicate thresholds — check for the file directly.
    const reportPath = path.join(outDir, "jscpd-report.json");
    return fileExists(reportPath) ? reportPath : null;
  }
}

function runGitleaks(targetPath, outPath) {
  console.error("→ Running gitleaks (historical secrets)...");
  if (!binExists("gitleaks")) {
    console.error("  ⚠ gitleaks not found on PATH — skipping historical secrets check");
    return null;
  }
  try {
    execFileSync(
      "gitleaks",
      ["detect", "--source", targetPath, "--report-format", "json", "--report-path", outPath, "--no-banner"],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
  } catch {
    // gitleaks exits 1 when leaks ARE found — that's success for our purposes,
    // not an error. Only a missing output file is a real failure.
  }
  return fileExists(outPath) ? outPath : null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(args._[0] || ".");

  if (!fs.existsSync(targetPath)) {
    console.error(`Error: path does not exist: ${targetPath}`);
    process.exit(1);
  }

  console.error(`AI-Debt Scan — ${targetPath}\n`);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-"));
  const semgrepOut = runSemgrep(targetPath, path.join(workDir, "semgrep.json"));
  if (semgrepOut) dampenMiddlewareCoveredFindings(semgrepOut, targetPath);
  const gitmineOut = runGitMine(targetPath, path.join(workDir, "gitmine.json"));
  const jscpdOut = runJscpd(targetPath, path.join(workDir, "jscpd"));
  const gitleaksOut = runGitleaks(targetPath, path.join(workDir, "gitleaks.json"));

  if (!semgrepOut || !gitmineOut) {
    console.error(
      "\nCannot produce a score without Semgrep and git-mine results — both are required inputs, not optional enrichments."
    );
    process.exit(1);
  }

  console.error("→ Scoring...\n");
  const scoreArgs = [SCORE_SCRIPT, "--semgrep", semgrepOut, "--gitmine", gitmineOut];
  if (jscpdOut) scoreArgs.push("--jscpd", jscpdOut);
  if (gitleaksOut) scoreArgs.push("--gitleaks", gitleaksOut);

  const outPath = args.out ? path.resolve(args.out) : path.resolve("ai-debt-report.md");
  scoreArgs.push("--out", outPath);
  if (args.json) scoreArgs.push("--json", path.resolve(args.json));

  execFileSync("node", scoreArgs, { stdio: "inherit" });

  fs.rmSync(workDir, { recursive: true, force: true });

  console.error(`\nDone. Report: ${outPath}`);
}

main();
