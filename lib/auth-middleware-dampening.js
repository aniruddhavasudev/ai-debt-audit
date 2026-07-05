// Calibration fix #1: the ai-debt-nextjs-api-route-missing-auth-check rule
// can only see auth calls made *inside* the flagged function. It cannot see
// auth enforced centrally in Next.js middleware — a very common, legitimate
// pattern — so as written it false-positives on every route in any app that
// does this. We can't fix that inside Semgrep itself (a single rule can't
// reason across files), so we detect the middleware here, where we have
// direct filesystem access to the target repo, and dampen the finding's
// weight rather than trusting it at full confidence.

import fs from "node:fs";
import path from "node:path";
import { c } from "../scripts/colors.js";
import { fileExists } from "./fs-utils.js";

const AUTH_MIDDLEWARE_CANDIDATES = ["middleware.ts", "middleware.js", "src/middleware.ts", "src/middleware.js"];
const AUTH_KEYWORDS_RE = /(auth|session|getUser|getSession|jwt)/i;
const MISSING_AUTH_CHECK_RULE = "ai-debt-nextjs-api-route-missing-auth-check";
const MIDDLEWARE_DAMPING_FACTOR = 0.2; // 80% confidence discount, not full suppression

function detectCentralizedAuthMiddleware(targetPath) {
  for (const candidate of AUTH_MIDDLEWARE_CANDIDATES) {
    const candidatePath = path.join(targetPath, candidate);
    if (fileExists(candidatePath) && AUTH_KEYWORDS_RE.test(fs.readFileSync(candidatePath, "utf8"))) {
      return candidatePath;
    }
  }
  return null;
}

export function dampenMiddlewareCoveredFindings(semgrepOutPath, targetPath) {
  const middlewarePath = detectCentralizedAuthMiddleware(targetPath);
  if (!middlewarePath) return;

  const data = JSON.parse(fs.readFileSync(semgrepOutPath, "utf8"));
  const relMiddlewarePath = path.relative(targetPath, middlewarePath);
  let adjustedCount = 0;

  for (const result of data.results || []) {
    if (!result.check_id.endsWith(MISSING_AUTH_CHECK_RULE)) continue;
    const originalWeight = Number(result.extra?.metadata?.weight ?? 4);
    result.extra.metadata.weight = Math.round(originalWeight * MIDDLEWARE_DAMPING_FACTOR * 10) / 10;
    result.extra.metadata.dampened_reason =
      `Repo has centralized auth middleware at ${relMiddlewarePath} — this finding's confidence ` +
      `is reduced 80% since auth may be enforced there instead of per-route. Verify manually.`;
    adjustedCount++;
  }

  if (adjustedCount > 0) {
    fs.writeFileSync(semgrepOutPath, JSON.stringify(data));
    console.error(
      c.cyan(`  ℹ Found centralized auth middleware (${relMiddlewarePath}) — dampened ${adjustedCount} auth-check finding(s)`)
    );
  }
}
