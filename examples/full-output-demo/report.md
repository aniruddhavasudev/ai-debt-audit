# AI-Debt Report — ai-debt-audit

Generated: 2026-07-05T05:39:52.102Z

## Composite Score: 24/100 (Low risk)

| Category | Score | Weight |
|---|---|---|
| Technical debt (blended) | 21/100 | 50% |
| Cognitive debt | 49/100 | 25% |
| Intent debt | 4/100 | 25% |

## Technical Debt — 29 Semgrep findings

Blended from Semgrep, Bandit, duplication, historical secrets, and dependency vulnerabilities (only tools that actually ran contribute; see methodology note):

- **error_handling**: 5 findings (weighted 20)
- **incomplete_implementation**: 23 findings (weighted 23)
- **security**: 1 findings (weighted 3)

### All findings (sorted by severity weight)

- [WARNING] `ai-debt-empty-catch-block-js` — bin/aidebt-scan.js:259 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [WARNING] `ai-debt-empty-catch-block-js` — bin/aidebt-scan.js:288 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [WARNING] `ai-debt-empty-catch-block-js` — bin/aidebt-scan.js:343 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [WARNING] `ai-debt-empty-catch-block-js` — bin/aidebt-scan.js:358 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [WARNING] `ai-debt-empty-catch-block-js` — bin/aidebt-scan.js:386 — Empty catch block. AI-generated code frequently wraps calls in try/catch to "make the error go away" without handling or surfacing the failure — a hallmark of unreviewed AI output.
- [WARNING] `ai-debt-flask-cors-wildcard` — rules/09-java-spring-smells.yml:46 — Flask-CORS configured with a wildcard origin. Common AI shortcut to silence a browser CORS error during development; if this is an authenticated API, wildcard origins undermine cookie/credential protections.
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:414 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:415 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:416 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:418 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:425 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:440 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:443 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:444 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:445 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:446 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:447 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:448 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:449 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:450 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:451 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:452 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:453 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:454 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:466 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — bin/aidebt-scan.js:472 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — scripts/test-config-integration.js:89 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — scripts/test-rules.js:108 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).
- [INFO] `ai-debt-console-log-debug-leftover` — scripts/test-rules.js:116 — console.log/debugger left in source. Individually trivial, but a high density across a codebase correlates strongly with unreviewed AI-generated commits (weight this by frequency, not presence).

### Python Security (Bandit) — 0 findings

- sub-score 0/100 — by severity: none

### Dependency Vulnerabilities (pip-audit + npm audit)

- No known-vulnerable dependencies found — sub-score 0/100

### Duplication (jscpd)

