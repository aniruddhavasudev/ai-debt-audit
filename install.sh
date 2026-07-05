#!/usr/bin/env bash
# One-command install for ai-debt-audit.
#
#   curl -fsSL https://raw.githubusercontent.com/aniruddhavasudev/ai-debt-audit/main/install.sh | bash
#
# Installs the CLI (clone + npm install + npm link), then offers — but never
# requires — the optional external scanners. The CLI produces a real scored
# scan with none of them installed; each adds coverage:
#   semgrep   → 74 AI-debt pattern rules       (pip3 install semgrep)
#   bandit    → Python security checks         (pip3 install bandit)
#   pip-audit → Python dependency CVEs         (pip3 install pip-audit)
#   gitleaks  → secrets in git history         (github.com/gitleaks/gitleaks#installing)
set -euo pipefail

REPO="https://github.com/aniruddhavasudev/ai-debt-audit.git"
INSTALL_DIR="${AIDEBT_INSTALL_DIR:-$HOME/.ai-debt-audit}"

say() { printf '\033[1m%s\033[0m\n' "$*"; }

command -v node >/dev/null 2>&1 || { echo "node is required (>= 18): https://nodejs.org" >&2; exit 1; }
command -v git  >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }

if [ -d "$INSTALL_DIR/.git" ]; then
  say "Updating existing install in $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --ff-only --quiet
else
  say "Installing ai-debt-audit to $INSTALL_DIR"
  git clone --quiet "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install --no-audit --no-fund --silent
npm link --silent 2>/dev/null || sudo npm link --silent

say "CLI installed: aidebt-scan <path-to-repo>"

# Optional extras — offered, never required. Non-interactive (curl | bash)
# runs skip this block entirely; the scan degrades gracefully without them.
if [ -t 0 ] && command -v pip3 >/dev/null 2>&1; then
  missing=()
  for t in semgrep bandit pip-audit; do
    command -v "$t" >/dev/null 2>&1 || missing+=("$t")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    printf 'Install optional scanners (%s) for full coverage? [y/N] ' "${missing[*]}"
    read -r answer
    case "$answer" in
      [Yy]*) pip3 install --quiet "${missing[@]}" && say "Installed: ${missing[*]}" ;;
      *) echo "Skipped — the scan will note which checks were skipped." ;;
    esac
  fi
fi

command -v gitleaks >/dev/null 2>&1 || echo "Note: gitleaks (secrets-in-history detection) has no pip package — https://github.com/gitleaks/gitleaks#installing"

say "Try it: aidebt-scan ."
