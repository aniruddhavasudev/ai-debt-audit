#!/usr/bin/env bash
# Resolves which gitleaks release to install: the latest tag, or a pinned
# fallback if GitHub's API is rate-limited. Shared by action.yml, ci.yml,
# and self-scan.yml (each of which still runs its own install command —
# ci.yml/self-scan.yml need sudo, the composite action doesn't — so only
# this version-resolution step is centralized) so the fallback version
# only needs updating in one place instead of three.
#
# Prints the resolved version (no "v" prefix) to stdout; any warning goes
# to stderr so it can't end up mixed into a caller's `VERSION=$(...)`.
set -euo pipefail

VERSION=$(curl -sSf https://api.github.com/repos/gitleaks/gitleaks/releases/latest | grep '"tag_name"' | head -1 | cut -d'"' -f4 | sed 's/^v//')
if [ -z "$VERSION" ]; then
  VERSION="8.30.1"
  echo "Warning: could not resolve latest gitleaks version (rate-limited?), falling back to pinned $VERSION" >&2
fi
echo "$VERSION"
