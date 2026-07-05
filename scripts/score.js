#!/usr/bin/env node
/**
 * score.js — thin CLI orchestration: loads tool output (Semgrep, git-mine,
 * jscpd, gitleaks, Bandit, pip-audit, npm audit), hands it to scoring.js for
 * the actual math, assembles the shared report-data object (report-data.js),
 * and writes whichever report formats were requested via the render/
 * modules.
 *
 * Usage:
 *   node score.js --semgrep semgrep.json --gitmine gitmine.json [--out report.md]
 *
 * The scoring math itself (weights, saturation constants, per-category
 * formulas) lives in scripts/scoring.js — treat every constant there as
 * provisional, pending calibration against real audited repos.
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "../lib/args.js";
import { ensureParentDir } from "../lib/fs-utils.js";
import { loadConfig, applyConfigFilters } from "./config.js";
import {
  scoreTechnicalDebt,
  scoreDuplication,
  scoreHistoricalSecrets,
  scoreBandit,
  scoreDependencyVulnerabilities,
  combineTechnicalDebt,
  scoreCognitiveDebt,
  scoreIntentDebt,
  riskTier,
} from "./scoring.js";
import { buildReportData } from "./report-data.js";
import { renderMarkdown } from "./render/markdown.js";
import { renderHtml } from "./render/html.js";
import { renderCsvWorkbook } from "./render/csv.js";
import { renderSarif } from "./render/sarif.js";
import { renderShieldsBadge } from "./render/badge.js";

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.gitmine) {
    console.error(
      "Usage: node score.js --semgrep semgrep.json --gitmine gitmine.json " +
        "[--jscpd jscpd-report.json] [--gitleaks gitleaks.json] [--bandit bandit.json] " +
        "[--pipaudit pip-audit.json] [--npmaudit npm-audit.json] [--out report.md] [--html report.html] " +
        "[--json raw.json] [--sarif results.sarif] [--csv findings.csv] [--fail-on-score N] [--files-scanned N]"
    );
    process.exit(1);
  }

  // Semgrep is optional (the npx zero-install path) — an empty result set
  // with semgrepRan=false is scored as "didn't run" (weight redistributed),
  // never as "ran and found nothing."
  const semgrepRan = Boolean(args.semgrep);
  let semgrepResults = semgrepRan ? loadJson(args.semgrep) : { results: [] };
  const gitMine = loadJson(args.gitmine);
  const jscpdResults = args.jscpd ? loadJson(args.jscpd) : null;
  const gitleaksResults = args.gitleaks ? loadJson(args.gitleaks) : null;
  let banditResults = args.bandit ? loadJson(args.bandit) : null;
  const pipAuditResults = args.pipaudit ? loadJson(args.pipaudit) : null;
  const npmAuditResults = args.npmaudit ? loadJson(args.npmaudit) : null;

  // Defined here (not just before rendering, where it used to live) because
  // config filtering needs it too: Semgrep/Bandit report absolute paths
  // (the CLI always resolves the target to an absolute path before invoking
  // any tool), but .aidebtrc.json's excludePaths patterns are written
  // relative to the repo root ("vendor/**", not "/home/x/repo/vendor/**").
  // Applying the glob against the raw absolute path meant excludePaths
  // silently matched nothing, ever — caught by actually running this
  // repo's own self-scan config, not by the unit tests, which used
  // relative paths in their fixtures and never exercised this mismatch.
  const repoRoot = gitMine.repoPath;
  // Only absolute paths get relativized. Semgrep/Bandit report absolute
  // paths, but gitleaks reports repo-relative ones already — running
  // path.relative() on those resolved them against the CWD instead, so a
  // scan launched from outside the target repo displayed leak paths like
  // "../../root/target/config.py". Found while capturing README output.
  const toRelative = (p) => (p && path.isAbsolute(p) ? path.relative(repoRoot, p) || path.basename(p) : p);

  // Config is loaded (and findings filtered by it) before any scoring
  // happens — ignoreRules/excludePaths need to remove findings from the
  // pool entirely, not just hide them cosmetically after the score is
  // already computed.
  const config = loadConfig(repoRoot);
  semgrepResults = applyConfigFilters(semgrepResults, config, {
    ruleIdKey: (r) => r.check_id.split(".").pop(),
    pathKey: (r) => toRelative(r.path),
  });
  if (banditResults) {
    banditResults = applyConfigFilters(banditResults, config, {
      ruleIdKey: (r) => r.test_id,
      pathKey: (r) => toRelative(r.filename),
    });
  }

  // In --diff mode, only a handful of files were actually scanned by
  // Semgrep/Bandit — normalizing by the *whole repo's* file count (from
  // git-mine, which is always repo-wide) would make findings concentrated
  // in a small PR look artificially tiny. --files-scanned lets the CLI
  // override this with the actual scanned-file count when it knows better.
  const totalFilesScanned = args["files-scanned"]
    ? Number(args["files-scanned"])
    : gitMine.busFactorStats?.totalFilesTracked || 1;

  const semgrepTechnical = semgrepRan
    ? scoreTechnicalDebt(semgrepResults, totalFilesScanned)
    : { score: null, byCategory: {}, totalFindings: 0, totalWeight: 0, skipped: true };
  const duplication = scoreDuplication(jscpdResults);
  const historicalSecrets = scoreHistoricalSecrets(gitleaksResults);
  const bandit = scoreBandit(banditResults, totalFilesScanned);
  const dependencyVulns = scoreDependencyVulnerabilities(pipAuditResults, npmAuditResults);
  const blendedScore = combineTechnicalDebt(semgrepRan ? semgrepTechnical.score : null, duplication, historicalSecrets, bandit, dependencyVulns);
  const technical = { ...semgrepTechnical, blendedScore };

  const cognitive = scoreCognitiveDebt(gitMine);
  const intent = scoreIntentDebt(gitMine);

  const composite = Math.round(
    technical.blendedScore * config.weights.technical +
      cognitive.score * config.weights.cognitive +
      intent.score * config.weights.intent
  );
  const tier = riskTier(composite);

  // Single shared data-prep step (see report-data.js) consumed by every
  // human-readable renderer below — this is what stops Markdown and HTML
  // from independently reshaping the same data and silently drifting
  // apart, which already happened once (HTML was missing gitleaks leak
  // details that Markdown had).
  const reportData = buildReportData({
    semgrepResults,
    technical,
    duplication,
    historicalSecrets,
    bandit,
    dependencyVulns,
    cognitive,
    intent,
    composite,
    tier,
    repoPath: path.basename(gitMine.repoPath),
    weights: config.weights,
    toRelative,
  });

  const report = renderMarkdown(reportData);

  if (args.out) {
    ensureParentDir(args.out);
    fs.writeFileSync(args.out, report);
    console.error(`Report written to ${args.out}`);
  } else {
    process.stdout.write(report);
  }

  if (args.html) {
    const html = renderHtml(reportData);
    ensureParentDir(args.html);
    fs.writeFileSync(args.html, html);
    console.error(`HTML report written to ${args.html}`);
  }

  // Also emit the raw numbers as JSON on stderr-adjacent file if requested,
  // useful for future dashboarding without re-parsing the Markdown.
  if (args.json) {
    ensureParentDir(args.json);
    fs.writeFileSync(
      args.json,
      JSON.stringify(
        { composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent, weights: config.weights },
        null,
        2
      )
    );
  }

  if (args.badge) {
    const badge = renderShieldsBadge(composite, tier);
    ensureParentDir(args.badge);
    fs.writeFileSync(args.badge, JSON.stringify(badge, null, 2));
    console.error(`Shields.io badge JSON written to ${args.badge}`);
  }

  if (args.sarif) {
    const sarif = renderSarif(semgrepResults, banditResults, repoRoot);
    ensureParentDir(args.sarif);
    fs.writeFileSync(args.sarif, JSON.stringify(sarif, null, 2));
    console.error(`SARIF written to ${args.sarif}`);
  }

  if (args.csv) {
    // args.csv is a directory, not a single file — see render/csv.js's
    // comment for why a real multi-tab .xlsx isn't what this builds.
    fs.mkdirSync(args.csv, { recursive: true });
    const workbook = renderCsvWorkbook(reportData);
    for (const [filename, content] of Object.entries(workbook)) {
      fs.writeFileSync(path.join(args.csv, filename), content);
    }
    console.error(`CSV workbook written to ${args.csv}/ (summary.csv, technical-debt.csv, knowledge-risk.csv, missing-context.csv)`);
  }

  // Non-zero exit lets CI treat "AI-debt score too high" as a failed check,
  // the same way a failed test suite would be. Threshold is opt-in — a
  // bare `score.js` run should never fail just because it ran.
  if (args["fail-on-score"] !== undefined) {
    const threshold = Number(args["fail-on-score"]);
    // NaN silently disables the gate: `composite >= NaN` is always false,
    // so a typo'd threshold would make CI pass forever. Fail loudly instead.
    if (!Number.isFinite(threshold)) {
      console.error(`Error: --fail-on-score expects a number, got '${args["fail-on-score"]}'`);
      process.exitCode = 2;
      return;
    }
    if (composite >= threshold) {
      console.error(`\nComposite score ${composite} >= threshold ${threshold} — failing.`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    // A clean one-line error beats a raw stack trace: every failure here is
    // an input/filesystem problem (unwritable path, malformed tool output),
    // not a bug the user can act on from a stack.
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }
}
