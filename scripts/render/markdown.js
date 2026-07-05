// Renders the report-data object (see scripts/report-data.js) as Markdown.

export function renderMarkdown({ composite, tier, technical, duplication, historicalSecrets, bandit, dependencyVulns, cognitive, intent, top, repoPath, weights }) {
  const lines = [];
  lines.push(`# AI-Debt Report — ${repoPath}`);
  lines.push(`\nGenerated: ${new Date().toISOString()}\n`);
  lines.push(`## Composite Score: ${composite}/100 (${tier} risk)\n`);
  lines.push(`| Category | Score | Weight |`);
  lines.push(`|---|---|---|`);
  lines.push(`| Technical debt (blended) | ${technical.blendedScore}/100 | ${Math.round(weights.technical * 100)}% |`);
  lines.push(`| Cognitive debt | ${cognitive.score}/100 | ${Math.round(weights.cognitive * 100)}% |`);
  lines.push(`| Intent debt | ${intent.score}/100 | ${Math.round(weights.intent * 100)}% |`);

  lines.push(`\n## Technical Debt — ${technical.totalFindings} Semgrep findings\n`);
  lines.push(`Blended from Semgrep, Bandit, duplication, historical secrets, and dependency vulnerabilities (only tools that actually ran contribute; see methodology note):\n`);
  for (const [category, stats] of Object.entries(technical.byCategory)) {
    lines.push(`- **${category}**: ${stats.count} findings (weighted ${stats.weight})`);
  }

  lines.push(`\n### All findings (sorted by severity weight)\n`);
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
    lines.push(`\n### Dependency Vulnerabilities (pip-audit + npm audit)\n`);
    if (dependencyVulns.vulnerablePackageCount === 0) {
      lines.push(`- No known-vulnerable dependencies found — sub-score 0/100`);
    } else {
      lines.push(`- **${dependencyVulns.vulnerablePackageCount} vulnerable package(s)**, ${dependencyVulns.totalVulnCount} known CVE(s)/advisories total — sub-score ${dependencyVulns.score}/100`);
      for (const p of dependencyVulns.packages) {
        const versionMarker = p.ecosystem === "npm" ? `${p.name}@${p.version}` : `${p.name}==${p.version}`;
        lines.push(`  - \`[${p.ecosystem}] ${versionMarker}\` — ${p.vulnIds.join(", ")}${p.fixVersions.length ? ` (fix: ${p.fixVersions.join(", ")})` : ""}`);
      }
    }
  }

  if (duplication) {
    lines.push(`\n### Duplication (jscpd)\n`);
    lines.push(`- ${duplication.percentage.toFixed(1)}% duplicated lines (${duplication.duplicatedLines}/${duplication.totalLines}) across ${duplication.clones} clone pairs — sub-score ${duplication.score}/100`);
    for (const p of duplication.clonePairs) {
      lines.push(`  - ${p.lines} lines: ${p.firstFile}:${p.firstStart}-${p.firstEnd} ↔ ${p.secondFile}:${p.secondStart}-${p.secondEnd}`);
    }
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
  if (cognitive.isShallowClone) {
    lines.push(
      `- ⚠ **This is a shallow git clone (limited commit history available).** Cognitive and intent debt scores below are likely unreliable — bus-factor and commit-message analysis both need real history, not just the fetched window. Re-run against a full clone (\`git fetch --unshallow\`, or \`fetch-depth: 0\` in CI) before trusting these two numbers.\n`
    );
  }
  lines.push(`- Bus-factor risk ratio (raw): ${(cognitive.busFactorRiskRatio * 100).toFixed(1)}% of tracked files have had only one author ever`);
  lines.push(`- Total files tracked in git history: ${cognitive.totalFilesTracked}`);
  lines.push(`- Total distinct authors: ${cognitive.totalAuthors} (team-size damping factor: ${cognitive.dampingFactor.toFixed(2)})`);
  if (cognitive.totalAuthors <= 2) {
    lines.push(
      `- ⚠ *Score damped heavily — with only ${cognitive.totalAuthors} total contributor(s), single-author-per-file is structural, not a debt signal.*`
    );
  }
  if (cognitive.riskyFiles?.length) {
    lines.push(`\nFiles only one person has ever touched:\n`);
    for (const r of cognitive.riskyFiles) {
      lines.push(`  - ${r.file} (${r.author})`);
    }
  }

  if (cognitive.giantDumpCommits > 0) {
    lines.push(`\n### Giant-Dump Commits (measured from \`git log --numstat\`)\n`);
    lines.push(`- ${(cognitive.giantDumpRatio * 100).toFixed(1)}% of commits (${cognitive.giantDumpCommits}) touched many files or churned many lines in one shot — the "wasn't reviewed incrementally" pattern:\n`);
    for (const c of cognitive.giantDumpCommitList) {
      lines.push(`  - \`${c.hash}\` ${c.author}: "${c.subject}" — ${c.filesChanged} files, +${c.linesAdded}/-${c.linesDeleted} lines`);
    }
  }

  lines.push(`\n## Intent Debt (externalized rationale)\n`);
  lines.push(`- Generic/uninformative commit messages: ${(intent.genericMessageRatio * 100).toFixed(1)}% of commits`);
  lines.push(`- Refactor-commit ratio (trend indicator, not scored): ${(intent.refactorRatio * 100).toFixed(1)}%`);
  if (intent.genericCommits?.length) {
    lines.push(`\nCommits flagged as generic/uninformative:\n`);
    for (const c of intent.genericCommits) {
      lines.push(`  - \`${c.hash}\` ${c.author}: "${c.subject}"`);
    }
  }

  if (intent.aiAssistedCommits > 0) {
    lines.push(`\n### AI-Assisted Commits (measured from commit trailers, not inferred)\n`);
    lines.push(`- ${(intent.aiAssistedRatio * 100).toFixed(1)}% of commits (${intent.aiAssistedCommits}) carry a known AI coding tool's signature`);
    for (const [tool, count] of Object.entries(intent.aiToolCounts)) {
      lines.push(`  - ${tool}: ${count} commit(s)`);
    }
    if (intent.aiAssistedGenericCommits > 0) {
      lines.push(`- ⚠ **${intent.aiAssistedGenericCommits} of those are *also* generic/uninformative** (${(intent.aiAssistedGenericRatio * 100).toFixed(1)}% of all commits) — this is what's actually scored here, not AI involvement on its own. A disclosed, well-explained AI-assisted commit is not a risk signal; an AI-assisted commit with no explanation is the unreviewed-dump pattern this category exists to catch.`);
    }
  }

  lines.push(`\n---\n*Methodology is a v1 heuristic pending calibration against real audited repos — see scripts/score.js for exact weights and formulas.*`);

  return lines.join("\n") + "\n";
}
