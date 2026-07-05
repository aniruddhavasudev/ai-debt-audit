<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:1e90ff,50:9b59b6,100:ff6b6b&height=180&section=header&text=ai-debt-audit&fontSize=48&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Measure%20comprehension%20debt%20in%20AI-generated%20code&descAlignY=58&descSize=18" width="100%" alt="ai-debt-audit banner"/>

<img src="assets/logo.svg" width="90" height="90" alt="ai-debt-audit logo">

[![CI](https://img.shields.io/github/actions/workflow/status/aniruddhavasudev/ai-debt-audit/ci.yml?label=CI&logo=githubactions&logoColor=white&color=2ea44f&style=for-the-badge)](https://github.com/aniruddhavasudev/ai-debt-audit/actions/workflows/ci.yml)
[![AI-Debt Score](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/badge.json&style=for-the-badge)](examples/sample-report.md)

*The "AI-Debt Score" badge is this repo scanning itself, on a schedule — a live number, not a claim.*

<p>
<a href="#-quick-start"><img src="https://img.shields.io/badge/-Quick_Start-1e90ff?style=for-the-badge" /></a>
<a href="#-features"><img src="https://img.shields.io/badge/-Features-9b59b6?style=for-the-badge" /></a>
<a href="#-what-it-catches"><img src="https://img.shields.io/badge/-What_It_Catches-2ea44f?style=for-the-badge" /></a>
<a href="docs/TOOLS.md"><img src="https://img.shields.io/badge/-The_7_Tools-16a085?style=for-the-badge" /></a>
<a href="docs/USAGE.md"><img src="https://img.shields.io/badge/-Full_Usage-ff6b6b?style=for-the-badge" /></a>
<a href="#-use-it-as-a-claude-code-plugin"><img src="https://img.shields.io/badge/-Claude_Code_Plugin-cc785c?style=for-the-badge" /></a>
<a href="CALIBRATION_50_REPOS.md"><img src="https://img.shields.io/badge/-Calibration-f1c40f?style=for-the-badge" /></a>
</p>

</div>

<br>

AI coding tools like Copilot, Cursor, and ChatGPT can write code fast — but they often leave hidden problems behind: security gaps, shortcuts nobody documented, and code that only one person understands.

**ai-debt-audit scans any codebase and gives you one simple score** showing how much of that hidden risk it's carrying — in seconds, without sending your code anywhere.

> [!IMPORTANT]
> **100% private.** Your code never leaves your machine, and no AI is used to judge it. Every result points to an exact line in your code, so you can see for yourself — not just trust a black box.

<br>

<div align="center">
<table>
<tr>
<td width="33%" valign="top" align="center">

### 🔴 Security & quality
![50%](https://img.shields.io/badge/weight-50%25-ff6b6b?style=for-the-badge)

Security holes, copy-pasted code, and unfinished work left in place.

</td>
<td width="33%" valign="top" align="center">

### 🟣 Knowledge risk
![25%](https://img.shields.io/badge/weight-25%25-9b59b6?style=for-the-badge)

What happens if the one person who understands this code leaves.

</td>
<td width="33%" valign="top" align="center">

### 🟢 Missing context
![25%](https://img.shields.io/badge/weight-25%25-16a085?style=for-the-badge)

Whether anyone ever wrote down *why* the code works the way it does.

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

In plain terms: things like exposed data, security shortcuts, secrets accidentally left in the code, and knowledge trapped in one person's head — the kind of stuff that's easy to miss when code was generated fast and merged even faster.

Works across Python, Ruby, JavaScript/TypeScript, Go, and Java projects.

**→ See the full, specific list of every check: [docs/WHAT_IT_CATCHES.md](docs/WHAT_IT_CATCHES.md)**

<br>

## ✨ Features

- **One composite 0-100 score**, blended from technical, cognitive, and intent debt — same scale every time, so two repos (or the same repo over time) are directly comparable
- **74 custom Semgrep rules** for AI-specific failure patterns (disabled RLS, SSTI, mass assignment, missing auth checks, stub code left in main) across Python, Ruby, JavaScript/TypeScript, Go, and Java, layered on top of Bandit, pip-audit, npm audit, jscpd, and gitleaks
- **Measured AI-assisted commit detection** — reads real Co-Authored-By trailers (Claude Code, GitHub Copilot, Cursor) directly from git history to report what fraction of commits were AI-assisted, instead of only inferring AI involvement from code patterns
- **Historical secret scanning** via gitleaks — catches a credential committed and later deleted, which a snapshot-only scanner never sees
- **Bus-factor / knowledge-concentration tracking** from real git history, with bot commits excluded and a team-size damping factor so small teams aren't penalized for being small
- **"Giant dump" commit detection** — flags commits that touched many files or churned hundreds of lines in one shot (measured from `git log --numstat`), the "wasn't reviewed incrementally" pattern, regardless of team size
- **Four report formats by default, no flags needed** — Markdown, standalone HTML, a plain-language CSV workbook, and a client-deliverable PDF
- **`--diff <ref>` mode** — scores only what changed vs. a base branch/commit, answering "did this PR add debt" instead of re-scanning everything
- **`--history` tracking** — appends each scan to a local JSON log and shows the trend (improving/worsening) between runs
- **SARIF export + a GitHub Action** — upload findings straight to GitHub's Security tab and gate PRs with `--fail-on-score`
- **`.aidebtrc.json` config** — override category weights, ignore specific rules, or exclude paths per target repo
- **A Claude Code plugin** — ask Claude to run a real scan (not describe one) from inside a conversation
- **100% local** — every tool runs on your machine; no code or findings are ever sent to an LLM or third-party service

<br>

## 🚀 Quick start

Three things to install, then one command to run:

```bash
# 1. Install the scanning tools this project relies on
pip3 install semgrep bandit pip-audit   # + gitleaks: https://github.com/gitleaks/gitleaks#installing

# 2. Get the code and link the CLI
git clone https://github.com/aniruddhavasudev/ai-debt-audit.git
cd ai-debt-audit && npm install && npm link

# 3. Scan any repo on your machine
aidebt-scan /path/to/any/repo
```

That's it — no accounts, no config required, no code sent anywhere. Every scan writes all four report formats by default: Markdown, HTML, PDF, and a plain-language CSV workbook — no extra flags needed.

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

Full flag reference, `.aidebtrc.json` config, GitHub Action setup, Claude Code plugin install.

</td>
<td width="50%" align="center">

![Tools](https://img.shields.io/badge/🧰_docs/TOOLS.md-9b59b6?style=for-the-badge)

What each of the seven tools catches and how the score is composed.

</td>
</tr>
</table>
</div>

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

You still need `semgrep`, `bandit`, `pip-audit`, and `gitleaks` installed on your machine (step 1 of [Quick start](#-quick-start)) — the plugin runs the same local scanner, it just wires it into the conversation.

**→ Full plugin setup and verification steps: [docs/USAGE.md](docs/USAGE.md#using-it-as-a-claude-code-plugin)**

<br>

## 📜 License

Free to use, modify, and self-host — including commercially. The only rule: if you offer a modified version as a hosted service, you have to share your changes back too. Full details: [LICENSE](LICENSE) (AGPL-3.0).

## 📍 Where this stands

This is a new tool and still being fine-tuned. It's been tested against real, popular open-source projects with good results so far — see [CALIBRATION_50_REPOS.md](CALIBRATION_50_REPOS.md) for the details. If a result looks wrong on your own repo, telling us is more useful than a star.

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:ff6b6b,50:9b59b6,100:1e90ff&height=100&section=footer" width="100%" alt="footer"/>
</div>
