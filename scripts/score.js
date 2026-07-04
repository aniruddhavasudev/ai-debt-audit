#!/usr/bin/env node
/**
 * score.js — combines Semgrep findings (technical debt) with git-mine.js
 * output (cognitive + intent debt) into one composite AI-Debt Score.
 *
 * Usage:
 *   node score.js --semgrep semgrep.json --gitmine gitmine.json [--out report.md]
 *
 * Score convention (matches techdebt.fail's public calculator, so a buyer
 * who's already seen that tool has an intuitive frame of reference):
 *   0-100, HIGHER = MORE DEBT/RISK.
 *   Tiers: Low 0-25, Medium 26-50, High 51-75, Critical 76-100.
 *
 * Category weights are a v1 heuristic, not a scientifically derived
 * constant — the plan (see project notes) is to calibrate these against
 * 10-15 real audited repos before the first paid customer, and revise
 * openly as real outcomes come in. Treat every constant in this file as
 * provisional.
 */

import fs from "node:fs";

const WEIGHTS = {
  technical: 0.5,
  cognitive: 0.25,
  intent: 0.25,
};

// How the technical-debt category splits across its three input tools.
// Gitleaks gets real weight despite being the simplest input because it
// scans full git *history*, not just the current snapshot — a secret
// that was committed and later deleted is still a live breach risk that
// Semgrep (snapshot-only) and jscpd (duplication-only) cannot see at all.
const TECHNICAL_SUBWEIGHTS = {
  semgrep: 0.6,
  duplication: 0.2,
  historicalSecrets: 0.2,
};

// "If the average weighted Semgrep finding-score per file reaches this
// value, technical debt score saturates at 100." Chosen as a starting
// point, not derived from data yet.
const TECHNICAL_SATURATION_PER_FILE = 2.0;

// "If duplicated-line percentage (from jscpd) reaches this value,
// duplication score saturates at 100." 20% duplication is a commonly
// cited red-flag threshold in code-quality literature — a starting
// point, not derived from our own data yet.
const DUPLICATION_SATURATION_PERCENT = 20;

// "Each historical secret found by gitleaks adds this many points,
// capped at 100." A single leaked credential is already a severe,
// binary risk — a handful of them shouldn't need to compound much
// further to hit Critical.
const POINTS_PER_LEAKED_SECRET = 25;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scoreTechnicalDebt(semgrepResults, totalFilesScanned) {
  const findings = semgrepResults.results || [];
  const byCategory = {};
  let totalWeight = 0;

  for (const finding of findings) {
    const category = finding.extra?.metadata?.ai_debt_category || "uncategorized";
    const weight = Number(finding.extra?.metadata?.weight ?? 1);
    byCategory[category] = byCategory[category] || { count: 0, weight: 0 };
    byCategory[category].count += 1;
    byCategory[category].weight += weight;
    totalWeight += weight;
  }

  const filesForNormalization = Math.max(totalFilesScanned, 1);
  const weightedFindingsPerFile = totalWeight / filesForNormalization;
  const rawScore = 100 * (weightedFindingsPerFile / TECHNICAL_SATURATION_PER_FILE);
  const score = Math.round(Math.min(100, rawScore));

  return { score, byCategory, totalFindings: findings.length, totalWeight };
}

function scoreDuplication(jscpdResults) {
  if (!jscpdResults) return null;
  const percentage = jscpdResults.statistics?.total?.percentage ?? 0;
  const score = Math.round(Math.min(100, 100 * (percentage / DUPLICATION_SATURATION_PERCENT)));
  return {
    score,
    percentage,
    duplicatedLines: jscpdResults.statistics?.total?.duplicatedLines ?? 0,
    totalLines: jscpdResults.statistics?.total?.lines ?? 0,
    clones: jscpdResults.statistics?.total?.clones ?? 0,
  };
}

