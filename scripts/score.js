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
import path from "node:path";

const WEIGHTS = {
  technical: 0.5,
  cognitive: 0.25,
  intent: 0.25,
};

// How the technical-debt category splits across its five input tools.
// Gitleaks gets real weight despite being the simplest input because it
// scans full git *history*, not just the current snapshot — a secret
// that was committed and later deleted is still a live breach risk that
// Semgrep (snapshot-only) and jscpd (duplication-only) cannot see at all.
// Semgrep's own share dropped from 0.6 to make room for Bandit and
// pip-audit, not because Semgrep matters less — it still carries every
// AI-debt-specific custom rule (placeholder stubs, framework misuse) that
// no off-the-shelf tool knows about; Bandit and pip-audit only ever
// contribute when they actually ran (see combineTechnicalDebt).
const TECHNICAL_SUBWEIGHTS = {
  semgrep: 0.35,
  bandit: 0.15,
  duplication: 0.15,
  historicalSecrets: 0.2,
  dependencyVulns: 0.15,
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

// Bandit severity weights (LOW/MEDIUM/HIGH), summed then normalized per
// file scanned the same way Semgrep findings are — same rationale, a
// starting point pending calibration, not derived from real data yet.
const BANDIT_SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 3, HIGH: 5 };
const BANDIT_SATURATION_PER_FILE = 1.5;

// "Each distinct vulnerable *package* (not each individual CVE within it)
// adds this many points, capped at 100." Counting packages rather than
// raw CVE count avoids one heavily-CVE'd package (e.g. an ancient Flask)
// dominating the score disproportionately to how many risky dependencies
// actually exist.
const POINTS_PER_VULNERABLE_PACKAGE = 20;

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

  // Dampened weights (e.g. 4 * 0.2 from the middleware auth-check fix) are
  // not exactly representable in binary floating point, so summing several
  // of them can produce noise like 2.4000000000000004. Round for display —
  // this is purely cosmetic, the scoring math above already happened.
  for (const stats of Object.values(byCategory)) {
    stats.weight = Math.round(stats.weight * 100) / 100;
  }
  totalWeight = Math.round(totalWeight * 100) / 100;

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

function scoreBandit(banditResults, totalFilesScanned) {
  if (!banditResults) return null;
  const findings = banditResults.results || [];
  const byCategory = {};
  let totalWeight = 0;

  for (const finding of findings) {
    const severity = finding.issue_severity || "LOW";
    const weight = BANDIT_SEVERITY_WEIGHT[severity] ?? 1;
    byCategory[severity] = (byCategory[severity] || 0) + 1;
    totalWeight += weight;
  }

  const filesForNormalization = Math.max(totalFilesScanned, 1);
  const weightedFindingsPerFile = totalWeight / filesForNormalization;
  const score = Math.round(Math.min(100, 100 * (weightedFindingsPerFile / BANDIT_SATURATION_PER_FILE)));

  return {
    score,
    totalFindings: findings.length,
    byCategory,
    top: [...findings]
      .sort((a, b) => (BANDIT_SEVERITY_WEIGHT[b.issue_severity] ?? 0) - (BANDIT_SEVERITY_WEIGHT[a.issue_severity] ?? 0))
      .slice(0, 5)
      .map((f) => ({
        testId: f.test_id,
        severity: f.issue_severity,
        file: f.filename,
        line: f.line_number,
        text: f.issue_text,
      })),
  };
}

function scoreDependencyVulnerabilities(pipAuditResults) {
  if (!pipAuditResults) return null;
  const dependencies = pipAuditResults.dependencies || [];
  const vulnerablePackages = dependencies.filter((d) => (d.vulns || []).length > 0);
  const totalVulnCount = vulnerablePackages.reduce((sum, d) => sum + d.vulns.length, 0);
  const score = Math.round(Math.min(100, vulnerablePackages.length * POINTS_PER_VULNERABLE_PACKAGE));

  return {
    score,
    vulnerablePackageCount: vulnerablePackages.length,
    totalVulnCount,
    packages: vulnerablePackages.map((d) => ({
      name: d.name,
      version: d.version,
      vulnIds: d.vulns.map((v) => v.id),
      fixVersions: [...new Set(d.vulns.flatMap((v) => v.fix_versions || []))],
    })),
  };
}

