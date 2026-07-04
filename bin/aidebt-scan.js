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
 *   aidebt-scan <path-to-repo> [--out report.md] [--html report.html] [--json raw.json]
 *
 * By default, both a Markdown report (--out, default ./ai-debt-report.md)
 * and an HTML report (same name, .html extension) are written. Pass
 * --html "" to skip HTML generation.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { c, tierColor, barChart } from "../scripts/colors.js";

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
      c.cyan(`  ℹ Found centralized auth middleware (${relMiddlewarePath}) — dampened ${adjustedCount} auth-check finding(s)`)
    );
  }
}

function step(label, fn) {
  process.stderr.write(c.dim(`→ ${label}...`));
  const start = Date.now();
  const result = fn();
  const ms = Date.now() - start;
  const status = result ? c.green("✓") : c.red("✗ skipped");
  process.stderr.write(`\r${status} ${label} ${c.dim(`(${ms}ms)`)}          \n`);
  return result;
}

function runSemgrep(targetPath, outPath) {
  try {
    execFileSync(
      "semgrep",
      ["--config", RULES_DIR, targetPath, "--json", "--output", outPath, "--quiet"],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
    return outPath;
  } catch {
    // Semgrep exits non-zero when findings exist AND when it errors — the
    // only reliable signal is whether it actually wrote a valid JSON file.
    if (fileExists(outPath)) return outPath;
    console.error(c.red("  Semgrep failed to run — is it installed? (pip install semgrep)"));
    return null;
  }
}

function runGitMine(targetPath, outPath) {
  try {
    execFileSync("node", [GIT_MINE_SCRIPT, targetPath], {
      stdio: ["ignore", fs.openSync(outPath, "w"), "ignore"],
    });
    return outPath;
  } catch {
    console.error(c.red("  git-mine failed — is this a git repo with at least one commit?"));
    return null;
  }
}

function runJscpd(targetPath, outDir) {
  if (!fileExists(JSCPD_BIN)) {
    console.error(c.yellow("  jscpd not found in node_modules — skipping duplication check (run `npm install`)"));
    return null;
  }
  const reportPath = path.join(outDir, "jscpd-report.json");
  try {
    execFileSync(JSCPD_BIN, [targetPath, "--reporters", "json", "--output", outDir, "--silent"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // jscpd exits non-zero on some duplicate thresholds — check for the file directly.
  }
  return fileExists(reportPath) ? reportPath : null;
}

function runGitleaks(targetPath, outPath) {
  if (!binExists("gitleaks")) {
    console.error(c.yellow("  gitleaks not found on PATH — skipping historical secrets check"));
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

function printSummaryBox(scores, outPath, htmlPath) {
  const { composite, tier, technical, cognitive, intent } = scores;
  const width = 56;
  const rule = c.dim("─".repeat(width));

  console.log("\n" + rule);
  console.log(c.bold("  AI-DEBT REPORT"));
  console.log(rule);
  console.log(
    `  Composite Score: ${c.bold(composite + "/100")}   ${tierColor(tier, `[${tier} Risk]`)}`
  );
  console.log(rule);
  console.log(`  Technical debt   ${barChart(technical.blendedScore, 24)}  ${String(technical.blendedScore).padStart(3)}/100  (50%)`);
  console.log(`  Cognitive debt   ${barChart(cognitive.score, 24)}  ${String(cognitive.score).padStart(3)}/100  (25%)`);
  console.log(`  Intent debt      ${barChart(intent.score, 24)}  ${String(intent.score).padStart(3)}/100  (25%)`);
  console.log(rule);
  console.log(`  ${c.dim("Markdown:")} ${outPath}`);
  if (htmlPath) console.log(`  ${c.dim("HTML:    ")} ${htmlPath}`);
  console.log(rule + "\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(args._[0] || ".");

  if (!fs.existsSync(targetPath)) {
    console.error(c.red(`Error: path does not exist: ${targetPath}`));
    process.exit(1);
  }

  console.log(c.bold(`\nAI-Debt Scan`) + c.dim(` — ${targetPath}\n`));

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-"));

  const semgrepOut = step("Semgrep (technical debt)", () => runSemgrep(targetPath, path.join(workDir, "semgrep.json")));
  if (semgrepOut) dampenMiddlewareCoveredFindings(semgrepOut, targetPath);
  const gitmineOut = step("git-mine (cognitive + intent debt)", () => runGitMine(targetPath, path.join(workDir, "gitmine.json")));
  const jscpdOut = step("jscpd (duplication)", () => runJscpd(targetPath, path.join(workDir, "jscpd")));
  const gitleaksOut = step("gitleaks (historical secrets)", () => runGitleaks(targetPath, path.join(workDir, "gitleaks.json")));

  if (!semgrepOut || !gitmineOut) {
    console.error(
      c.red("\nCannot produce a score without Semgrep and git-mine results — both are required inputs, not optional enrichments.")
    );
    process.exit(1);
  }

  const scoreArgs = [SCORE_SCRIPT, "--semgrep", semgrepOut, "--gitmine", gitmineOut];
  if (jscpdOut) scoreArgs.push("--jscpd", jscpdOut);
  if (gitleaksOut) scoreArgs.push("--gitleaks", gitleaksOut);

  const outPath = args.out ? path.resolve(args.out) : path.resolve("ai-debt-report.md");
  const htmlPath = args.html === undefined ? outPath.replace(/\.md$/, "") + ".html" : args.html ? path.resolve(args.html) : null;
  const rawJsonPath = path.join(workDir, "scores.json");

  scoreArgs.push("--out", outPath, "--json", rawJsonPath);
  if (htmlPath) scoreArgs.push("--html", htmlPath);

  step("Scoring", () => {
    execFileSync("node", scoreArgs, { stdio: ["ignore", "ignore", "ignore"] });
    return true;
  });

  const scores = JSON.parse(fs.readFileSync(rawJsonPath, "utf8"));
  if (args.json) fs.copyFileSync(rawJsonPath, path.resolve(args.json));

  fs.rmSync(workDir, { recursive: true, force: true });

  printSummaryBox(scores, outPath, htmlPath);
}

main();
