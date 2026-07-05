// scoring.js — pure scoring math: turns raw tool output (Semgrep, Bandit,
// jscpd, gitleaks, pip-audit/npm audit, git-mine) into per-category and
// composite 0-100 AI-Debt scores. No rendering, no file I/O, no CLI glue —
// see scripts/render/ for report formatting and scripts/score.js for the
// orchestration that wires this module to them.
//
// Score convention (matches techdebt.fail's public calculator, so a buyer
// who's already seen that tool has an intuitive frame of reference):
//   0-100, HIGHER = MORE DEBT/RISK.
//   Tiers: Low 0-25, Medium 26-50, High 51-75, Critical 76-100.
//
// Category weights are a v1 heuristic, not a scientifically derived
// constant — the plan (see project notes) is to calibrate these against
// 10-15 real audited repos before the first paid customer, and revise
// openly as real outcomes come in. Treat every constant in this file as
// provisional.

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
//
// The saturation constant matters more here than it looks: at 1.5, even a
// single MEDIUM (weight 3) or HIGH (weight 5) finding in a one-file scan
// saturates the sub-score to 100 (weight/1.5 already exceeds 1.0) — a bug
// caught by scripts/score.test.js, which found HIGH and MEDIUM findings
// scoring identically. 10.0 gives real separation: 1 LOW = 10, 1 MEDIUM =
// 30, 1 HIGH = 50 — severity actually differentiates instead of every
// finding above trivial immediately capping out, which matters most in
// small scans (a handful of files, or --diff mode) where this was worst.
const BANDIT_SEVERITY_WEIGHT = { LOW: 1, MEDIUM: 3, HIGH: 5 };
const BANDIT_SATURATION_PER_FILE = 10.0;

// "Each distinct vulnerable *package* (not each individual CVE within it)
// adds this many points, capped at 100." Counting packages rather than
// raw CVE count avoids one heavily-CVE'd package (e.g. an ancient Flask)
// dominating the score disproportionately to how many risky dependencies
// actually exist.
const POINTS_PER_VULNERABLE_PACKAGE = 20;

