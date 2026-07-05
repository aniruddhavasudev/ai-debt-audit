<div align="center">
  <img src="assets/logo.svg" width="120" height="120" alt="ai-debt-audit logo">

  # ai-debt-audit

  **Measure comprehension debt in AI-generated code.**

  [![CI](https://img.shields.io/github/actions/workflow/status/aniruddhavasudev/ai-debt-audit/ci.yml?label=CI&logo=githubactions&logoColor=white&color=2ea44f)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
  [![AI-Debt Score](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json)](examples/sample-report.md)
  ![Rules](https://img.shields.io/badge/semgrep_rules-74-ff6b6b?logo=semgrep&logoColor=white)
  ![Tools](https://img.shields.io/badge/tools_orchestrated-7-9b59b6)
  ![Node](https://img.shields.io/badge/node-%3E%3D18-3c873a?logo=nodedotjs&logoColor=white)
  ![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff69b4)
  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-1e90ff.svg)](LICENSE)
  [![Stars](https://img.shields.io/github/stars/aniruddhavasudev/ai-debt-audit?style=social)](https://github.com/aniruddhavasudev/ai-debt-audit/stargazers)

  *The "AI-Debt Score" badge above is this repo scanning itself, on a schedule — a live number, not a claim.*

  <p>
    <a href="#quick-start"><b>Quick Start</b></a> ·
    <a href="docs/TOOLS.md"><b>The Seven Tools</b></a> ·
    <a href="docs/USAGE.md"><b>Full Usage Guide</b></a> ·
    <a href="CALIBRATION.md"><b>Calibration Notes</b></a> ·
    <a href="CONTRIBUTING.md"><b>Contributing</b></a>
  </p>
</div>

---

A repo scanner for the mess AI coding assistants leave behind: disabled RLS, auth checks that only exist in the happy path, `debug=True` left on, tutorial-pasted secrets — plus the quieter stuff, one person owning half the codebase, commits that just say "fix."

Point it at a repo, it runs seven deterministic tools, you get one score and a full breakdown in seconds. **Fully local — nothing calls an LLM, nothing leaves your machine.**

<table>
<tr>
<td width="33%" valign="top">

### 🔧 Technical debt
![50%](https://img.shields.io/badge/weight-50%25-ff6b6b)

Security holes, duplicated logic, unfinished stubs — 74 custom Semgrep rules + Bandit, pip-audit, npm audit, jscpd.

</td>
<td width="33%" valign="top">

### 🧠 Cognitive debt
![25%](https://img.shields.io/badge/weight-25%25-9b59b6)

Knowledge concentration — what happens if the one person who understands this leaves. Measured from real git history.

</td>
<td width="33%" valign="top">

### 📝 Intent debt
![25%](https://img.shields.io/badge/weight-25%25-1e90ff)

Whether anyone wrote down *why*. Proxied from commit quality and refactor cadence.

</td>
</tr>
</table>

**Risk tiers**, same 0-100 scale every time:
![Low 0-25](https://img.shields.io/badge/0--25-Low-2ea44f) ![Medium 26-50](https://img.shields.io/badge/26--50-Medium-f1c40f) ![High 51-75](https://img.shields.io/badge/51--75-High-e67e22) ![Critical 76-100](https://img.shields.io/badge/76--100-Critical-e74c3c)

```mermaid
flowchart LR
    R[("📁 Your repo")] --> S{{"7 local tools"}}
    S --> T["🔧 Technical<br/>50%"]
    S --> C["🧠 Cognitive<br/>25%"]
    S --> I["📝 Intent<br/>25%"]
    T --> X(["🎯 Composite<br/>AI-Debt Score"])
    C --> X
    I --> X

    classDef repo fill:#1e90ff,stroke:#0b5ed7,color:#fff,stroke-width:2px
    classDef tools fill:#9b59b6,stroke:#6c3483,color:#fff,stroke-width:2px
    classDef tech fill:#ff6b6b,stroke:#c0392b,color:#fff,stroke-width:2px
    classDef cog fill:#9b59b6,stroke:#6c3483,color:#fff,stroke-width:2px
    classDef intent fill:#3498db,stroke:#21618c,color:#fff,stroke-width:2px
    classDef score fill:#f1c40f,stroke:#b7950b,color:#000,stroke-width:3px

    class R repo
    class S tools
    class T tech
    class C cog
    class I intent
    class X score
```

![demo](assets/demo-terminal.svg)

**Real example:** [`examples/sample-report.md`](examples/sample-report.md) — a scan of a real, public Next.js/Supabase SaaS starter, unedited.

![sample report](assets/sample-report.png)

If you run this and it finds something real, a star helps other people find it too 👇

## Quick start

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

**→ Full flag reference, `.aidebtrc.json` config, GitHub Action setup, and Claude Code skill install: [docs/USAGE.md](docs/USAGE.md)**

**→ What each of the seven tools catches and how the score is composed: [docs/TOOLS.md](docs/TOOLS.md)**

## License

[AGPL-3.0](LICENSE) — use, modify, and self-host freely, including commercially. If you run a modified version as a network service, you must share your modified source with its users. Deliberate: it stops a silent closed-source fork of a hosted competitor.

## Where this stands

Scoring weights are a v1 heuristic, not yet calibrated against a large repo sample — see [CALIBRATION.md](CALIBRATION.md) for real findings so far. If a finding looks wrong against your own repo, that's more useful to report than a star.
