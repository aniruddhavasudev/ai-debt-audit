#!/usr/bin/env node
/**
 * aidebt-scan — orchestrates the scanning tools (Semgrep, git-mine.js,
 * jscpd, gitleaks, Bandit, pip-audit, npm audit) against a target repo
 * and produces one AI-Debt Report.
 *
 * This file intentionally contains no scoring logic of its own — it only
 * wires processes together and hands their output to scripts/score.js.
 * That separation is deliberate: calibrating the score later should never
 * require touching this file.
 *
 * Usage:
 *   aidebt-scan <path-to-repo> [--out report.md] [--html report.html] [--json raw.json]
 *                              [--sarif results.sarif] [--csv csv-dir/] [--fail-on-score N]
 *                              [--pdf report.pdf] [--history history.json] [--diff base-ref]
 *
 * By default, a scan writes a Markdown report (--out, default
 * ./ai-debt-report.md), an HTML report (same name, .html extension), a CSV
 * workbook (same name, -csv suffix directory), and a PDF (same name, .pdf
 * extension) — all four, every time, no flags required. Pass an empty
 * string to opt out of any one of them individually: --html "", --csv "",
 * --pdf "".
 *
 * --sarif writes GitHub's native code-scanning format (upload with
 * github/codeql-action/upload-sarif to surface findings in the Security tab)
 * — this one is opt-in, not a default, since it's only useful in CI.
 * --csv writes a small directory of plain-language CSV files (a
 * "workbook": summary.csv plus one sheet per debt category) instead of one
 * flat table of rule IDs — meant to be readable by someone who isn't the
 * one who wrote the code, not just filterable by someone who is.
 * --fail-on-score N exits non-zero if the composite score is >= N — the
 * hook a CI pipeline needs to actually block a PR, not just log a number.
 * --pdf renders the HTML report to PDF via headless Chrome/Chromium — the
 * actual client-deliverable format, not just an internal artifact. Requires
 * an HTML report to exist (not compatible with --html ""), and silently
 * skips itself (with a warning) if no Chrome/Chromium is found on PATH.
 * --history appends this run's score to a local JSON file and shows the
 * trend (improving/worsening) vs the previous run — "is this getting
 * better or worse" is a different question than "what's the score now,"
 * and one-shot manual audits can't answer it at all.
 * --diff base-ref scopes Semgrep/Bandit to only files changed vs that ref
 * (git-mine/jscpd/gitleaks stay repo-wide — bus factor and duplication are
 * inherently whole-codebase concerns). Falls back to a full scan if the
 * ref can't be resolved. This is what makes the GitHub Action fast and
 * answer "did THIS PR add debt" instead of "what's wrong with everything."
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { c, tierColor, barChart } from "../scripts/colors.js";
import { parseArgs } from "../lib/args.js";
import { binExists, fileExists } from "../lib/fs-utils.js";
import { dampenMiddlewareCoveredFindings } from "../lib/auth-middleware-dampening.js";
import { recordHistory } from "../lib/history.js";
import { runPdfExport } from "../lib/pdf-export.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES_DIR = path.join(PACKAGE_ROOT, "rules");
const GIT_MINE_SCRIPT = path.join(PACKAGE_ROOT, "scripts", "git-mine.js");
const SCORE_SCRIPT = path.join(PACKAGE_ROOT, "scripts", "score.js");
const JSCPD_BIN = path.join(PACKAGE_ROOT, "node_modules", ".bin", "jscpd");

// For --diff mode: only run static analysis against files that actually
// changed vs a base ref, instead of the whole repo. ACMR = Added, Copied,
// Modified, Renamed — deliberately excludes Deleted, since there's nothing
// left on disk to scan.
function getChangedFiles(targetPath, baseRef) {
  try {
    const raw = execFileSync(
      "git",
      ["-C", targetPath, "diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return raw
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => path.join(targetPath, f))
      .filter(fileExists);
  } catch (err) {
    console.error(c.yellow(`  Warning: could not diff against '${baseRef}' (${err.message.split("\n")[0]}) — falling back to full scan`));
    return null;
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

// Semgrep's own free, community-maintained registry packs — broader
// framework-specific coverage (XSS via mark_safe, mass assignment, open
// redirects) than we'd hand-write ourselves. Layered alongside our own
// custom AI-debt rules, not instead of them: the registry doesn't know
// about AI-specific smells (placeholder stubs, framework misuse patterns),
// only our rules do.
const SEMGREP_REGISTRY_PACKS = ["p/django", "p/flask", "p/golang", "p/java"];

function runSemgrep(targetPath, outPath, changedFiles) {
  if (!binExists("semgrep")) {
    console.error(c.yellow("  semgrep not found — AI-debt pattern rules skipped. Install: pip3 install semgrep"));
    return null;
  }
  const configArgs = [RULES_DIR, ...SEMGREP_REGISTRY_PACKS].flatMap((cfg) => ["--config", cfg]);
  const scanTargets = changedFiles && changedFiles.length > 0 ? changedFiles : [targetPath];
  try {
    execFileSync("semgrep", [...configArgs, ...scanTargets, "--json", "--output", outPath, "--quiet"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    return outPath;
  } catch {
    // Semgrep exits non-zero when findings exist AND when it errors — the
    // only reliable signal is whether it actually wrote a valid JSON file.
    if (fileExists(outPath)) return outPath;
    // Registry packs need network access — if that's what failed, fall
    // back to our own rules only rather than losing the whole scan.
    try {
      execFileSync("semgrep", ["--config", RULES_DIR, ...scanTargets, "--json", "--output", outPath, "--quiet"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      console.error(c.yellow("  Semgrep registry packs (p/django, p/flask) unavailable — used local rules only"));
      return outPath;
    } catch {
      if (fileExists(outPath)) return outPath;
      console.error(c.red("  Semgrep failed to run — is it installed? (pip install semgrep)"));
      return null;
    }
  }
}

function runBandit(targetPath, outPath, changedFiles) {
  if (!binExists("bandit")) {
    console.error(c.yellow("  bandit not found — Python security checks skipped. Install: pip3 install bandit"));
    return null;
  }
  const pythonFiles = changedFiles ? changedFiles.filter((f) => f.endsWith(".py")) : null;
  if (changedFiles && pythonFiles.length === 0) {
    // Diff mode with no changed Python files — write an empty-but-valid
    // Bandit report rather than skipping, so scoring still reflects "ran,
    // found nothing" instead of silently omitting the tool from the blend.
    fs.writeFileSync(outPath, JSON.stringify({ results: [] }));
    return outPath;
  }
  const banditArgs = pythonFiles ? [...pythonFiles, "-f", "json", "-o", outPath] : ["-r", targetPath, "-f", "json", "-o", outPath];
  try {
    execFileSync("bandit", banditArgs, { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    // Bandit exits non-zero when it finds issues — that's success for us,
    // not an error. Only a missing output file is a real failure.
  }
  return fileExists(outPath) ? outPath : null;
}

const REQUIREMENTS_CANDIDATES = ["requirements.txt", "requirements/base.txt", "requirements/production.txt"];

function findRequirementsFile(targetPath) {
  for (const candidate of REQUIREMENTS_CANDIDATES) {
    const candidatePath = path.join(targetPath, candidate);
    if (fileExists(candidatePath)) return candidatePath;
  }
  return null;
}

function runPipAudit(targetPath, outPath) {
  if (!binExists("pip-audit")) {
    console.error(c.yellow("  pip-audit not found — Python dependency checks skipped. Install: pip3 install pip-audit"));
    return null;
  }
  const reqFile = findRequirementsFile(targetPath);
  if (!reqFile) {
    console.error(c.yellow("  no requirements.txt found — skipping dependency vulnerability scan"));
    return null;
  }
  try {
    execFileSync("pip-audit", ["-r", reqFile, "--format", "json", "-o", outPath], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // pip-audit exits non-zero when vulnerabilities are found — success for us.
  }
  return fileExists(outPath) ? outPath : null;
}

function runNpmAudit(targetPath, outPath) {
  const lockfilePath = path.join(targetPath, "package-lock.json");
  const manifestPath = path.join(targetPath, "package.json");
  let auditCwd = targetPath;

  if (!fileExists(lockfilePath)) {
    if (!fileExists(manifestPath)) {
      console.error(c.yellow("  no package.json found — skipping npm dependency vulnerability scan"));
      return null;
    }
    // Found in the 50-repo calibration run: most JS/TS *libraries* don't
    // commit a lockfile (express, fastify, zod, chalk, ...), so requiring
    // package-lock.json silently disabled dependency scanning for the
    // majority of real JS repos. Generate a lockfile from package.json in
    // a temp dir instead — `--package-lock-only --ignore-scripts` resolves
    // the dependency tree WITHOUT installing anything or running any of
    // the target repo's install scripts, preserving the safety posture
    // documented below. The temp copy also guarantees we never write a
    // package-lock.json into the repo being scanned.
    const lockWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-npmlock-"));
    fs.copyFileSync(manifestPath, path.join(lockWorkDir, "package.json"));
    try {
      execFileSync(
        "npm",
        ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
        { cwd: lockWorkDir, stdio: ["ignore", "ignore", "ignore"], timeout: 120000 }
      );
    } catch {
      // Unresolvable deps (private registries, workspace:* protocols) or
      // no network — fall back to skipping, as before.
    }
    if (!fileExists(path.join(lockWorkDir, "package-lock.json"))) {
      console.error(c.yellow("  no package-lock.json and one couldn't be derived from package.json — skipping npm dependency vulnerability scan"));
      fs.rmSync(lockWorkDir, { recursive: true, force: true });
      return null;
    }
    console.error(c.dim("  no committed package-lock.json — derived one from package.json (no scripts executed)"));
    auditCwd = lockWorkDir;
  }

  // Deliberately npm audit, not `npm install && npm audit` — auditing works
  // directly from the lockfile, so we never need to run an untrusted
  // repo's install scripts (postinstall etc.) just to check its
  // dependencies for known CVEs. Same safety posture as pip-audit, which
  // also never installs the target's packages.
  try {
    const result = execFileSync("npm", ["audit", "--json"], {
      cwd: auditCwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    fs.writeFileSync(outPath, result);
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities are found — that's
    // success for us, not an error. It still prints the JSON to stdout,
    // which execFileSync attaches to the thrown error object.
    if (err.stdout) fs.writeFileSync(outPath, err.stdout);
  }
  if (auditCwd !== targetPath) fs.rmSync(auditCwd, { recursive: true, force: true });
  return fileExists(outPath) ? outPath : null;
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
    console.error(c.yellow("  jscpd not found — duplication check skipped. Install: npm install (in the ai-debt-audit directory)"));
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
    console.error(c.yellow("  gitleaks not found — secrets detection skipped. Install: https://github.com/gitleaks/gitleaks#installing"));
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

function printSummaryBox(scores, outPath, htmlPath, pdfPath, history, sarifPath, badgePath, csvPath) {
  const { composite, tier, technical, cognitive, intent, weights } = scores;
  // Fall back to the historical 50/25/25 default only if an older score.js
  // (pre-config-support) produced this JSON without a weights field.
  const w = weights || { technical: 0.5, cognitive: 0.25, intent: 0.25 };
  const width = 56;
  const rule = c.dim("─".repeat(width));

  console.log("\n" + rule);
  console.log(c.bold("  AI-DEBT REPORT"));
  console.log(rule);
  if (cognitive.isShallowClone) {
    console.log(
      c.yellow(
        "  ⚠ Shallow git clone detected — cognitive/intent debt scores below are\n" +
          "    likely unreliable. Run `git fetch --unshallow` (or use fetch-depth: 0\n" +
          "    in CI) and re-scan before trusting them."
      )
    );
    console.log(rule);
  }
  let trend = "";
  if (history && history.length >= 2) {
    const previous = history[history.length - 2];
    const delta = composite - previous.composite;
    if (delta === 0) {
      trend = c.dim("  (no change since last scan)");
    } else if (delta < 0) {
      trend = c.green(`  (${delta} since last scan — improving)`);
    } else {
      trend = c.red(`  (+${delta} since last scan — worsening)`);
    }
  }

  console.log(
    `  Composite Score: ${c.bold(composite + "/100")}   ${tierColor(tier, `[${tier} Risk]`)}${trend}`
  );
  console.log(rule);
  console.log(`  Technical debt   ${barChart(technical.blendedScore, 24)}  ${String(technical.blendedScore).padStart(3)}/100  (${Math.round(w.technical * 100)}%)`);
  console.log(`  Cognitive debt   ${barChart(cognitive.score, 24)}  ${String(cognitive.score).padStart(3)}/100  (${Math.round(w.cognitive * 100)}%)`);
  console.log(`  Intent debt      ${barChart(intent.score, 24)}  ${String(intent.score).padStart(3)}/100  (${Math.round(w.intent * 100)}%)`);
  console.log(rule);
  console.log(`  ${c.dim("Markdown:")} ${outPath}`);
  if (htmlPath) console.log(`  ${c.dim("HTML:    ")} ${htmlPath}`);
  if (pdfPath) console.log(`  ${c.dim("PDF:     ")} ${pdfPath}`);
  if (sarifPath) console.log(`  ${c.dim("SARIF:   ")} ${sarifPath}`);
  if (badgePath) console.log(`  ${c.dim("Badge:   ")} ${badgePath}`);
  if (csvPath) console.log(`  ${c.dim("CSV:     ")} ${csvPath}/ (summary.csv + 3 category sheets)`);
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

  let changedFiles = null;
  if (args.diff) {
    changedFiles = getChangedFiles(targetPath, args.diff);
    if (changedFiles) {
      console.log(c.cyan(`  Diff mode: scanning ${changedFiles.length} changed file(s) vs ${args.diff}`));
    }
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "aidebt-"));

  const semgrepOut = step("Semgrep (technical debt)", () => runSemgrep(targetPath, path.join(workDir, "semgrep.json"), changedFiles));
  if (semgrepOut) dampenMiddlewareCoveredFindings(semgrepOut, targetPath);
  const gitmineOut = step("git-mine (cognitive + intent debt)", () => runGitMine(targetPath, path.join(workDir, "gitmine.json")));
  const jscpdOut = step("jscpd (duplication)", () => runJscpd(targetPath, path.join(workDir, "jscpd")));
  const gitleaksOut = step("gitleaks (historical secrets)", () => runGitleaks(targetPath, path.join(workDir, "gitleaks.json")));
  const banditOut = step("bandit (Python security)", () => runBandit(targetPath, path.join(workDir, "bandit.json"), changedFiles));
  const pipAuditOut = step("pip-audit (dependency vulnerabilities)", () => runPipAudit(targetPath, path.join(workDir, "pip-audit.json")));
  const npmAuditOut = step("npm audit (dependency vulnerabilities)", () => runNpmAudit(targetPath, path.join(workDir, "npm-audit.json")));

  if (!gitmineOut) {
    console.error(
      c.red("\nCannot produce a score without git-mine results — the target must be a git repository with at least one commit.")
    );
    process.exit(1);
  }
  if (!semgrepOut) {
    console.error(
      c.yellow("\n  Partial scan: Semgrep didn't run, so the AI-debt pattern rules are skipped and the\n  technical score blends only the tools that did run. Install semgrep for the full scan.")
    );
  }

  const scoreArgs = [SCORE_SCRIPT, "--gitmine", gitmineOut];
  if (semgrepOut) scoreArgs.push("--semgrep", semgrepOut);
  if (jscpdOut) scoreArgs.push("--jscpd", jscpdOut);
  if (gitleaksOut) scoreArgs.push("--gitleaks", gitleaksOut);
  if (banditOut) scoreArgs.push("--bandit", banditOut);
  if (pipAuditOut) scoreArgs.push("--pipaudit", pipAuditOut);
  if (npmAuditOut) scoreArgs.push("--npmaudit", npmAuditOut);

  const outPath = args.out ? path.resolve(args.out) : path.resolve("ai-debt-report.md");
  const htmlPath = args.html === undefined ? outPath.replace(/\.md$/, "") + ".html" : args.html ? path.resolve(args.html) : null;
  const csvPath = args.csv === undefined ? outPath.replace(/\.md$/, "") + "-csv" : args.csv ? path.resolve(args.csv) : null;
  const rawJsonPath = path.join(workDir, "scores.json");

  scoreArgs.push("--out", outPath, "--json", rawJsonPath);
  if (htmlPath) scoreArgs.push("--html", htmlPath);
  if (args.sarif) scoreArgs.push("--sarif", path.resolve(args.sarif));
  if (csvPath) scoreArgs.push("--csv", csvPath);
  if (args.badge) scoreArgs.push("--badge", path.resolve(args.badge));
  if (args["fail-on-score"] !== undefined) scoreArgs.push("--fail-on-score", args["fail-on-score"]);
  if (changedFiles) scoreArgs.push("--files-scanned", String(changedFiles.length));

  // spawnSync (not execFileSync) deliberately — once --fail-on-score can
  // make score.js exit non-zero on purpose, execFileSync would throw here
  // and crash the whole CLI instead of letting us report cleanly and exit
  // with the right code ourselves. stderr is captured (not ignored) so a
  // real scoring failure can be surfaced instead of swallowed.
  const scoreRun = spawnSync("node", scoreArgs, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  step("Scoring", () => scoreRun.status === 0 || scoreRun.status === 1);

  // Exit status 1 is reserved for --fail-on-score; anything else non-zero
  // (or a missing scores.json) means scoring itself failed — report the
  // captured error instead of crashing on JSON.parse of a missing file.
  if ((scoreRun.status !== 0 && scoreRun.status !== 1) || !fileExists(rawJsonPath)) {
    const detail = (scoreRun.stderr || "").trim();
    console.error(c.red(`\nScoring failed${detail ? `:\n${detail}` : "."}`));
    fs.rmSync(workDir, { recursive: true, force: true });
    process.exit(scoreRun.status || 1);
  }

  const scores = JSON.parse(fs.readFileSync(rawJsonPath, "utf8"));
  if (args.json) {
    const jsonTarget = path.resolve(args.json);
    fs.mkdirSync(path.dirname(jsonTarget), { recursive: true });
    fs.copyFileSync(rawJsonPath, jsonTarget);
  }

  let pdfPath = null;
  const pdfRequested = args.pdf === undefined ? true : Boolean(args.pdf);
  if (pdfRequested) {
    if (!htmlPath) {
      // Only warn if the user explicitly asked for --pdf — if it's just the
      // default kicking in while --html "" was also passed, skip quietly.
      if (args.pdf) {
        console.error(c.yellow("  --pdf requires an HTML report to render from — can't combine with --html \"\""));
      }
    } else {
      const pdfTarget = args.pdf ? path.resolve(args.pdf) : outPath.replace(/\.md$/, "") + ".pdf";
      // Only report a PDF path if the export actually produced one — a
      // skipped export (no Chromium on PATH) used to still print the path.
      pdfPath = step("PDF export", () => runPdfExport(htmlPath, pdfTarget));
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true });

  let history = null;
  if (args.history) {
    const historyPath = path.resolve(args.history);
    history = recordHistory(historyPath, targetPath, scores);
  }

  printSummaryBox(
    scores,
    outPath,
    htmlPath,
    pdfPath,
    history,
    args.sarif ? path.resolve(args.sarif) : null,
    args.badge ? path.resolve(args.badge) : null,
    csvPath
  );

  // Propagate score.js's exit code — this is how --fail-on-score reaches
  // a CI system: a real non-zero exit, not just text in a log.
  if (scoreRun.status && scoreRun.status !== 0) {
    process.exitCode = scoreRun.status;
  }
}

main();