function combineTechnicalDebt(semgrepScore, duplication, historicalSecrets, bandit, dependencyVulns) {
  // If a tool wasn't run, redistribute its weight across the tools that
  // were — a report missing gitleaks shouldn't silently understate risk
  // by averaging in a phantom zero. This also means a non-Python repo
  // (no bandit/pip-audit findings possible) is scored fairly on the tools
  // that actually apply to it, rather than penalized for a stack mismatch.
  const parts = [{ score: semgrepScore, weight: TECHNICAL_SUBWEIGHTS.semgrep }];
  if (duplication) parts.push({ score: duplication.score, weight: TECHNICAL_SUBWEIGHTS.duplication });
  if (historicalSecrets) parts.push({ score: historicalSecrets.score, weight: TECHNICAL_SUBWEIGHTS.historicalSecrets });
  if (bandit) parts.push({ score: bandit.score, weight: TECHNICAL_SUBWEIGHTS.bandit });
  if (dependencyVulns) parts.push({ score: dependencyVulns.score, weight: TECHNICAL_SUBWEIGHTS.dependencyVulns });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const blended = parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;

  return Math.round(blended);
}

// Bus-factor risk is only a meaningful *debt* signal once a real team
// exists to have knowledge silos within. A solo or two-person repo is,
// by construction, ~100% single-author-per-file — that's just what a
// small team looks like, not evidence of accumulating AI-assisted risk.
// This damping factor ramps from 0 (1 total author) to 1 (3+ total
// authors), so the score only "counts" once a silo is actually possible.
function teamSizeDampingFactor(totalAuthors) {
  return Math.min(1, Math.max(0, (totalAuthors - 1) / 2));
}

function scoreCognitiveDebt(gitMine) {
  const busFactorRiskRatio = gitMine.busFactorStats?.busFactorRiskRatio ?? 0;
  const totalAuthors = Object.keys(gitMine.commitStats?.authorCounts ?? {}).length;
  const dampingFactor = teamSizeDampingFactor(totalAuthors);
  const score = Math.round(100 * busFactorRiskRatio * dampingFactor);
  return { score, busFactorRiskRatio, totalAuthors, dampingFactor, ...gitMine.busFactorStats };
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
      dampenedReason: f.extra?.metadata?.dampened_reason,
    }));
}