- 2.7% duplicated lines (325/11897) across 48 clone pairs — sub-score 14/100
  - 7 lines: .github/workflows/ci.yml:27-33 ↔ .github/workflows/self-scan.yml:37-43
  - 16 lines: docs/index.html:5-20 ↔ report.html:5-20
  - 6 lines: docs/index.html:20-25 ↔ report.html:20-25
  - 29 lines: docs/index.html:29-57 ↔ report.html:29-57
  - 11 lines: docs/index.html:63-73 ↔ report.html:63-73
  - 6 lines: docs/index.html:74-79 ↔ report.html:74-79
  - 6 lines: docs/index.html:80-85 ↔ report.html:80-85
  - 8 lines: docs/index.html:96-103 ↔ report.html:96-103
  - 7 lines: docs/index.html:103-109 ↔ report.html:109-115
  - 7 lines: docs/index.html:103-109 ↔ report.html:115-121
  - 7 lines: docs/index.html:103-109 ↔ report.html:121-127
  - 6 lines: docs/index.html:103-108 ↔ report.html:127-132
  - 6 lines: docs/index.html:104-109 ↔ docs/index.html:110-115
  - 6 lines: docs/index.html:104-109 ↔ docs/index.html:122-127
  - 6 lines: docs/index.html:109-114 ↔ docs/index.html:115-120
  - 7 lines: docs/index.html:109-115 ↔ docs/index.html:127-133
  - 6 lines: docs/index.html:116-121 ↔ docs/index.html:134-139
  - 6 lines: docs/index.html:116-121 ↔ report.html:134-139
  - 6 lines: docs/index.html:121-126 ↔ docs/index.html:133-138
  - 7 lines: docs/index.html:121-127 ↔ docs/index.html:139-145
  - 7 lines: docs/index.html:121-127 ↔ docs/index.html:145-151
  - 7 lines: docs/index.html:121-127 ↔ docs/index.html:151-157
  - 7 lines: docs/index.html:121-127 ↔ report.html:139-145
  - 7 lines: docs/index.html:121-127 ↔ report.html:145-151
  - 7 lines: docs/index.html:121-127 ↔ report.html:151-157
  - 7 lines: docs/index.html:121-127 ↔ report.html:157-163
  - 7 lines: docs/index.html:121-127 ↔ report.html:163-169
  - 7 lines: docs/index.html:121-127 ↔ report.html:169-175
  - 7 lines: docs/index.html:121-127 ↔ report.html:175-181
  - 7 lines: docs/index.html:121-127 ↔ report.html:181-187
  - 7 lines: docs/index.html:121-127 ↔ report.html:187-193
  - 7 lines: docs/index.html:121-127 ↔ report.html:193-199
  - 7 lines: docs/index.html:121-127 ↔ report.html:199-205
  - 7 lines: docs/index.html:121-127 ↔ report.html:205-211
  - 7 lines: docs/index.html:121-127 ↔ report.html:211-217
  - 7 lines: docs/index.html:121-127 ↔ report.html:217-223
  - 7 lines: docs/index.html:121-127 ↔ report.html:223-229
  - 7 lines: docs/index.html:121-127 ↔ report.html:229-235
  - 7 lines: docs/index.html:121-127 ↔ report.html:235-241
  - 7 lines: docs/index.html:121-127 ↔ report.html:241-247
  - 7 lines: docs/index.html:121-127 ↔ report.html:247-253
  - 7 lines: docs/index.html:121-127 ↔ report.html:253-259
  - 7 lines: docs/index.html:121-127 ↔ report.html:259-265
  - 7 lines: docs/index.html:121-127 ↔ report.html:265-271
  - 11 lines: docs/index.html:121-131 ↔ report.html:271-283
  - 11 lines: rules/01-security-smells.yml:2-12 ↔ rules/08-go-smells.yml:103-113
  - 10 lines: rules/01-security-smells.yml:53-62 ↔ rules/01-security-smells.yml:68-77
  - 7 lines: test-fixtures/dup1.js:1-7 ↔ test-fixtures/dup2.js:1-7

### Historical Secrets (gitleaks — full git history, not just current files)

- **2 leaked secret(s) found in git history** — sub-score 50/100
  - `generic-api-key` in test-fixtures/rails/config/secrets.yml:2 (commit 560b7622)
  - `aws-access-token` in test-fixtures/bad.py:31 (commit a933837c)

## Cognitive Debt (knowledge concentration)

- Bus-factor risk ratio (raw): 97.8% of tracked files have had only one author ever
- Total files tracked in git history: 89
- Total distinct authors: 2 (team-size damping factor: 0.50)
- ⚠ *Score damped heavily — with only 2 total contributor(s), single-author-per-file is structural, not a debt signal.*