function scoreHistoricalSecrets(gitleaksResults) {
  if (!gitleaksResults) return null;
  const leaks = Array.isArray(gitleaksResults) ? gitleaksResults : [];
  const score = Math.round(Math.min(100, leaks.length * POINTS_PER_LEAKED_SECRET));
  return {
    score,
    leakCount: leaks.length,
    leaks: leaks.map((l) => ({
      rule: l.RuleID,
      file: l.File,
      line: l.StartLine,
      commit: l.Commit?.slice(0, 8),
    })),
  };
}

function combineTechnicalDebt(semgrepScore, duplication, historicalSecrets) {
  // If a tool wasn't run, redistribute its weight across the tools that
  // were — a report missing gitleaks shouldn't silently understate risk
  // by averaging in a phantom zero.
  const parts = [{ score: semgrepScore, weight: TECHNICAL_SUBWEIGHTS.semgrep }];
  if (duplication) parts.push({ score: duplication.score, weight: TECHNICAL_SUBWEIGHTS.duplication });
  if (historicalSecrets) parts.push({ score: historicalSecrets.score, weight: TECHNICAL_SUBWEIGHTS.historicalSecrets });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const blended = parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;

  return Math.round(blended);
}

function scoreCognitiveDebt(gitMine) {
  const busFactorRiskRatio = gitMine.busFactorStats?.busFactorRiskRatio ?? 0;
  const score = Math.round(100 * busFactorRiskRatio);
  return { score, busFactorRiskRatio, ...gitMine.busFactorStats };
}

function scoreIntentDebt(gitMine) {
  const genericMessageRatio = gitMine.commitStats?.genericMessageRatio ?? 0;
  const score = Math.round(100 * genericMessageRatio);
  return {
    score,
    genericMessageRatio,
    refactorRatio: gitMine.commitStats?.refactorRatio ?? 0,
    note: "refactorRatio is reported as a trend indicator, not currently scored — a shrinking refactor ratio over time is a leading signal of accumulating technical debt, but a single point-in-time snapshot doesn't tell you the trend direction.",
  };
}

function riskTier(score) {
  if (score <= 25) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 75) return "High";
  return "Critical";
}

function topFindings(semgrepResults, limit = 10) {
  const findings = semgrepResults.results || [];
  return [...findings]
    .sort((a, b) => (b.extra?.metadata?.weight ?? 0) - (a.extra?.metadata?.weight ?? 0))
    .slice(0, limit)
    .map((f) => ({
      rule: f.check_id.split(".").pop(),
      severity: f.extra?.severity,
      weight: f.extra?.metadata?.weight,
      path: f.path,
      line: f.start?.line,
      message: (f.extra?.message || "").trim().replace(/\s+/g, " "),
    }));
}

