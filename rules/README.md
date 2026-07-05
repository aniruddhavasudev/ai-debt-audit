## Running the rule set

```
semgrep --config rules/ --json --output findings.json /path/to/target/repo
```

Semgrep scans every `.yml` in this directory automatically — no need to reference files individually. Each rule carries two pieces of metadata the scorer (`scripts/score.js`) reads:

- `ai_debt_category` — which bucket the finding rolls up into (`security`, `error_handling`, `incomplete_implementation`, `framework_misuse`, `reinvented_wheel`)
- `weight` — points contributed per occurrence, before saturation/normalization is applied

## File layout

- `01-security-smells.yml` — hardcoded secrets, SQL injection, eval/exec, insecure TLS/random, cross-language
- `02-error-handling-smells.yml` — swallowed exceptions, empty catch blocks, generic catch-alls
- `03-placeholder-and-stub-smells.yml` — unfinished stubs, placeholder comments, debug leftovers
- `04-react-node-smells.yml` — React/Next.js-specific misuse (hooks, re-renders, `any` types)
- `05-supabase-smells.yml` — disabled RLS, permissive policies, service-role key exposure, unvalidated webhooks
- `06-django-flask-smells.yml` — `DEBUG=True`, CSRF/CORS misconfiguration, SSTI, insecure deserialization
- `07-rails-smells.yml` — mass assignment (`params.permit!`, raw `params[...]`), `.html_safe`/`raw()` XSS, SQL string interpolation, `Marshal.load`, dangerous `send`
- `08-go-smells.yml` — SQL/command injection via `fmt.Sprintf`, `InsecureSkipVerify`, `math/rand` for tokens, path traversal, empty `if err != nil {}`, JWT "none" algorithm
- `09-java-spring-smells.yml` — Spring `.csrf().disable()`/`permitAll()`, CORS wildcard, SQL/command injection, `SecureRandom` vs `Random`, path traversal, XXE, insecure deserialization, trust-all TLS

## Extending the rule set

Every rule should be traceable to a *specific, observed AI failure mode* — not a generic lint rule already covered by ESLint/Pylint/SonarQube. The differentiation of this project is detecting patterns characteristic of unreviewed LLM output specifically, not general code quality. Before adding a rule, ask: "would a human who wrote this by hand plausibly make this exact mistake at this frequency?" If yes, it's not an AI-debt signal, it's just a bug — leave it to the generic linters and don't dilute the score.

Two real bugs were caught during development by testing rules against actual trigger cases in `test-fixtures/`, not just `semgrep --validate` (which only checks YAML/pattern syntax, not whether a rule actually fires):
- `except X:` patterns didn't match Python's `except X as e:` form — silently zero matches on the most common real-world syntax variant.
- The hardcoded-secret rule excluded any path containing `test` or `fixture`, which is reasonable-sounding but wrong — real secrets leak into seed/test files constantly, and excluding them defeats the rule's purpose.

If you add a rule, add a real trigger fixture and register it in `scripts/test-rules.js`'s `EXPECTED_RULE_IDS` — CI will then catch this class of bug automatically instead of relying on someone noticing manually.
