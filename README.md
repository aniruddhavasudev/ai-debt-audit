<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1e90ff,50:9b59b6,100:ff6b6b&height=180&section=header&text=ai-debt-audit&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Find%20what%20your%20AI%20assistant%20left%20behind&descAlignY=58&descSize=18" width="100%" alt="ai-debt-audit banner"/>

<img src="assets/logo.svg" width="90" height="90" alt="ai-debt-audit logo">

[![CI](https://img.shields.io/github/actions/workflow/status/aniruddhavasudev/ai-debt-audit/ci.yml?label=CI&logo=githubactions&logoColor=white&color=2ea44f&style=for-the-badge)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
[![AI-Debt Score](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json&style=for-the-badge)](examples/sample-report.md)

*The "AI-Debt Score" badge is this repo scanning itself, on a schedule — a live number, not a claim.*

</div>

<br>

Copilot, Cursor, and Claude write code fast — and quietly leave things behind: security shortcuts, secrets in git history, code nobody on the team actually understands, commits that never say *why*.

**ai-debt-audit scans any codebase and scores that leftover risk 0–100** — in seconds, on your machine, with every finding traced to an exact file and line.

![demo](assets/demo-terminal.svg)

> [!IMPORTANT]
> **100% private.** Your code never leaves your machine, and no AI is used to judge it. Every result points to an exact line in your code, so you can see for yourself — not just trust a black box.

<br>

## 🚀 Quick start

If you have Node.js, you already have everything you need:

```bash
npx ai-debt-audit /path/to/any/repo
```

That's a real scored scan with zero setup — git-history analysis (knowledge risk, missing context, AI-assisted commits), code duplication, and dependency vulnerabilities all work out of the box. The report tells you exactly which optional checks were skipped.

**For the full scan** (74 AI-debt pattern rules, Python security, secrets in git history), add the scanning tools when you're ready:

```bash
pip3 install semgrep bandit pip-audit   # + gitleaks: https://github.com/gitleaks/gitleaks#installing
```

No accounts, no config, no code sent anywhere. Every scan writes four report formats by default — Markdown, HTML, PDF, and a plain-language CSV workbook.

**Real example:** a full, unedited scan of a real public Next.js/Supabase SaaS starter — [`examples/sample-report.md`](examples/sample-report.md).

<br>

## 📊 What the score means

<div align="center">
<table>
<tr>
<td width="33%" valign="top" align="center">

### 🔴 Security & quality
**50% of the score**

Security holes, copy-pasted code, and unfinished work left in place.

</td>
<td width="33%" valign="top" align="center">

### 🟣 Knowledge risk
**25% of the score**

What happens if the one person who understands this code leaves.

</td>
<td width="33%" valign="top" align="center">

### 🟢 Missing context
**25% of the score**

Whether anyone ever wrote down *why* the code works the way it does.

</td>
</tr>
</table>

**Risk tiers — same 0-100 scale every time:** 0–25 Low · 26–50 Medium · 51–75 High · 76–100 Critical

</div>

Works across Python, Ruby, JavaScript/TypeScript, Go, and Java projects. **Full list of every check: [docs/WHAT_IT_CATCHES.md](docs/WHAT_IT_CATCHES.md)**

<br>

## ✨ Features

**Scanning**<br/>
✅ One composite 0-100 score — technical + cognitive + intent debt, always comparable<br/>
✅ 74 custom Semgrep rules for AI-specific failure patterns across 5 languages<br/>
✅ AI-assisted commit detection — real Co-Authored-By trailers, measured not inferred<br/>
✅ Historical secret scanning — catches credentials deleted from code but still in git history<br/>
✅ Bus-factor tracking and "giant dump" commit detection from real git history<br/>
✅ Dependency vulnerability checks that work on real repos — even JS projects that never commit a lockfile

**Reports**<br/>
✅ Markdown, HTML, CSV, and PDF reports by default — no flags needed<br/>
✅ Every finding traces to an exact file and line — evidence, not a vibe check<br/>
✅ Track whether a repo is getting better or worse across scans over time

**CI/CD**<br/>
✅ Scan only what a pull request changed, instead of re-scanning the whole repo<br/>
✅ Block risky pull requests automatically — findings appear right in GitHub's Security tab<br/>
✅ Tune it per repo — adjust category weights, silence specific checks, exclude folders

**Privacy & integrations**<br/>
✅ 100% local and private — nothing ever leaves your machine, works with whatever tools you have installed<br/>
✅ Claude Code plugin — ask Claude to run a real scan from inside a conversation

**→ Full detail: [docs/WHAT_IT_CATCHES.md](docs/WHAT_IT_CATCHES.md) · [docs/TOOLS.md](docs/TOOLS.md) · [docs/USAGE.md](docs/USAGE.md)**

<br>

## 🔌 Use it as a Claude Code plugin

If you use [Claude Code](https://claude.com/claude-code), you don't need to run the CLI by hand — install this repo as a plugin and just ask Claude to audit your code. It runs a real scan (not a description of one) and reads the results back to you.

```
/plugin marketplace add aniruddhavasudev/ai-debt-audit
/plugin install ai-debt-audit@ai-debt-audit
```

Then just ask, in plain language:

> "Audit this repo for AI-generated debt"
> "Check for risks Copilot/Cursor may have left behind"
> "Give me a due-diligence debt score before we hand this off"

**→ Full plugin setup and verification steps: [docs/USAGE.md](docs/USAGE.md#using-it-as-a-claude-code-plugin)**

<br>

## 📜 License

Free to use, modify, and self-host — including commercially. The only rule: if you offer a modified version as a hosted service, you have to share your changes back too. Full details: [LICENSE](LICENSE) (AGPL-3.0).

## 📍 Where this stands

This is a new tool and still being fine-tuned. It's been calibrated against 50 real, popular open-source projects — every scan completed, every score landed where a sane scorer should put it; see [CALIBRATION_50_REPOS.md](CALIBRATION_50_REPOS.md) for the full table. And yes: this tool is itself built AI-assisted and human-verified — which is exactly the workflow it exists to keep honest. The commit history discloses it, the same way the tool rewards disclosure in yours.

If a result looks wrong on your own repo, telling us is more useful than a star.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:ff6b6b,50:9b59b6,100:1e90ff&height=100&section=footer" width="100%" alt="footer"/>
</div>