Files only one person has ever touched:

  - action.yml (Solo Builder)
  - bin/aidebt-scan.js (Solo Builder)
  - docs/USAGE.md (Solo Builder)
  - scripts/score.js (Solo Builder)
  - scripts/git-mine.js (Solo Builder)
  - scripts/test-config-integration.js (Solo Builder)
  - CONTRIBUTING.md (Solo Builder)
  - skills/ai-debt-audit/SKILL.md (Solo Builder)
  - .claude-plugin/plugin.json (Solo Builder)
  - package.json (Solo Builder)
  - docs/WHAT_IT_CATCHES.md (Solo Builder)
  - CALIBRATION_50_REPOS.md (Solo Builder)
  - calibration-pilot-results/caddyserver_caddy.json (Solo Builder)
  - calibration-pilot-results/calcom_cal.com.json (Solo Builder)
  - calibration-pilot-results/encode_django-rest-framework.json (Solo Builder)
  - calibration-pilot-results/forem_forem.json (Solo Builder)
  - calibration-pilot-results/gin-gonic_gin.json (Solo Builder)
  - calibration-pilot-results/gofiber_fiber.json (Solo Builder)
  - calibration-pilot-results/gothinkster_realworld.json (Solo Builder)
  - calibration-pilot-results/miguelgrinberg_flasky.json (Solo Builder)
  - calibration-pilot-results/pallets_flask.json (Solo Builder)
  - calibration-pilot-results/shadcn-ui_taxonomy.json (Solo Builder)
  - calibration-pilot-results/spring-projects_spring-petclinic.json (Solo Builder)
  - calibration-pilot-results/wagtail_wagtail.json (Solo Builder)
  - docs/TOOLS.md (Solo Builder)
  - .aidebtrc.json (Solo Builder)
  - .github/workflows/self-scan.yml (Solo Builder)
  - .gitattributes (Solo Builder)
  - .github/workflows/ci.yml (Solo Builder)
  - rules/09-java-spring-smells.yml (Solo Builder)
  - rules/README.md (Solo Builder)
  - scripts/score.test.js (Solo Builder)
  - scripts/test-rules.js (Solo Builder)
  - test-fixtures/java/src/main/java/com/example/InsecureClient.java (Solo Builder)
  - test-fixtures/java/src/main/java/com/example/SecurityConfig.java (Solo Builder)
  - test-fixtures/java/src/main/java/com/example/UserService.java (Solo Builder)
  - rules/08-go-smells.yml (Solo Builder)
  - test-fixtures/go/main.go (Solo Builder)
  - Dockerfile (Solo Builder)
  - CALIBRATION.md (Solo Builder)
  - assets/logo.svg (Solo Builder)
  - marketing/launch-drafts.md (Solo Builder)
  - marketing/release-notes-v1.4.0.md (Solo Builder)
  - LICENSE (Solo Builder)
  - rules/07-rails-smells.yml (Solo Builder)
  - test-fixtures/rails/app/controllers/users_controller.rb (Solo Builder)
  - test-fixtures/rails/config/initializers/cors.rb (Solo Builder)
  - test-fixtures/rails/config/secrets.yml (Solo Builder)
  - .dockerignore (Solo Builder)
  - .gitignore (Solo Builder)
  - .github/workflows/ai-debt-check.yml (Solo Builder)
  - rules/01-security-smells.yml (Solo Builder)
  - assets/demo-terminal.png (Solo Builder)
  - assets/demo-terminal.svg (Solo Builder)
  - assets/sample-report.png (Solo Builder)
  - docs/index.html (Solo Builder)
  - examples/sample-report.md (Solo Builder)
  - ai-debt-audit (Solo Builder)
  - ai-debt-report.html (Solo Builder)
  - ai-debt-report.md (Solo Builder)
  - test-fixtures/flask/requirements.txt (Solo Builder)
  - rules/06-django-flask-smells.yml (Solo Builder)
  - test-fixtures/django/myproject/settings.py (Solo Builder)
  - test-fixtures/django/views.py (Solo Builder)
  - test-fixtures/flask/app.py (Solo Builder)
  - scripts/colors.js (Solo Builder)
  - node_modules/.package-lock.json (Solo Builder)
  - package-lock.json (Solo Builder)
  - test-fixtures/bad.py (Solo Builder)
  - node_modules/.bin/jscpd (Solo Builder)
  - node_modules/cpd-linux-x64-gnu/LICENSE (Solo Builder)
  - node_modules/cpd-linux-x64-gnu/README.md (Solo Builder)
  - node_modules/cpd-linux-x64-gnu/cpd-bin/cpd (Solo Builder)
  - node_modules/cpd-linux-x64-gnu/package.json (Solo Builder)
  - node_modules/jscpd/README.md (Solo Builder)
  - node_modules/jscpd/package.json (Solo Builder)
  - node_modules/jscpd/platform-map.js (Solo Builder)
  - node_modules/jscpd/run-jscpd.js (Solo Builder)
  - test-fixtures/dup1.js (Solo Builder)
  - test-fixtures/dup2.js (Solo Builder)
  - test-fixtures/bad.ts (Solo Builder)
  - test-fixtures/supabase/schema.sql (Solo Builder)
  - test-fixtures/webhooks/route.ts (Solo Builder)
  - rules/05-supabase-smells.yml (Solo Builder)
  - rules/03-placeholder-and-stub-smells.yml (Solo Builder)
  - rules/04-react-node-smells.yml (Solo Builder)
  - rules/02-error-handling-smells.yml (Solo Builder)

## Intent Debt (externalized rationale)

- Generic/uninformative commit messages: 3.6% of commits
- Refactor-commit ratio (trend indicator, not scored): 3.6%

Commits flagged as generic/uninformative:

  - `7fb3e88` Solo Builder: "update"
  - `0933525` Solo Builder: "fix"
  - `f44bc42` Solo Builder: "wip"

---
*Methodology is a v1 heuristic pending calibration against real audited repos — see scripts/score.js for exact weights and formulas.*
