# What it catches

The full, specific list of what `aidebt-scan` detects — the plain-English version lives in the [README](../README.md).

## 🔴 Security (technical debt)

✅ Disabled Supabase Row-Level Security<br/>
✅ SSTI via Flask `render_template_string`<br/>
✅ Django `DEBUG=True` left on in production<br/>
✅ Rails mass-assignment via `params.permit!`<br/>
✅ Spring `.csrf().disable()` / `permitAll()`<br/>
✅ CORS wildcard origins (Flask-CORS, Spring `@CrossOrigin`)<br/>
✅ SQL & command injection (Java, Go, Python)<br/>
✅ Path traversal via unsanitized file paths<br/>
✅ XXE, insecure deserialization, trust-all TLS<br/>
✅ Weak randomness for tokens/secrets<br/>
✅ Silently swallowed errors (Go's `if err != nil {}`)<br/>
✅ Stub code (`NotImplementedError`) left in main<br/>
✅ Hardcoded secrets — current tree *and* full git history<br/>
✅ Dependency CVEs (pip-audit, npm audit)<br/>
✅ Copy-paste duplication (jscpd)

## 🟣🟢 Process signals (cognitive + intent debt)

✅ Bus factor / knowledge concentration from real `git log` history<br/>
✅ Bot commits excluded from team-size math<br/>
✅ Team-size damping — fair to solo projects<br/>
✅ Commit message quality, not just "fix"<br/>
✅ Refactor cadence vs. pure feature velocity<br/>
✅ Shallow-clone detection with a live warning

## 📦 Supported stacks

![Python](https://img.shields.io/badge/Python-Flask%20%7C%20Django-3776ab?style=for-the-badge&logo=python&logoColor=white)
![Ruby](https://img.shields.io/badge/Ruby-Rails-cc0000?style=for-the-badge&logo=rubyonrails&logoColor=white)
![JS/TS](https://img.shields.io/badge/JS%2FTS-Next.js%20%7C%20Express-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)
![Go](https://img.shields.io/badge/Go-00add8?style=for-the-badge&logo=go&logoColor=white)
![Java](https://img.shields.io/badge/Java-Spring%20Boot-6db33f?style=for-the-badge&logo=spring&logoColor=white)

See [docs/TOOLS.md](TOOLS.md) for which of the seven underlying tools catches what, and how the score is composed.
