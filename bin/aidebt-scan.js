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
 *                              [--sarif results.sarif] [--fail-on-score N] [--pdf report.pdf]
 *                              [--history history.json] [--diff base-ref]
 *
 * By default, both a Markdown report (--out, default ./ai-debt-report.md)
 * and an HTML report (same name, .html extension) are written. Pass
 * --html "" to skip HTML generation.
 *
 * --sarif writes GitHub's native code-scanning format (upload with
 * github/codeql-action/upload-sarif to surface findings in the Security tab).
 * --fail-on-score N exits non-zero if the composite score is >= N — the
 * hook a CI pipeline needs to actually block a PR, not just log a number.
 * --pdf renders the HTML report to PDF via headless Chrome/Chromium — the
 * actual client-deliverable format, not just an internal artifact. Requires
 * an HTML report to exist (not compatible with --html "").
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

function getGitCommitSha(targetPath) {
  try {
    return execFileSync("git", ["-C", targetPath, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

// Appends this run's score to a small local JSON history file so a repo can
// be tracked over time — "is this getting better or worse" is a genuinely
// different question than "what's the score right now," and one-shot
// competitors (the manual audit agencies) can't answer it at all since they
// don't run continuously against the same repo.
function recordHistory(historyPath, targetPath, scores) {
  let history = [];
  if (fileExists(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
      if (!Array.isArray(history)) history = [];
    } catch {
      console.error(c.yellow(`  Warning: ${historyPath} exists but isn't valid JSON — starting a new history.`));
      history = [];
    }
  }

  history.push({
    timestamp: new Date().toISOString(),
    commit: getGitCommitSha(targetPath),
    composite: scores.composite,
    tier: scores.tier,
    technical: scores.technical.blendedScore,
    cognitive: scores.cognitive.score,
    intent: scores.intent.score,
  });

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  return history;
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

// Semgrep's own free, community-maintained registry packs — broader
// framework-specific coverage (XSS via mark_safe, mass assignment, open
// redirects) than we'd hand-write ourselves. Layered alongside our own
// custom AI-debt rules, not instead of them: the registry doesn't know
// about AI-specific smells (placeholder stubs, framework misuse patterns),
// only our rules do.
const SEMGREP_REGISTRY_PACKS = ["p/django", "p/flask"];

function runSemgrep(targetPath, outPath, changedFiles) {
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
    console.error(c.yellow("  bandit not found on PATH — skipping Python security scan (pip install bandit)"));
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
    console.error(c.yellow("  pip-audit not found on PATH — skipping dependency vulnerability scan (pip install pip-audit)"));
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

// Prefer chromium (lighter, common on CI images) but fall back to a full
// Chrome install — either one's headless print-to-pdf is the same engine
// that renders the HTML report, so the PDF is pixel-faithful to it.
const PDF_RENDERER_CANDIDATES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];

function findPdfRenderer() {
  return PDF_RENDERER_CANDIDATES.find(binExists) || null;
}

function runPdfExport(htmlPath, pdfPath) {
  const renderer = findPdfRenderer();
  if (!renderer) {
    console.error(c.yellow("  no Chromium/Chrome found on PATH — skipping PDF export"));
    return null;
  }
  try {
    execFileSync(
      renderer,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
  } catch {
    // Headless Chrome's own harmless dbus/gpu warnings can make this exit
    // non-zero even on success — check for the actual output file instead.
  }
  return fileExists(pdfPath) ? pdfPath : null;
}

function printSummaryBox(scores, outPath, htmlPath, pdfPath, history, sarifPath, badgePath) {
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

  if (!semgrepOut || !gitmineOut) {
    console.error(
      c.red("\nCannot produce a score without Semgrep and git-mine results — both are required inputs, not optional enrichments.")
    );
    process.exit(1);
  }

  const scoreArgs = [SCORE_SCRIPT, "--semgrep", semgrepOut, "--gitmine", gitmineOut];
  if (jscpdOut) scoreArgs.push("--jscpd", jscpdOut);
  if (gitleaksOut) scoreArgs.push("--gitleaks", gitleaksOut);
  if (banditOut) scoreArgs.push("--bandit", banditOut);
  if (pipAuditOut) scoreArgs.push("--pipaudit", pipAuditOut);

  const outPath = args.out ? path.resolve(args.out) : path.resolve("ai-debt-report.md");
  const htmlPath = args.html === undefined ? outPath.replace(/\.md$/, "") + ".html" : args.html ? path.resolve(args.html) : null;
  const rawJsonPath = path.join(workDir, "scores.json");

  scoreArgs.push("--out", outPath, "--json", rawJsonPath);
  if (htmlPath) scoreArgs.push("--html", htmlPath);
  if (args.sarif) scoreArgs.push("--sarif", path.resolve(args.sarif));
  if (args.badge) scoreArgs.push("--badge", path.resolve(args.badge));
  if (args["fail-on-score"] !== undefined) scoreArgs.push("--fail-on-score", args["fail-on-score"]);
  if (changedFiles) scoreArgs.push("--files-scanned", String(changedFiles.length));

  // spawnSync (not execFileSync) deliberately — once --fail-on-score can
  // make score.js exit non-zero on purpose, execFileSync would throw here
  // and crash the whole CLI instead of letting us report cleanly and exit
  // with the right code ourselves.
  const scoreRun = spawnSync("node", scoreArgs, { stdio: ["ignore", "ignore", "ignore"] });
  step("Scoring", () => scoreRun.status === 0 || scoreRun.status === 1);

  const scores = JSON.parse(fs.readFileSync(rawJsonPath, "utf8"));
  if (args.json) fs.copyFileSync(rawJsonPath, path.resolve(args.json));

  let pdfPath = null;
  if (args.pdf) {
    if (!htmlPath) {
      console.error(c.yellow("  --pdf requires an HTML report to render from — can't combine with --html \"\""));
    } else {
      pdfPath = path.resolve(args.pdf);
      step("PDF export", () => runPdfExport(htmlPath, pdfPath));
    }
  }

  fs.rmSync(workDir, { recursive: true, force: true });

  let history = null;
  if (args.history) {
    const historyPath = path.resolve(args.history);
    history = recordHistory(historyPath, targetPath, scores);
  }

  printSummaryBox(scores, outPath, htmlPath, pdfPath, history, args.sarif ? path.resolve(args.sarif) : null, args.badge ? path.resolve(args.badge) : null);

  // Propagate score.js's exit code — this is how --fail-on-score reaches
  // a CI system: a real non-zero exit, not just text in a log.
  if (scoreRun.status && scoreRun.status !== 0) {
    process.exitCode = scoreRun.status;
  }
}

main();
