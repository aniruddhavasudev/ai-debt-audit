<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1e90ff,50:9b59b6,100:ff6b6b&height=180&section=header&text=ai-debt-audit&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Measure%20comprehension%20debt%20in%20AI-generated%20code&descAlignY=58&descSize=18" width="100%" alt="ai-debt-audit banner"/>

<img src="assets/logo.svg" width="90" height="90" alt="ai-debt-audit logo">

[![CI](https://img.shields.io/github/actions/workflow/status/aniruddhavasudev/ai-debt-audit/ci.yml?label=CI&logo=githubactions&logoColor=white&color=2ea44f&style=for-the-badge)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
[![AI-Debt Score](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json&style=for-the-badge)](examples/sample-report.md)
[![License](https://img.shields.io/badge/License-AGPL%20v3-1e90ff?style=for-the-badge)](LICENSE)
[![Stars](https://img.shields.io/github/stars/aniruddhavasudev/ai-debt-audit?style=for-the-badge&color=f1c40f)](https://github.com/aniruddhavasudev/ai-debt-audit/stargazers)

![Rules](https://img.shields.io/badge/semgrep_rules-74-ff6b6b?style=for-the-badge&logo=semgrep&logoColor=white)
![Tools](https://img.shields.io/badge/tools_orchestrated-7-9b59b6?style=for-the-badge)
![Languages](https://img.shields.io/badge/languages-6-16a085?style=for-the-badge)
![LLM calls](https://img.shields.io/badge/LLM_calls-0-e74c3c?style=for-the-badge)

*The "AI-Debt Score" badge is this repo scanning itself, on a schedule — a live number, not a claim.*

<p>
<a href="#-quick-start"><img src="https://img.shields.io/badge/-Quick_Start-1e90ff?style=for-the-badge" /></a>
<a href="#-what-it-catches"><img src="https://img.shields.io/badge/-What_It_Catches-2ea44f?style=for-the-badge" /></a>
<a href="docs/TOOLS.md"><img src="https://img.shields.io/badge/-The_7_Tools-16a085?style=for-the-badge" /></a>
<a href="docs/USAGE.md"><img src="https://img.shields.io/badge/-Full_Usage-ff6b6b?style=for-the-badge" /></a>
<a href="CALIBRATION_50_REPOS.md"><img src="https://img.shields.io/badge/-Calibration-f1c40f?style=for-the-badge" /></a>
</p>

</div>

<br>

A repo scanner for the mess AI coding assistants leave behind: disabled RLS, auth checks that only exist in the happy path, `debug=True` left on, tutorial-pasted secrets — plus the quieter stuff, one person owning half the codebase, commits that just say "fix."

Point it at a repo, it runs seven deterministic tools, you get one score and a full breakdown in seconds.

> [!IMPORTANT]
> **Fully local.** Nothing calls an LLM. Nothing leaves your machine. Every finding traces to a specific rule and line — evidence, not a vibe check.

<br>

<div align="center">
<table>
<tr>
<td width="33%" valign="top" align="center">

### 🔴 Technical debt
![50%](https://img.shields.io/badge/weight-50%25-ff6b6b?style=for-the-badge)

Security holes, duplicated logic, unfinished stubs — 74 custom Semgrep rules + Bandit, pip-audit, npm audit, jscpd.

</td>
<td width="33%" valign="top" align="center">

### 🟣 Cognitive debt
![25%](https://img.shields.io/badge/weight-25%25-9b59b6?style=for-the-badge)

Knowledge concentration — what happens if the one person who understands this leaves. Measured from real git history.

</td>
<td width="33%" valign="top" align="center">

### 🟢 Intent debt
![25%](https://img.shields.io/badge/weight-25%25-16a085?style=for-the-badge)

Whether anyone wrote down *why*. Proxied from commit quality and refactor cadence.

</td>
</tr>
</table>
</div>

<div align="center">

**Risk tiers — same 0-100 scale every time**

![Low](https://img.shields.io/badge/0--25-Low-2ea44f?style=for-the-badge) ![Medium](https://img.shields.io/badge/26--50-Medium-f1c40f?style=for-the-badge) ![High](https://img.shields.io/badge/51--75-High-e67e22?style=for-the-badge) ![Critical](https://img.shields.io/badge/76--100-Critical-e74c3c?style=for-the-badge)

</div>

<br>

![demo](assets/demo-terminal.svg)

**Real example:** a full, unedited scan of a real public Next.js/Supabase SaaS starter — [`examples/sample-report.md`](examples/sample-report.md).

If you run this and it finds something real, a star helps other people find it too 👇

<br>

## ✅ What it catches

<div align="center">

![Security](https://img.shields.io/badge/🔴_SECURITY-technical_debt-ff6b6b?style=for-the-badge)

</div>

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

<div align="center">

![Process](https://img.shields.io/badge/🟣🟢_PROCESS-cognitive_%2B_intent_debt-9b59b6?style=for-the-badge)

</div>

✅ Bus factor / knowledge concentration from real `git log` history<br/>
✅ Bot commits excluded from team-size math<br/>
✅ Team-size damping — fair to solo projects<br/>
✅ Commit message quality, not just "fix"<br/>
✅ Refactor cadence vs. pure feature velocity<br/>
✅ Shallow-clone detection with a live warning

<div align="center">

![Stacks](https://img.shields.io/badge/📦_SUPPORTED-stacks-16a085?style=for-the-badge)

</div>

![Python](https://img.shields.io/badge/Python-Flask%20%7C%20Django-3776ab?style=for-the-badge&logo=python&logoColor=white)
![Ruby](https://img.shields.io/badge/Ruby-Rails-cc0000?style=for-the-badge&logo=rubyonrails&logoColor=white)
![JS/TS](https://img.shields.io/badge/JS%2FTS-Next.js%20%7C%20Express-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)
![Go](https://img.shields.io/badge/Go-00add8?style=for-the-badge&logo=go&logoColor=white)
![Java](https://img.shields.io/badge/Java-Spring%20Boot-6db33f?style=for-the-badge&logo=spring&logoColor=white)

<br>

## 🚀 Quick start

```bash
# Docker — zero local installs
docker build -t ai-debt-audit .
docker run --rm -v /path/to/any/repo:/repo ai-debt-audit . --out ai-debt-report.md
```

```bash
# Local install
pip install semgrep bandit pip-audit   # + gitleaks: https://github.com/gitleaks/gitleaks#installing
git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit && npm install && npm link
aidebt-scan /path/to/any/repo
```

```
────────────────────────────────────────────────────────
  AI-DEBT REPORT
────────────────────────────────────────────────────────
  Composite Score: 28/100   [Medium Risk]
────────────────────────────────────────────────────────
  Technical debt   ███░░░░░░░░░░░░░░░░░░░░░   14/100  (50%)
  Cognitive debt   ███████████████████░░░░░   81/100  (25%)
  Intent debt      █░░░░░░░░░░░░░░░░░░░░░░░    3/100  (25%)
────────────────────────────────────────────────────────
```
A real run, not a mockup — Markdown + styled standalone HTML, every time.

<div align="center">
<table>
<tr>
<td width="50%" align="center">

![Usage](https://img.shields.io/badge/📖_docs/USAGE.md-1e90ff?style=for-the-badge)

Full flag reference, `.aidebtrc.json` config, GitHub Action setup, Claude Code skill install.

</td>
<td width="50%" align="center">

![Tools](https://img.shields.io/badge/🧰_docs/TOOLS.md-9b59b6?style=for-the-badge)

What each of the seven tools catches and how the score is composed.

</td>
</tr>
</table>
</div>

<br>

## 📜 License

[AGPL-3.0](LICENSE) — use, modify, and self-host freely, including commercially. If you run a modified version as a network service, you must share your modified source with its users. Deliberate: it stops a silent closed-source fork of a hosted competitor.

## 📍 Where this stands

Scoring weights are a v1 heuristic. A 12-repo pilot batch (real public repos, full git history, no cherry-picking) landed every scored repo in Low/Medium tier with no crashes at real-world scale — see [CALIBRATION_50_REPOS.md](CALIBRATION_50_REPOS.md) for the numbers, and [CALIBRATION.md](CALIBRATION.md) for earlier findings. This is a pilot toward a full 50-repo run, not a finished calibration yet. If a finding looks wrong against your own repo, that's more useful to report than a star.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:ff6b6b,50:9b59b6,100:1e90ff&height=100&section=footer" width="100%" alt="footer"/>
</div>