export function scoreTechnicalDebt(semgrepResults, totalFilesScanned) {
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

export function scoreDuplication(jscpdResults) {
  if (!jscpdResults) return null;
  const percentage = jscpdResults.statistics?.total?.percentage ?? 0;
  const score = Math.round(Math.min(100, 100 * (percentage / DUPLICATION_SATURATION_PERCENT)));
  return {
    score,
    percentage,
    duplicatedLines: jscpdResults.statistics?.total?.duplicatedLines ?? 0,
    totalLines: jscpdResults.statistics?.total?.lines ?? 0,
    clones: jscpdResults.statistics?.total?.clones ?? 0,
    // Every clone pair, not just the aggregate count — jscpd already knows
    // exactly which two files/line-ranges match, and throwing that away
    // left the report saying "13 clone pairs" with no way to find them.
    clonePairs: (jscpdResults.duplicates || []).map((d) => ({
      firstFile: d.firstFile?.name,
      firstStart: d.firstFile?.start,
      firstEnd: d.firstFile?.end,
      secondFile: d.secondFile?.name,
      secondStart: d.secondFile?.start,
      secondEnd: d.secondFile?.end,
      lines: d.lines,
    })),
  };
}

export function scoreHistoricalSecrets(gitleaksResults) {
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

export function scoreBandit(banditResults, totalFilesScanned) {
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
    // Every finding, not a "top 5" sample — see the comment on topFindings()
    // for why silent truncation is the wrong default for a report meant to
    // be used as evidence.
    top: [...findings]
      .sort((a, b) => (BANDIT_SEVERITY_WEIGHT[b.issue_severity] ?? 0) - (BANDIT_SEVERITY_WEIGHT[a.issue_severity] ?? 0))
      .map((f) => ({
        testId: f.test_id,
        severity: f.issue_severity,
        file: f.filename,
        line: f.line_number,
        text: f.issue_text,
      })),
  };
}

// Merges pip-audit (Python) and npm audit (JS/TS) into one signal — many
// real repos have both a Python backend and a JS/TS frontend, and a
// vulnerable dependency is a vulnerable dependency regardless of which
// ecosystem it came from. Either or both inputs can be null (that
// ecosystem wasn't present/scanned); the function degrades gracefully.
export function scoreDependencyVulnerabilities(pipAuditResults, npmAuditResults) {
  if (!pipAuditResults && !npmAuditResults) return null;

  const packages = [];

  if (pipAuditResults) {
    for (const dep of pipAuditResults.dependencies || []) {
      if ((dep.vulns || []).length === 0) continue;
      packages.push({
        name: dep.name,
        version: dep.version,
        ecosystem: "pip",
        vulnIds: dep.vulns.map((v) => v.id),
        fixVersions: [...new Set(dep.vulns.flatMap((v) => v.fix_versions || []))],
      });
    }
  }

  if (npmAuditResults) {
    for (const [name, vuln] of Object.entries(npmAuditResults.vulnerabilities || {})) {
      const vulnIds = (vuln.via || [])
        .map((v) => (typeof v === "object" ? v.url || v.source || v.title : v))
        .filter(Boolean);
      packages.push({
        name,
        version: vuln.range,
        ecosystem: "npm",
        vulnIds: vulnIds.length ? vulnIds : [vuln.severity],
        fixVersions: vuln.fixAvailable && vuln.fixAvailable.version ? [vuln.fixAvailable.version] : [],
      });
    }
  }

  const totalVulnCount = packages.reduce((sum, p) => sum + p.vulnIds.length, 0);
  const score = Math.round(Math.min(100, packages.length * POINTS_PER_VULNERABLE_PACKAGE));

  return {
    score,
    vulnerablePackageCount: packages.length,
    totalVulnCount,
    packages,
  };
}

export function combineTechnicalDebt(semgrepScore, duplication, historicalSecrets, bandit, dependencyVulns) {
  // If a tool wasn't run, redistribute its weight across the tools that
  // were — a report missing gitleaks shouldn't silently understate risk
  // by averaging in a phantom zero. This also means a non-Python repo
  // (no bandit/pip-audit findings possible) is scored fairly on the tools
  // that actually apply to it, rather than penalized for a stack mismatch.
  // Semgrep itself is now optional too (null = didn't run) — the npx
  // quick-start path runs with zero external tools installed and scores
  // from whatever did run, rather than refusing to work at all.
  const parts = [];
  if (semgrepScore !== null && semgrepScore !== undefined) parts.push({ score: semgrepScore, weight: TECHNICAL_SUBWEIGHTS.semgrep });
  if (duplication) parts.push({ score: duplication.score, weight: TECHNICAL_SUBWEIGHTS.duplication });
  if (historicalSecrets) parts.push({ score: historicalSecrets.score, weight: TECHNICAL_SUBWEIGHTS.historicalSecrets });
  if (bandit) parts.push({ score: bandit.score, weight: TECHNICAL_SUBWEIGHTS.bandit });
  if (dependencyVulns) parts.push({ score: dependencyVulns.score, weight: TECHNICAL_SUBWEIGHTS.dependencyVulns });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight === 0) return 0; // nothing ran at all — no signal, not NaN
  const blended = parts.reduce((sum, p) => sum + p.score * p.weight, 0) / totalWeight;

  return Math.round(blended);
}

// Bus-factor risk is only a meaningful *debt* signal once a real team
// exists to have knowledge silos within. A solo or two-person repo is,
// by construction, ~100% single-author-per-file — that's just what a
// small team looks like, not evidence of accumulating AI-assisted risk.
// This damping factor ramps from 0 (1 total author) to 1 (3+ total
// authors), so the score only "counts" once a silo is actually possible.
export function teamSizeDampingFactor(totalAuthors) {
  return Math.min(1, Math.max(0, (totalAuthors - 1) / 2));
}

// Bot commit authors (CI badge updates, dependabot, etc.) inflate the
// apparent team size without distributing any real human knowledge —
// found via this repo's own self-scan, where github-actions[bot]'s
// badge-update commits alone were enough to push the damping factor to
// its maximum, even though the bot only ever touches one generated file.
const BOT_AUTHOR_PATTERN = /\[bot\]$/i;

// How much a "giant dump" commit ratio (see git-mine.js's mineCommitChurn)
// can add to cognitive debt, on top of the bus-factor signal. Additive,
// not proportionally blended: zero giant-dump commits must collapse this
// to exactly the pre-feature formula (100 * busFactorRiskRatio *
// dampingFactor) — the same "add, never dilute" lesson from the intent
// debt fix above (a fixed proportional split silently lowered scores for
// repos where the new signal contributed nothing).
//
// Deliberately NOT team-size-damped like bus factor: bus factor is damped
// because a small team is *structurally* single-author-per-file, which
// isn't a real signal. An unreviewed giant-dump commit is a real risk
// regardless of team size — arguably worse in a solo repo, where nobody
// else could have caught it in review.
const GIANT_DUMP_BONUS_WEIGHT = 0.3;

