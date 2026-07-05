// Renders raw Semgrep/Bandit results as SARIF (Static Analysis Results
// Interchange Format) — the schema GitHub's own Security tab natively
// understands. Uploading this via the `github/codeql-action/upload-sarif`
// action surfaces findings inline on PRs and in the repo's Security
// dashboard, instead of only living inside our own Markdown/HTML report.
// This is what makes the GitHub Action integration a real code-scanning
// tool rather than just a CI log dump.
//
// Deliberately takes raw semgrepResults/banditResults rather than the
// shared report-data object (scripts/report-data.js) — SARIF's data model
// (rules + locations) doesn't overlap with the human-readable renderers',
// and topFindings()'s path-relativization already happened in-place on the
// same finding objects by the time this runs.

import path from "node:path";

const SARIF_LEVEL = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "note",
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "note",
};

export function renderSarif(semgrepResults, banditResults, repoRoot) {
  const rules = new Map();
  const results = [];

  const toRelative = (p) => (p ? path.relative(repoRoot, p) || path.basename(p) : p);

  for (const f of semgrepResults.results || []) {
    const ruleId = f.check_id.split(".").pop();
    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        shortDescription: { text: (f.extra?.message || ruleId).trim().split(".")[0] },
        fullDescription: { text: (f.extra?.message || "").trim().replace(/\s+/g, " ") },
        properties: { category: f.extra?.metadata?.ai_debt_category || "uncategorized" },
      });
    }
    results.push({
      ruleId,
      level: SARIF_LEVEL[f.extra?.severity] || "warning",
      message: { text: (f.extra?.message || "").trim().replace(/\s+/g, " ") },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: toRelative(f.path) },
            region: { startLine: Math.max(1, f.start?.line || 1) },
          },
        },
      ],
    });
  }

  for (const f of banditResults?.results || []) {
    const ruleId = f.test_id;
    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        shortDescription: { text: (f.issue_text || ruleId).trim().split(".")[0] },
        fullDescription: { text: f.issue_text || "" },
        properties: { category: "security" },
      });
    }
    results.push({
      ruleId,
      level: SARIF_LEVEL[f.issue_severity] || "warning",
      message: { text: f.issue_text || "" },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: toRelative(f.filename) },
            region: { startLine: Math.max(1, f.line_number || 1) },
          },
        },
      ],
    });
  }

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ai-debt-audit",
            informationUri: "https://github.com/aniruddhavasudev/ai-debt-audit",
            version: "1.0.0",
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  };
}
