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

// "If the average weighted Semgrep finding-score per file reaches this
// value, technical debt score saturates at 100." Chosen as a starting
// point, not derived from data yet.
const TECHNICAL_SATURATION_PER_FILE = 2.0;

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

function renderMarkdown({ composite, tier, technical, cognitive, intent, top, repoPath }) {
  const lines = [];
  lines.push(`# AI-Debt Report — ${repoPath}`);
  lines.push(`\nGenerated: ${new Date().toISOString()}\n`);
  lines.push(`## Composite Score: ${composite}/100 (${tier} risk)\n`);
  lines.push(`| Category | Score | Weight |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Technical debt | ${technical.score}/100 | 50% |`);
  lines.push(`| Cognitive debt | ${cognitive.score}/100 | 25% |`);
  lines.push(`| Intent debt | ${intent.score}/100 | 25% |`);

  lines.push(`\n## Technical Debt — ${technical.totalFindings} findings\n`);
  for (const [category, stats] of Object.entries(technical.byCategory)) {
    lines.push(`- **${category}**: ${stats.count} findings (weighted ${stats.weight})`);
  }

  lines.push(`\n### Top findings (by severity weight)\n`);
  for (const f of top) {
    lines.push(`- [${f.severity}] \`${f.rule}\` — ${f.path}:${f.line} — ${f.message}`);
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
    console.error("Usage: node score.js --semgrep semgrep.json --gitmine gitmine.json [--out report.md]");
    process.exit(1);
  }

  const semgrepResults = loadJson(args.semgrep);
  const gitMine = loadJson(args.gitmine);

  const totalFilesScanned = gitMine.busFactorStats?.totalFilesTracked || 1;

  const technical = scoreTechnicalDebt(semgrepResults, totalFilesScanned);
  const cognitive = scoreCognitiveDebt(gitMine);
  const intent = scoreIntentDebt(gitMine);

  const composite = Math.round(
    technical.score * WEIGHTS.technical +
      cognitive.score * WEIGHTS.cognitive +
      intent.score * WEIGHTS.intent
  );
  const tier = riskTier(composite);
  const top = topFindings(semgrepResults);

  const report = renderMarkdown({
    composite,
    tier,
    technical,
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
    fs.writeFileSync(args.json, JSON.stringify({ composite, tier, technical, cognitive, intent }, null, 2));
  }
}

main();