export function scoreCognitiveDebt(gitMine) {
  const busFactorRiskRatio = gitMine.busFactorStats?.busFactorRiskRatio ?? 0;
  const allAuthors = Object.keys(gitMine.commitStats?.authorCounts ?? {});
  const totalAuthors = allAuthors.filter((a) => !BOT_AUTHOR_PATTERN.test(a)).length;
  const dampingFactor = teamSizeDampingFactor(totalAuthors);
  const giantDumpRatio = gitMine.churnStats?.giantDumpRatio ?? 0;

  const score = Math.round(
    Math.min(100, 100 * busFactorRiskRatio * dampingFactor + 100 * giantDumpRatio * GIANT_DUMP_BONUS_WEIGHT)
  );
  return {
    score,
    busFactorRiskRatio,
    totalAuthors,
    dampingFactor,
    isShallowClone: Boolean(gitMine.isShallowClone),
    ...gitMine.busFactorStats,
    // Measured directly from `git log --numstat` — a commit touching many
    // files or churning many lines in one shot, the "wasn't reviewed
    // incrementally" pattern (see git-mine.js's GIANT_DUMP_MIN_FILES/
    // GIANT_DUMP_MIN_LINES thresholds).
    giantDumpRatio,
    giantDumpCommits: gitMine.churnStats?.giantDumpCommits ?? 0,
    giantDumpCommitList: gitMine.churnStats?.giantDumpCommitList ?? [],
  };
}

// How intent debt splits between its two input signals. A high AI-assisted
// ratio is *not* itself weighted here — a well-labeled Co-Authored-By
// trailer is disclosure, which is the opposite of hidden risk. What's
// actually scored is the compounding case: an AI-assisted commit whose
// message is *also* generic/uninformative — "AI wrote this and nobody
// explained why," the exact unreviewed-dump pattern this category exists
// to surface. Weights are a v1 starting point, same provisional status as
// every other constant in this file.
// A commit that's both AI-assisted and generic/uninformative counts as
// this many "generic commits" toward the score, instead of 1 — the
// compounding pattern this exists to catch ("AI wrote it and nobody
// explained why") is worse than a plain generic commit, but should only
// ever *add* to the base signal, never dilute it. With a fixed proportional
// split (e.g. "70% generic ratio + 30% AI-unexplained ratio") instead, a
// repo with zero AI-assisted commits would score *lower* than it did
// before this feature existed, purely because the new signal contributes
// nothing — caught before shipping by checking the score of a repo with
// generic messages but no AI involvement at all against the pre-feature
// formula.
const AI_UNEXPLAINED_EXTRA_WEIGHT = 1.5;

export function scoreIntentDebt(gitMine) {
  const genericMessageRatio = gitMine.commitStats?.genericMessageRatio ?? 0;
  const aiAssistedGenericRatio = gitMine.commitStats?.aiAssistedGenericRatio ?? 0;
  const totalCommits = gitMine.commitStats?.totalCommits ?? 0;
  const genericMessageCommits = gitMine.commitStats?.genericMessageCommits ?? 0;
  const aiAssistedGenericCommits = gitMine.commitStats?.aiAssistedGenericCommits ?? 0;

  // Zero AI-assisted-generic commits collapses this to
  // 100 * genericMessageCommits / totalCommits — exactly the pre-feature
  // formula (100 * genericMessageRatio), byte-for-byte.
  const weightedGenericCount =
    genericMessageCommits - aiAssistedGenericCommits + aiAssistedGenericCommits * AI_UNEXPLAINED_EXTRA_WEIGHT;
  const score = totalCommits ? Math.round(Math.min(100, 100 * (weightedGenericCount / totalCommits))) : 0;

  return {
    score,
    genericMessageRatio,
    refactorRatio: gitMine.commitStats?.refactorRatio ?? 0,
    note: "refactorRatio is reported as a trend indicator, not currently scored — a shrinking refactor ratio over time is a leading signal of accumulating technical debt, but a single point-in-time snapshot doesn't tell you the trend direction.",
    // Every commit actually flagged generic, not just the percentage.
    genericCommits: gitMine.commitStats?.genericCommitList ?? [],
    // Measured, not inferred — commits whose trailer matches a known AI
    // coding tool's signature (see git-mine.js's AI_AUTHORSHIP_SIGNATURES).
    // Reported regardless of score contribution: "X% of commits were
    // AI-assisted" is useful evidence on its own, disclosed AI use or not.
    aiAssistedRatio: gitMine.commitStats?.aiAssistedRatio ?? 0,
    aiAssistedCommits: gitMine.commitStats?.aiAssistedCommits ?? 0,
    aiToolCounts: gitMine.commitStats?.aiToolCounts ?? {},
    aiAssistedCommitList: gitMine.commitStats?.aiAssistedCommitList ?? [],
    aiAssistedGenericRatio,
    aiAssistedGenericCommits: gitMine.commitStats?.aiAssistedGenericCommits ?? 0,
  };
}

export function riskTier(score) {
  if (score <= 25) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 75) return "High";
  return "Critical";
}
