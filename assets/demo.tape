# vhs tape — records a clean demo GIF of a real scan.
#
# Usage:
#   go install github.com/charmbracelet/vhs@latest   # or: brew install vhs
#   node scripts/make-demo-repo.mjs /tmp/demo-app    # build the fixture it scans
#   vhs assets/demo.tape                             # writes assets/demo.gif
#
# The fixture is a synthetic "vibe-coded" repo with planted findings for
# every detector (see scripts/make-demo-repo.mjs), so the recording shows a
# real scan with real findings, not a mockup.

Output assets/demo.gif

Set FontSize 15
Set FontFamily "JetBrains Mono"
Set Width 1000
Set Height 640
Set Theme "Catppuccin Mocha"
Set Padding 24
Set TypingSpeed 45ms

Hide
Type "cd /tmp/demo-app && clear"
Enter
Show

Sleep 800ms
Type "aidebt-scan ."
Sleep 500ms
Enter

# Semgrep dominates the wall time; give the whole scan room to finish.
Sleep 14s

# Hold on the final report card so the score is readable in the GIF loop.
Sleep 6s