function renderMarkdown({ composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent, top, repoPath }) {
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
  lines.push(`Blended from Semgrep, Bandit, duplication, historical secrets, and dependency vulnerabilities (only tools that actually ran contribute; see methodology note):\n`);
  for (const [category, stats] of Object.entries(technical.byCategory)) {
    lines.push(`- **${category}**: ${stats.count} findings (weighted ${stats.weight})`);
  }

  lines.push(`\n### Top findings (by severity weight)\n`);
  for (const f of top) {
    lines.push(`- [${f.severity}] \`${f.rule}\` — ${f.path}:${f.line} — ${f.message}`);
    if (f.dampenedReason) lines.push(`  - ⚠ *${f.dampenedReason}*`);
  }

  if (bandit) {
    lines.push(`\n### Python Security (Bandit) — ${bandit.totalFindings} findings\n`);
    lines.push(`- sub-score ${bandit.score}/100 — by severity: ${Object.entries(bandit.byCategory).map(([sev, n]) => `${sev} ${n}`).join(", ") || "none"}`);
    for (const f of bandit.top) {
      lines.push(`  - [${f.severity}] \`${f.testId}\` — ${f.file}:${f.line} — ${f.text}`);
    }
  }

  if (dependencyVulns) {
    lines.push(`\n### Dependency Vulnerabilities (pip-audit)\n`);
    if (dependencyVulns.vulnerablePackageCount === 0) {
      lines.push(`- No known-vulnerable dependencies found — sub-score 0/100`);
    } else {
      lines.push(`- **${dependencyVulns.vulnerablePackageCount} vulnerable package(s)**, ${dependencyVulns.totalVulnCount} known CVE(s) total — sub-score ${dependencyVulns.score}/100`);
      for (const p of dependencyVulns.packages) {
        lines.push(`  - \`${p.name}==${p.version}\` — ${p.vulnIds.join(", ")}${p.fixVersions.length ? ` (fix: ${p.fixVersions.join(", ")})` : ""}`);
      }
    }
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
  lines.push(`- Bus-factor risk ratio (raw): ${(cognitive.busFactorRiskRatio * 100).toFixed(1)}% of tracked files have had only one author ever`);
  lines.push(`- Total files tracked in git history: ${cognitive.totalFilesTracked}`);
  lines.push(`- Total distinct authors: ${cognitive.totalAuthors} (team-size damping factor: ${cognitive.dampingFactor.toFixed(2)})`);
  if (cognitive.totalAuthors <= 2) {
    lines.push(
      `- ⚠ *Score damped heavily — with only ${cognitive.totalAuthors} total contributor(s), single-author-per-file is structural, not a debt signal.*`
    );
  }

  lines.push(`\n## Intent Debt (externalized rationale)\n`);
  lines.push(`- Generic/uninformative commit messages: ${(intent.genericMessageRatio * 100).toFixed(1)}% of commits`);
  lines.push(`- Refactor-commit ratio (trend indicator, not scored): ${(intent.refactorRatio * 100).toFixed(1)}%`);

  lines.push(`\n---\n*Methodology is a v1 heuristic pending calibration against real audited repos — see scripts/score.js for exact weights and formulas.*`);

  return lines.join("\n") + "\n";
}

const TIER_COLORS = { Low: "#16a34a", Medium: "#ca8a04", High: "#ea580c", Critical: "#dc2626" };
const SEVERITY_COLORS = { ERROR: "#dc2626", WARNING: "#ca8a04", INFO: "#64748b" };

function scoreColor(score) {
  if (score <= 25) return TIER_COLORS.Low;
  if (score <= 50) return TIER_COLORS.Medium;
  if (score <= 75) return TIER_COLORS.High;
  return TIER_COLORS.Critical;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function categoryBarHtml(label, score, weightLabel) {
  const color = scoreColor(score);
  return `
    <div class="cat-row">
      <div class="cat-label">${label} <span class="cat-weight">${weightLabel}</span></div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${score}%;background:${color}"></div></div>
      <div class="cat-score" style="color:${color}">${score}/100</div>
    </div>`;
}

function renderHtml({ composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent, top, repoPath }) {
  const tierColor = TIER_COLORS[tier];

  const findingsRows = top
    .map(
      (f) => `
      <tr>
        <td><span class="badge" style="background:${SEVERITY_COLORS[f.severity] || "#64748b"}">${f.severity}</span></td>
        <td><code>${escapeHtml(f.rule)}</code></td>
        <td class="path">${escapeHtml(f.path)}:${f.line}</td>
        <td>${escapeHtml(f.message)}${f.dampenedReason ? `<div class="dampened">⚠ ${escapeHtml(f.dampenedReason)}</div>` : ""}</td>
      </tr>`
    )
    .join("");

  const categoryRows = Object.entries(technical.byCategory)
    .map(([cat, stats]) => `<li><strong>${escapeHtml(cat)}</strong>: ${stats.count} findings (weighted ${stats.weight})</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>AI-Debt Report — ${escapeHtml(repoPath)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0; padding: 40px; background: #f8fafc; color: #1e293b; line-height: 1.5;
  }
  .container { max-width: 900px; margin: 0 auto; }
  header { margin-bottom: 32px; }
  header h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
  header .meta { color: #64748b; font-size: 13px; }
  .score-card {
    display: flex; align-items: center; gap: 28px;
    background: white; border-radius: 12px; padding: 28px 32px; margin-bottom: 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 6px solid ${tierColor};
  }
  .score-circle {
    width: 96px; height: 96px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; flex-direction: column;
    background: ${tierColor}1a; border: 4px solid ${tierColor};
  }
  .score-circle .num { font-size: 28px; font-weight: 700; color: ${tierColor}; line-height: 1; }
  .score-circle .max { font-size: 11px; color: #64748b; }
  .score-text .tier { font-size: 20px; font-weight: 700; color: ${tierColor}; margin: 0 0 4px; }
  .score-text .sub { color: #64748b; font-size: 14px; }
  .card {
    background: white; border-radius: 12px; padding: 24px 28px; margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .card h2 { font-size: 16px; margin: 0 0 16px; color: #0f172a; }
  .cat-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .cat-label { width: 200px; font-size: 13px; color: #334155; }
  .cat-weight { color: #94a3b8; font-size: 11px; }
  .cat-bar-track { flex: 1; height: 10px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
  .cat-bar-fill { height: 100%; border-radius: 6px; }
  .cat-score { width: 60px; text-align: right; font-size: 13px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .badge { color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .path { color: #64748b; font-family: monospace; font-size: 12px; white-space: nowrap; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
  .dampened { color: #ca8a04; font-size: 12px; margin-top: 4px; }
  ul { margin: 0; padding-left: 20px; font-size: 13px; }
  footer { color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px; }
</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>AI-Debt Report</h1>
      <div class="meta">${escapeHtml(repoPath)} · generated ${new Date().toISOString()}</div>
    </header>

    <div class="score-card">
      <div class="score-circle"><div class="num">${composite}</div><div class="max">/ 100</div></div>
      <div class="score-text">
        <div class="tier">${tier} Risk</div>
        <div class="sub">Blended from technical (50%), cognitive (25%), and intent (25%) debt signals</div>
      </div>
    </div>

    <div class="card">
      <h2>Category Breakdown</h2>
      ${categoryBarHtml("Technical debt", technical.blendedScore, "50%")}
      ${categoryBarHtml("Cognitive debt", cognitive.score, "25%")}
      ${categoryBarHtml("Intent debt", intent.score, "25%")}
    </div>

    <div class="card">
      <h2>Technical Debt — ${technical.totalFindings} Semgrep findings</h2>
      <ul>${categoryRows}</ul>
    </div>

    <div class="card">
      <h2>Top Findings</h2>
      <table>
        <thead><tr><th>Severity</th><th>Rule</th><th>Location</th><th>Detail</th></tr></thead>
        <tbody>${findingsRows}</tbody>
      </table>
    </div>

    ${
      bandit
        ? `<div class="card"><h2>Python Security (Bandit) — ${bandit.totalFindings} findings</h2>
           <p>sub-score ${bandit.score}/100 — by severity: ${escapeHtml(Object.entries(bandit.byCategory).map(([sev, n]) => `${sev} ${n}`).join(", ") || "none")}</p>
           <table><thead><tr><th>Severity</th><th>Test</th><th>Location</th><th>Detail</th></tr></thead><tbody>
           ${bandit.top.map((f) => `<tr><td><span class="badge" style="background:${SEVERITY_COLORS[f.severity] || "#64748b"}">${f.severity}</span></td><td><code>${escapeHtml(f.testId)}</code></td><td class="path">${escapeHtml(f.file)}:${f.line}</td><td>${escapeHtml(f.text)}</td></tr>`).join("")}
           </tbody></table></div>`
        : ""
    }

    ${
      dependencyVulns
        ? dependencyVulns.vulnerablePackageCount === 0
          ? `<div class="card"><h2>Dependency Vulnerabilities (pip-audit)</h2><p>No known-vulnerable dependencies found — sub-score 0/100</p></div>`
          : `<div class="card"><h2>Dependency Vulnerabilities (pip-audit)</h2>
             <p><strong style="color:#dc2626">${dependencyVulns.vulnerablePackageCount} vulnerable package(s)</strong>, ${dependencyVulns.totalVulnCount} known CVE(s) total — sub-score ${dependencyVulns.score}/100</p>
             <ul>${dependencyVulns.packages.map((p) => `<li><code>${escapeHtml(p.name)}==${escapeHtml(p.version)}</code> — ${escapeHtml(p.vulnIds.join(", "))}${p.fixVersions.length ? ` (fix: ${escapeHtml(p.fixVersions.join(", "))})` : ""}</li>`).join("")}</ul>
             </div>`
        : ""
    }

    ${
      duplication
        ? `<div class="card"><h2>Duplication (jscpd)</h2><p>${duplication.percentage.toFixed(1)}% duplicated lines (${duplication.duplicatedLines}/${duplication.totalLines}) across ${duplication.clones} clone pairs — sub-score ${duplication.score}/100</p></div>`
        : ""
    }

    ${
      historicalSecrets
        ? `<div class="card"><h2>Historical Secrets (gitleaks)</h2><p>${
            historicalSecrets.leakCount === 0
              ? "None found — sub-score 0/100"
              : `<strong style="color:#dc2626">${historicalSecrets.leakCount} leaked secret(s) found in git history</strong> — sub-score ${historicalSecrets.score}/100`
          }</p></div>`
        : ""
    }

    <div class="card">
      <h2>Cognitive Debt (knowledge concentration)</h2>
      <p>Bus-factor risk ratio (raw): ${(cognitive.busFactorRiskRatio * 100).toFixed(1)}% of tracked files have had only one author ever<br>
      Total distinct authors: ${cognitive.totalAuthors} (team-size damping factor: ${cognitive.dampingFactor.toFixed(2)})</p>
      ${cognitive.totalAuthors <= 2 ? `<p class="dampened">⚠ Score damped heavily — with only ${cognitive.totalAuthors} total contributor(s), single-author-per-file is structural, not a debt signal.</p>` : ""}
    </div>

    <div class="card">
      <h2>Intent Debt (externalized rationale)</h2>
      <p>Generic/uninformative commit messages: ${(intent.genericMessageRatio * 100).toFixed(1)}% of commits<br>
      Refactor-commit ratio (trend indicator, not scored): ${(intent.refactorRatio * 100).toFixed(1)}%</p>
    </div>

    <footer>Methodology is a v1 heuristic pending calibration against real audited repos.</footer>
  </div>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.semgrep || !args.gitmine) {
    console.error(
      "Usage: node score.js --semgrep semgrep.json --gitmine gitmine.json " +
        "[--jscpd jscpd-report.json] [--gitleaks gitleaks.json] [--bandit bandit.json] " +
        "[--pipaudit pip-audit.json] [--out report.md] [--html report.html] [--json raw.json]"
    );
    process.exit(1);
  }

  const semgrepResults = loadJson(args.semgrep);
  const gitMine = loadJson(args.gitmine);
  const jscpdResults = args.jscpd ? loadJson(args.jscpd) : null;
  const gitleaksResults = args.gitleaks ? loadJson(args.gitleaks) : null;
  const banditResults = args.bandit ? loadJson(args.bandit) : null;
  const pipAuditResults = args.pipaudit ? loadJson(args.pipaudit) : null;

  const totalFilesScanned = gitMine.busFactorStats?.totalFilesTracked || 1;

  const semgrepTechnical = scoreTechnicalDebt(semgrepResults, totalFilesScanned);
  const duplication = scoreDuplication(jscpdResults);
  const historicalSecrets = scoreHistoricalSecrets(gitleaksResults);
  const bandit = scoreBandit(banditResults, totalFilesScanned);
  const dependencyVulns = scoreDependencyVulnerabilities(pipAuditResults);
  const blendedScore = combineTechnicalDebt(semgrepTechnical.score, duplication, historicalSecrets, bandit, dependencyVulns);
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

  // Semgrep/Bandit/gitleaks all report file paths as whatever we passed
  // them (an absolute path, since the CLI resolves the target before
  // invoking any tool). Absolute paths leak local machine detail into a
  // report that's meant to be a shareable artifact — relativize everything
  // to the scanned repo's own root instead.
  const repoRoot = gitMine.repoPath;
  const toRelative = (p) => (p ? path.relative(repoRoot, p) || path.basename(p) : p);
  for (const f of top) f.path = toRelative(f.path);
  if (bandit) for (const f of bandit.top) f.file = toRelative(f.file);
  if (historicalSecrets) for (const l of historicalSecrets.leaks) l.file = toRelative(l.file);

  const report = renderMarkdown({
    composite,
    tier,
    technical,
    duplication,
    historicalSecrets,
    bandit,
    dependencyVulns,
    cognitive,
    intent,
    top,
    repoPath: path.basename(gitMine.repoPath),
  });

  if (args.out) {
    fs.writeFileSync(args.out, report);
    console.error(`Report written to ${args.out}`);
  } else {
    process.stdout.write(report);
  }

  if (args.html) {
    const html = renderHtml({
      composite,
      tier,
      technical,
      duplication,
      historicalSecrets,
      bandit,
      dependencyVulns,
      cognitive,
      intent,
      top,
      repoPath: path.basename(gitMine.repoPath),
    });
    fs.writeFileSync(args.html, html);
    console.error(`HTML report written to ${args.html}`);
  }

  // Also emit the raw numbers as JSON on stderr-adjacent file if requested,
  // useful for future dashboarding without re-parsing the Markdown.
  if (args.json) {
    fs.writeFileSync(
      args.json,
      JSON.stringify(
        { composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent },
        null,
        2
      )
    );
  }
}

main();