function renderMarkdown({ composite, tier, technical, duplication, historicalSecrets, cognitive, intent, top, repoPath }) {
  const lines = [];
  lines.push(`# AI-Debt Report — ${repoPath}`);
  lines.push(`\nGenerated: ${new Date().toISOString()}\n`);
  lines.push(`## Composite Score: ${composite}/100 (${tier} risk)\n`);
  lines.push(`| Category | Score | Weight |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Technical debt (blended) | ${technical.blendedScore}/100 | 50% |`);
  lines.push(`| Cognitive debt | ${cognitive.score}/100 | 25% |`);
  lines.push(`| Intent debt | ${intent.score}/100 | 25% |`);

  lines.push(`\n## Technical Debt — ${technical.totalFindings} Semgrep findings\n`);
  lines.push(`Blended from Semgrep (60%), duplication (20%), historical secrets (20%):\n`);
  for (const [category, stats] of Object.entries(technical.byCategory)) {
    lines.push(`- **${category}**: ${stats.count} findings (weighted ${stats.weight})`);
  }

  lines.push(`\n### Top findings (by severity weight)\n`);
  for (const f of top) {
    lines.push(`- [${f.severity}] \`${f.rule}\` — ${f.path}:${f.line} — ${f.message}`);
  }

  if (duplication) {
    lines.push(`\n### Duplication (jscpd)\n`);
    lines.push(`- ${duplication.percentage.toFixed(1)}% duplicated lines (${duplication.duplicatedLines}/${duplication.totalLines}) across ${duplication.clones} clone pairs — sub-score ${duplication.score}/100`);
  }

  if (historicalSecrets) {
    lines.push(`\n### Historical Secrets (gitleaks — full git history, not just current files)\n`);
    if (historicalSecrets.leakCount === 0) {
      lines.push(`- None found — sub-score 0/100`);
    } else {
      lines.push(`- **${historicalSecrets.leakCount} leaked secret(s) found in git history** — sub-score ${historicalSecrets.score}/100`);
      for (const l of historicalSecrets.leaks) {
        lines.push(`  - \`${l.rule}\` in ${l.file}:${l.line} (commit ${l.commit})`);
      }
    }
  }

  lines.push(`\n## Cognitive Debt (knowledge concentration)\n`);
  lines.push(`- Bus-factor risk ratio: ${(cognitive.busFactorRiskRatio * 100).toFixed(1)}% of tracked files have had only one author ever`);
  lines.push(`- Total files tracked in git history: ${cognitive.totalFilesTracked}`);

  lines.push(`\n## Intent Debt (externalized rationale)\n`);
  lines.push(`- Generic/uninformative commit messages: ${(intent.genericMessageRatio * 100).toFixed(1)}% of commits`);
  lines.push(`- Refactor-commit ratio (trend indicator, not scored): ${(intent.refactorRatio * 100).toFixed(1)}%`);

  lines.push(`\n---\n*Methodology is a v1 heuristic pending calibration against real audited repos — see scripts/score.js for exact weights and formulas.*`);

  return lines.join("\n") + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.semgrep || !args.gitmine) {
    console.error(
      "Usage: node score.js --semgrep semgrep.json --gitmine gitmine.json " +
        "[--jscpd jscpd-report.json] [--gitleaks gitleaks.json] [--out report.md] [--json raw.json]"
    );
    process.exit(1);
  }

  const semgrepResults = loadJson(args.semgrep);
  const gitMine = loadJson(args.gitmine);
  const jscpdResults = args.jscpd ? loadJson(args.jscpd) : null;
  const gitleaksResults = args.gitleaks ? loadJson(args.gitleaks) : null;

  const totalFilesScanned = gitMine.busFactorStats?.totalFilesTracked || 1;

  const semgrepTechnical = scoreTechnicalDebt(semgrepResults, totalFilesScanned);
  const duplication = scoreDuplication(jscpdResults);
  const historicalSecrets = scoreHistoricalSecrets(gitleaksResults);
  const blendedScore = combineTechnicalDebt(semgrepTechnical.score, duplication, historicalSecrets);
  const technical = { ...semgrepTechnical, blendedScore };

  const cognitive = scoreCognitiveDebt(gitMine);
  const intent = scoreIntentDebt(gitMine);

  const composite = Math.round(
    technical.blendedScore * WEIGHTS.technical +
      cognitive.score * WEIGHTS.cognitive +
      intent.score * WEIGHTS.intent
  );
  const tier = riskTier(composite);
  const top = topFindings(semgrepResults);

  const report = renderMarkdown({
    composite,
    tier,
    technical,
    duplication,
    historicalSecrets,
    cognitive,
    intent,
    top,
    repoPath: gitMine.repoPath,
  });

  if (args.out) {
    fs.writeFileSync(args.out, report);
    console.error(`Report written to ${args.out}`);
  } else {
    process.stdout.write(report);
  }

  // Also emit the raw numbers as JSON on stderr-adjacent file if requested,
  // useful for future dashboarding without re-parsing the Markdown.
  if (args.json) {
    fs.writeFileSync(
      args.json,
      JSON.stringify({ composite, tier, technical, duplication, historicalSecrets, cognitive, intent }, null, 2)
    );
  }
}

main();
