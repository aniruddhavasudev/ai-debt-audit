// Single shared "report data" preparation step consumed by every renderer
// (Markdown, HTML, CSV). This exists because Markdown and HTML used to each
// build their own near-identical data object independently — which already
// caused one real bug (HTML was missing gitleaks leak details that Markdown
// had, only caught because a user noticed). Building this object exactly
// once and handing the *same* object to every renderer means a field added
// here is automatically available everywhere, instead of requiring every
// render call site to be updated in lockstep.

// Every finding, not a "top N" sample — the report is meant to be usable
// as evidence (a due-diligence artifact, a PR gate), and evidence that
// silently drops findings past an arbitrary cutoff isn't trustworthy.
// Still sorted by severity weight so the most serious findings read first.
export function topFindings(semgrepResults) {
  const findings = semgrepResults.results || [];
  return [...findings]
    .sort((a, b) => (b.extra?.metadata?.weight ?? 0) - (a.extra?.metadata?.weight ?? 0))
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

// Builds the one canonical report-data object every renderer receives.
// `toRelative` converts the absolute paths Semgrep/Bandit report into
// repo-relative ones for display (kept as an injected function rather than
// a repoRoot string here, since the caller already has to build it for
// config-filtering purposes before this runs).
export function buildReportData({
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
  repoPath,
  weights,
  toRelative,
}) {
  const top = topFindings(semgrepResults);
  for (const f of top) f.path = toRelative(f.path);
  if (bandit) for (const f of bandit.top) f.file = toRelative(f.file);
  if (historicalSecrets) for (const l of historicalSecrets.leaks) l.file = toRelative(l.file);

  return {
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
    repoPath,
    weights,
  };
}
