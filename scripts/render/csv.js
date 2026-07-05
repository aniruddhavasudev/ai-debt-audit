// Renders the report-data object (see scripts/report-data.js) as a small
// "workbook" of plain-language CSV files.
//
// CSV is the "basic Excel format" ask — it opens natively in Excel, Google
// Sheets, and Numbers with zero setup, and needs no new dependency (a
// hand-rolled RFC 4180 quoting rule is a few lines; a full library would be
// overkill here). A real multi-tab .xlsx "workbook" would need an actual
// XLSX-writing dependency, which isn't worth it for what's really just a
// folder of related tables — so "workbook" here means a small directory of
// CSV files (one per debt category, plus a summary) that a spreadsheet
// user can open as a set, not one binary file with tabs.

import { riskTier } from "../scoring.js";

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function renderCsvTable(header, rows) {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

// One flat findings-oriented severity vocabulary (Critical/High/Medium/Low/
// Info) instead of every tool's own raw scale (Semgrep's ERROR/WARNING/INFO,
// Bandit's HIGH/MEDIUM/LOW) — a spreadsheet mixing both isn't "structured
// for a layman," it's two different codes a reader has to already know.
const SEMGREP_SEVERITY_LABEL = { ERROR: "Critical", WARNING: "High", INFO: "Low" };
const BANDIT_SEVERITY_LABEL = { HIGH: "Critical", MEDIUM: "Medium", LOW: "Low" };

const DETECTED_BY_LABEL = {
  semgrep: "Code Scanner",
  bandit: "Python Security Scanner",
  gitleaks: "Secret Scanner",
  pip: "Dependency Checker",
  npm: "Dependency Checker",
  jscpd: "Duplicate Code Checker",
};

export function renderCsvWorkbook({ composite, tier, technical, cognitive, intent, top, bandit, historicalSecrets, dependencyVulns, duplication }) {
  const files = {};

  // --- summary.csv — the entry point: one row per category, plain English ---
  files["summary.csv"] = renderCsvTable(
    ["Category", "Score (0-100)", "Risk Level", "What This Means"],
    [
      [
        "Overall",
        composite,
        tier,
        `The overall AI-Debt score, combining all three categories below.`,
      ],
      [
        "Security & Quality",
        technical.blendedScore,
        riskTier(technical.blendedScore),
        `Security holes, copy-pasted code, and unfinished work left in place. See technical-debt.csv for specifics.`,
      ],
      [
        "Knowledge Risk",
        cognitive.score,
        riskTier(cognitive.score),
        `What happens if the one person who understands this code leaves. See knowledge-risk.csv for specifics.`,
      ],
      [
        "Missing Context",
        intent.score,
        riskTier(intent.score),
        `Whether anyone wrote down why the code works the way it does. See missing-context.csv for specifics.`,
      ],
      ...(intent.aiAssistedCommits > 0
        ? [
            [
              "AI-Assisted Commits",
              Math.round(intent.aiAssistedRatio * 100),
              "N/A (informational)",
              `${Math.round(intent.aiAssistedRatio * 100)}% of commits carry a known AI coding tool's signature (Co-Authored-By trailer or equivalent) — measured, not inferred. Not itself a risk score: disclosed AI use is transparency, not debt. See missing-context.csv for which of these commits also lack an explanation.`,
            ],
          ]
        : []),
    ]
  );

  // --- technical-debt.csv — every security/quality finding, one plain vocabulary ---
  const technicalRows = [];
  for (const f of top) {
    technicalRows.push([
      SEMGREP_SEVERITY_LABEL[f.severity] || f.severity || "",
      DETECTED_BY_LABEL.semgrep,
      f.rule || "",
      f.path || "",
      f.line ?? "",
      f.message || "",
    ]);
  }
  if (bandit) {
    for (const f of bandit.top) {
      technicalRows.push([
        BANDIT_SEVERITY_LABEL[f.severity] || f.severity || "",
        DETECTED_BY_LABEL.bandit,
        f.testId || "",
        f.file || "",
        f.line ?? "",
        f.text || "",
      ]);
    }
  }
  if (historicalSecrets) {
    for (const l of historicalSecrets.leaks) {
      technicalRows.push([
        "Critical",
        DETECTED_BY_LABEL.gitleaks,
        l.rule || "",
        l.file || "",
        l.line ?? "",
        `A secret was committed to git history (commit ${l.commit || "unknown"}) — still recoverable even though it may be deleted now.`,
      ]);
    }
  }
  if (dependencyVulns) {
    for (const p of dependencyVulns.packages) {
      technicalRows.push([
        "High",
        DETECTED_BY_LABEL[p.ecosystem] || "Dependency Checker",
        p.vulnIds[0] || "",
        p.name || "",
        "",
        `${p.name}@${p.version} has known security vulnerabilities (${p.vulnIds.join(", ")})${p.fixVersions.length ? ` — fix available: ${p.fixVersions.join(", ")}` : ""}.`,
      ]);
    }
  }
  if (duplication) {
    for (const p of duplication.clonePairs) {
      technicalRows.push([
        "Low",
        DETECTED_BY_LABEL.jscpd,
        "duplicate-code",
        p.firstFile || "",
        p.firstStart ?? "",
        `${p.lines} lines duplicated from ${p.secondFile}:${p.secondStart}-${p.secondEnd} — copy-pasted rather than shared/reused code.`,
      ]);
    }
  }
  files["technical-debt.csv"] = renderCsvTable(["Severity", "Detected By", "Issue Type", "File", "Line", "What This Means"], technicalRows);

  // --- knowledge-risk.csv — files only one person has ever touched ---
  const knowledgeRows = (cognitive.riskyFiles || []).map((r) => [
    r.file || "",
    r.author || "",
    "If this person leaves, nobody else has touched this file — it's a single point of failure.",
  ]);
  files["knowledge-risk.csv"] = renderCsvTable(["File", "Only Ever Edited By", "What This Means"], knowledgeRows);

  // --- missing-context.csv — commits that don't explain why a change was made ---
  const aiAssistedHashes = new Set((intent.aiAssistedCommitList || []).map((c) => c.hash));
  const contextRows = (intent.genericCommits || []).map((c) => [
    c.hash || "",
    c.author || "",
    c.subject || "",
    aiAssistedHashes.has(c.hash)
      ? `The commit message ("${c.subject}") doesn't explain why this change was made, and this commit carries a known AI coding tool's signature — future readers (human or AI) have to guess why AI-generated code was written this way.`
      : `The commit message ("${c.subject}") doesn't explain why this change was made — future readers (human or AI) have to guess.`,
  ]);
  files["missing-context.csv"] = renderCsvTable(["Commit", "Author", "Commit Message", "What This Means"], contextRows);

  return files;
}
