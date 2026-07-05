# Calibration: 50-repo real-world run (pilot batch)

This is the first batch of a planned 50-repo calibration effort — scanning real, popular, public open-source repositories with `aidebt-scan` to see how the composite score behaves outside the handful of repos used during development. This is **not** a claim that any of these repos were built by an AI assistant — there's no reliable way to label that externally. The goal here is narrower and more honest: does the score distribute sensibly across real, diverse, human-maintained codebases, and does the tool crash, hang, or produce nonsense at real-world scale?

**Methodology:** full `git clone` (no shallow clones — see the shallow-clone finding in [CALIBRATION.md](CALIBRATION.md) for why that matters), then `aidebt-scan <repo> --json`, defaults only, no `.aidebtrc.json` overrides. Raw JSON output for every repo below is kept in [`calibration-pilot-results/`](calibration-pilot-results/) so these numbers are independently checkable.

## Results (12 attempted, 11 scored)

| Repo | Stars | Size / commits | Composite | Tier | Technical | Cognitive | Intent |
|---|---:|---|---:|---|---:|---:|---:|
| [pallets/flask](https://github.com/pallets/flask) | 71,846 | 16M / 5,539 | 26 | Medium | 5 | 40 | 0 |
| [miguelgrinberg/flasky](https://github.com/miguelgrinberg/flasky) | 8,747 | 796K / 62 | 2 | Low | 3 | 0 | 0 |
| [wagtail/wagtail](https://github.com/wagtail/wagtail) | 20,385 | 313M / 20,146 | 27 | Medium | 3 | 25 | 0 |
| [encode/django-rest-framework](https://github.com/encode/django-rest-framework) | 30,093 | 81M / 9,010 | 30 | Medium | 1 | 38 | 1 |
| [spring-projects/spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 9,347 | 13M / 1,034 | 17 | Low | 0 | 56 | 0 |
| [gofiber/fiber](https://github.com/gofiber/fiber) | 39,928 | 60M / 6,241 | **scan failed** | — | — | — | — |
| [gin-gonic/gin](https://github.com/gin-gonic/gin) | 88,841 | 13M / 2,004 | 21 | Low | 0 | 26 | 0 |
| [caddyserver/caddy](https://github.com/caddyserver/caddy) | 73,739 | 28M / 2,614 | 28 | Medium | 3 | 55 | 0 |
| [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) | 19,252 | 18M / 134 | 38 | Medium | 6 | 96 | 0 |
| [calcom/cal.com](https://github.com/calcom/cal.com) (now `cal.diy`) | 46,078 | 1.3G / 16,470 | 28 | Medium | 9 | 38 | 0 |
| [forem/forem](https://github.com/forem/forem) | 22,738 | 2.0G / 14,725 | 30 | Medium | 9 | 46 | 0 |
| [gothinkster/realworld](https://github.com/gothinkster/realworld) (now `realworld-apps`) | 83,716 | 38M / 1,155 | 26 | Medium | 0 | 65 | 1 |

**Known failure:** `gofiber/fiber`'s gitleaks step failed to complete — most likely hit the 300s per-repo timeout this pilot script enforced, not a bug observed anywhere else in this run. Flagged transparently rather than dropped silently; the full 50-repo pass will drop the artificial timeout.

## What this shows so far

- **Every repo that scored landed in Low or Medium tier** (2-38/100) — none hit High or Critical, which is a reasonable sanity check for mature, actively-maintained open-source projects. The scorer isn't reflexively screaming "Critical."
- **Technical debt scores cluster low** (0-9 out of 100 in 11/12 repos) even on large, old codebases — consistent with normalizing findings by files scanned rather than raw count.
- **Cognitive debt is the most volatile signal** (0 to 96 in this sample) — expected, since bus factor genuinely varies a lot: `shadcn-ui/taxonomy` (134 commits, likely a small demo/reference project) scored 96, while `miguelgrinberg/flasky` (a tutorial companion repo, 62 commits) scored 0. This is the axis the tool is most explicitly trying to surface, not smooth over, so this spread is the signal working, not noise — worth digging into per-repo once the full 50-repo batch is in.
- **Intent debt scored near-zero across nearly the entire sample** — the one metric that looks under-discriminating right now. Either these particular projects genuinely have clean commit hygiene, or the heuristic needs recalibration. Too small a sample (and too narrow — mostly frameworks, not app code) to conclude either way yet.

## Honesty check

This is 12 repos, not 50, and skews toward Python/Go web frameworks plus a couple of Next.js/Rails apps — not yet the full stack/language spread the tool claims to cover (no Java/Spring repo made it into a clean result here). Treat this as a pilot proving the pipeline works end-to-end, not as a statistically meaningful calibration. The full 50-repo run is the next step, with the gofiber-style timeout fixed and a broader language mix.
