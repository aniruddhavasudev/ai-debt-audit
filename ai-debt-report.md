# AI-Debt Report — /root/next-supabase-saas-starter

Generated: 2026-07-04T14:36:47.435Z

## Composite Score: 31/100 (Medium risk)

| Category | Score | Weight |
|---|---|---|
| Technical debt (blended) | 19/100 | 50% |
| Cognitive debt | 81/100 | 25% |
| Intent debt | 3/100 | 25% |

## Technical Debt — 38 Semgrep findings

Blended from Semgrep (60%), duplication (20%), historical secrets (20%):

- **framework_misuse**: 3 findings (weighted 3)
- **security**: 3 findings (weighted 2.4000000000000004)
- **incomplete_implementation**: 31 findings (weighted 31)
- **error_handling**: 1 findings (weighted 4)

### Top findings (by severity weight)

- [WARNING] `ai-debt-empty-catch-block-js` — /root/next-supabase-saas-starter/utils/supabase/server.ts:18 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [INFO] `ai-debt-inline-object-prop-rerender` — /root/next-supabase-saas-starter/app/(dashboard)/dashboard/layout.tsx:31 — Inline object/array/arrow-function literal passed as a JSX prop, causing needless re-renders every render cycle. Common in AI-generated components that were never profiled or optimized.
- [INFO] `ai-debt-inline-object-prop-rerender` — /root/next-supabase-saas-starter/app/(dashboard)/dashboard/layout.tsx:53 — Inline object/array/arrow-function literal passed as a JSX prop, causing needless re-renders every render cycle. Common in AI-generated components that were never profiled or optimized.
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/app/api/stripe/webhook/route.ts:30 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-inline-object-prop-rerender` — /root/next-supabase-saas-starter/lib/auth/index.tsx:42 — Inline object/array/arrow-function literal passed as a JSX prop, causing needless re-renders every render cycle. Common in AI-generated components that were never profiled or optimized.
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/lib/db/migrate.ts:12 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/lib/db/seed.ts:7 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/lib/db/seed.ts:39 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/lib/db/seed.ts:58 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — /root/next-supabase-saas-starter/lib/db/seed.ts:82 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).

### Duplication (jscpd)

- 3.1% duplicated lines (278/8886) across 35 clone pairs — sub-score 16/100

### Historical Secrets (gitleaks — full git history, not just current files)

- None found — sub-score 0/100

## Cognitive Debt (knowledge concentration)

- Bus-factor risk ratio (raw): 81.1% of tracked files have had only one author ever
- Total files tracked in git history: 74
- Total distinct authors: 15 (team-size damping factor: 1.00)

## Intent Debt (externalized rationale)

- Generic/uninformative commit messages: 3.3% of commits
- Refactor-commit ratio (trend indicator, not scored): 0.0%

---
*Methodology is a v1 heuristic pending calibration against real audited repos — see scripts/score.js for exact weights and formulas.*
