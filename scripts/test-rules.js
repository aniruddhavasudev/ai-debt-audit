#!/usr/bin/env node
/**
 * test-rules.js — regression test for the Semgrep ruleset.
 *
 * This exists because we found real bugs during development that
 * `semgrep --validate` cannot catch: rules that parse fine but silently
 * fail to match their intended trigger case (e.g. `except X:` not matching
 * `except X as e:`, or a regex that's too strict for real-world syntax
 * variants). Validation only proves the YAML is well-formed — it says
 * nothing about whether the rule actually fires. This script runs the
 * full ruleset against test-fixtures/ and asserts every rule we've
 * verified before still fires on its known trigger case, so a future
 * edit can't silently regress one without CI catching it.
 *
 * Usage: node scripts/test-rules.js
 * Exit code 0 = every expected rule fired at least once. Non-zero = a
 * regression was found (or a new false-negative), and the specific rule
 * IDs are printed.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RULES_DIR = path.join(PACKAGE_ROOT, "rules");
const FIXTURES_DIR = path.join(PACKAGE_ROOT, "test-fixtures");

// Every rule ID we've manually confirmed fires against test-fixtures/ during
// development. If a rule is added to the ruleset but never given a fixture
// (or a fixture is removed), it simply won't appear here — that's a gap to
// close, not a reason to fail CI, so this list is intentionally not "all
// 44 rules," just the ones we've already proven and want to keep proving.
const EXPECTED_RULE_IDS = [
  "ai-debt-hardcoded-secret",
  "ai-debt-sql-string-concat-py",
  "ai-debt-eval-exec-dynamic-js",
  "ai-debt-subprocess-shell-true",
  "ai-debt-disabled-tls-verification-py",
  "ai-debt-insecure-random-for-token-py",
  "ai-debt-insecure-random-for-token-js",
  "ai-debt-empty-catch-block-js",
  "ai-debt-empty-except-block-py",
  "ai-debt-catch-log-only-swallow-py",
  "ai-debt-generic-exception-catch-all-py",
  "ai-debt-unhandled-promise-then-no-catch",
  "ai-debt-not-implemented-stub",
  "ai-debt-console-log-debug-leftover",
  "ai-debt-any-type-typescript",
  "ai-debt-supabase-rls-disabled",
  "ai-debt-supabase-permissive-rls-policy",
  "ai-debt-supabase-unvalidated-webhook",
  "ai-debt-django-debug-true",
  "ai-debt-django-allowed-hosts-wildcard",
  "ai-debt-django-hardcoded-secret-key",
  "ai-debt-django-csrf-exempt",
  "ai-debt-drf-permission-allowany",
  "ai-debt-django-raw-queryset-injection",
  "ai-debt-flask-debug-true",
  "ai-debt-flask-hardcoded-secret-key",
  "ai-debt-flask-ssti-render-template-string",
  "ai-debt-flask-cors-wildcard",
  "ai-debt-insecure-pickle-loads",
  "ai-debt-flask-route-missing-login-required",
  "ai-debt-rails-mass-assignment-permit-bang",
  "ai-debt-rails-csrf-protection-skipped",
  "ai-debt-rails-html-safe-on-input",
  "ai-debt-rails-sql-string-interpolation",
  "ai-debt-rails-mass-assignment-raw-params",
  "ai-debt-rails-open-redirect",
  "ai-debt-rails-dangerous-send",
  "ai-debt-rails-insecure-marshal-load",
  "ai-debt-rails-hardcoded-secret-key-base",
  "ai-debt-rails-cors-wildcard",
];

function main() {
  const raw = execFileSync(
    "semgrep",
    ["--config", RULES_DIR, FIXTURES_DIR, "--json", "--quiet"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 }
  );
  const results = JSON.parse(raw).results || [];
  const firedIds = new Set(results.map((r) => r.check_id.split(".").pop()));

  const missing = EXPECTED_RULE_IDS.filter((id) => !firedIds.has(id));

  console.log(`Fired ${firedIds.size} distinct rule(s) out of ${EXPECTED_RULE_IDS.length} expected.`);

  if (missing.length > 0) {
    console.error("\nREGRESSION: the following rules were expected to fire against test-fixtures/ but did not:");
    for (const id of missing) console.error(`  - ${id}`);
    process.exit(1);
  }

  console.log("All expected rules fired. No regressions.");
}

main();
