// Renders the report-data object (see scripts/report-data.js) as a
// standalone HTML report.

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

export function renderHtml({ composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent, top, repoPath, weights }) {
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
      ${categoryBarHtml("Technical debt", technical.blendedScore, `${Math.round(weights.technical * 100)}%`)}
      ${categoryBarHtml("Cognitive debt", cognitive.score, `${Math.round(weights.cognitive * 100)}%`)}
      ${categoryBarHtml("Intent debt", intent.score, `${Math.round(weights.intent * 100)}%`)}
    </div>

    <div class="card">
      <h2>Technical Debt — ${technical.skipped ? "Semgrep not installed, pattern rules skipped" : `${technical.totalFindings} Semgrep findings`}</h2>
      ${technical.skipped ? "<p><em>The 74 AI-debt Semgrep rules did not run (<code>pip install semgrep</code> for the full scan). The technical score blends only the tools that did run.</em></p>" : ""}
      <ul>${categoryRows}</ul>
    </div>

    <div class="card">
      <h2>All Findings</h2>
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
          ? `<div class="card"><h2>Dependency Vulnerabilities (pip-audit + npm audit)</h2><p>No known-vulnerable dependencies found — sub-score 0/100</p></div>`
          : `<div class="card"><h2>Dependency Vulnerabilities (pip-audit + npm audit)</h2>
             <p><strong style="color:#dc2626">${dependencyVulns.vulnerablePackageCount} vulnerable package(s)</strong>, ${dependencyVulns.totalVulnCount} known CVE(s)/advisories total — sub-score ${dependencyVulns.score}/100</p>
             <ul>${dependencyVulns.packages.map((p) => `<li><code>[${escapeHtml(p.ecosystem)}] ${escapeHtml(p.name)}${p.ecosystem === "npm" ? "@" : "=="}${escapeHtml(p.version)}</code> — ${escapeHtml(p.vulnIds.join(", "))}${p.fixVersions.length ? ` (fix: ${escapeHtml(p.fixVersions.join(", "))})` : ""}</li>`).join("")}</ul>
             </div>`
        : ""
    }

    ${
      duplication
        ? `<div class="card"><h2>Duplication (jscpd)</h2><p>${duplication.percentage.toFixed(1)}% duplicated lines (${duplication.duplicatedLines}/${duplication.totalLines}) across ${duplication.clones} clone pairs — sub-score ${duplication.score}/100</p>
           ${duplication.clonePairs.length ? `<ul>${duplication.clonePairs.map((p) => `<li>${p.lines} lines: <code>${escapeHtml(p.firstFile)}:${p.firstStart}-${p.firstEnd}</code> ↔ <code>${escapeHtml(p.secondFile)}:${p.secondStart}-${p.secondEnd}</code></li>`).join("")}</ul>` : ""}
           </div>`
        : ""
    }

    ${
      historicalSecrets
        ? `<div class="card"><h2>Historical Secrets (gitleaks)</h2><p>${
            historicalSecrets.leakCount === 0
              ? "None found — sub-score 0/100"
              : `<strong style="color:#dc2626">${historicalSecrets.leakCount} leaked secret(s) found in git history</strong> — sub-score ${historicalSecrets.score}/100`
          }</p>
           ${historicalSecrets.leakCount > 0 ? `<ul>${historicalSecrets.leaks.map((l) => `<li><code>${escapeHtml(l.rule)}</code> in <code>${escapeHtml(l.file)}:${l.line}</code> (commit ${escapeHtml(l.commit)})</li>`).join("")}</ul>` : ""}
           </div>`
        : ""
    }

    <div class="card">
      <h2>Cognitive Debt (knowledge concentration)</h2>
      ${
        cognitive.isShallowClone
          ? `<p class="dampened"><strong>⚠ This is a shallow git clone (limited commit history available).</strong> Cognitive and intent debt scores are likely unreliable — re-run against a full clone (<code>git fetch --unshallow</code>, or <code>fetch-depth: 0</code> in CI) before trusting these two numbers.</p>`
          : ""
      }
      <p>Bus-factor risk ratio (raw): ${(cognitive.busFactorRiskRatio * 100).toFixed(1)}% of tracked files have had only one author ever<br>
      Total distinct authors: ${cognitive.totalAuthors} (team-size damping factor: ${cognitive.dampingFactor.toFixed(2)})</p>
      ${cognitive.totalAuthors <= 2 ? `<p class="dampened">⚠ Score damped heavily — with only ${cognitive.totalAuthors} total contributor(s), single-author-per-file is structural, not a debt signal.</p>` : ""}
      ${cognitive.riskyFiles?.length ? `<p><strong>Files only one person has ever touched:</strong></p><ul>${cognitive.riskyFiles.map((r) => `<li><code>${escapeHtml(r.file)}</code> (${escapeHtml(r.author)})</li>`).join("")}</ul>` : ""}
      ${
        cognitive.giantDumpCommits > 0
          ? `<h3>Giant-Dump Commits (measured from git log --numstat)</h3>
             <p>${(cognitive.giantDumpRatio * 100).toFixed(1)}% of commits (${cognitive.giantDumpCommits}) touched many files or churned many lines in one shot — the "wasn't reviewed incrementally" pattern:</p>
             <ul>${cognitive.giantDumpCommitList.map((c) => `<li><code>${escapeHtml(c.hash)}</code> ${escapeHtml(c.author)}: "${escapeHtml(c.subject)}" — ${c.filesChanged} files, +${c.linesAdded}/-${c.linesDeleted} lines</li>`).join("")}</ul>`
          : ""
      }
    </div>

    <div class="card">
      <h2>Intent Debt (externalized rationale)</h2>
      <p>Generic/uninformative commit messages: ${(intent.genericMessageRatio * 100).toFixed(1)}% of commits<br>
      Refactor-commit ratio (trend indicator, not scored): ${(intent.refactorRatio * 100).toFixed(1)}%</p>
      ${intent.genericCommits?.length ? `<p><strong>Commits flagged as generic/uninformative:</strong></p><ul>${intent.genericCommits.map((c) => `<li><code>${escapeHtml(c.hash)}</code> ${escapeHtml(c.author)}: "${escapeHtml(c.subject)}"</li>`).join("")}</ul>` : ""}
      ${
        intent.aiAssistedCommits > 0
          ? `<h3>AI-Assisted Commits (measured from commit trailers, not inferred)</h3>
             <p>${(intent.aiAssistedRatio * 100).toFixed(1)}% of commits (${intent.aiAssistedCommits}) carry a known AI coding tool's signature</p>
             <ul>${Object.entries(intent.aiToolCounts).map(([tool, count]) => `<li>${escapeHtml(tool)}: ${count} commit(s)</li>`).join("")}</ul>
             ${
               intent.aiAssistedGenericCommits > 0
                 ? `<p class="dampened">⚠ <strong>${intent.aiAssistedGenericCommits} of those are also generic/uninformative</strong> (${(intent.aiAssistedGenericRatio * 100).toFixed(1)}% of all commits) — this is what's actually scored here, not AI involvement on its own. A disclosed, well-explained AI-assisted commit is not a risk signal; an AI-assisted commit with no explanation is the unreviewed-dump pattern this category exists to catch.</p>`
                 : ""
             }`
          : ""
      }
    </div>

    <footer>Methodology is a v1 heuristic pending calibration against real audited repos.</footer>
  </div>
</body>
</html>
`;
}
