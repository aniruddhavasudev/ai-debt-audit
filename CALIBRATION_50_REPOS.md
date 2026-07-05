# Calibration: 50-repo real-world run

The full 50-repo calibration run — scanning real, popular, public open-source repositories with `aidebt-scan` to see how the composite score behaves outside the handful of repos used during development. This is **not** a claim that any of these repos were built by an AI assistant — there's no reliable way to label that externally. The goal is narrower and more honest: does the score distribute sensibly across real, diverse, human-maintained codebases, and does the tool crash, hang, or produce nonsense at real-world scale? (The earlier 12-repo pilot batch that this supersedes lives in the git history of this file.)

**Methodology:** full `git clone` (never shallow — a shallow clone silently distorts cognitive/intent scores: the same repo measured 86/100 shallow vs 37/100 with full history), then `aidebt-scan <repo> --json`, defaults only, no `.aidebtrc.json` overrides, 3 scans in parallel, a 30-minute-per-repo safety cap replacing the pilot's 300s timeout. Scanner at commit `dc4d131` (v1.12.0 feature set). 50 repos across Python, Go, Java, Ruby, and JS/TS — 13/10/7/7/13.

## Results (50 attempted, 50 scored — zero failures)

| Repo | Composite | Tier | Technical | Cognitive | Intent | Semgrep findings | Historical secrets | Authors | AI-assisted commits | Commits | Scan time |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| [pallets/flask](https://github.com/pallets/flask) | 26 | Medium | 31 | 41 | 0 | 23 | 12 | 853 | 0 | 5539 | 8s |
| [miguelgrinberg/flasky](https://github.com/miguelgrinberg/flasky) | 2 | Low | 4 | 0 | 0 | 2 | 0 | 1 | 0 | 62 | 12s |
| [wagtail/wagtail](https://github.com/wagtail/wagtail) | 27 | Medium | 41 | 26 | 0 | 203 | 11 | 1072 | 2 | 20146 | 88s |
| [encode/django-rest-framework](https://github.com/encode/django-rest-framework) | 30 | Medium | 41 | 38 | 1 | 16 | 6 | 1436 | 2 | 9010 | 49s |
| [pallets/click](https://github.com/pallets/click) | 14 | Low | 14 | 27 | 0 | 17 | 0 | 458 | 0 | 3264 | 10s |
| [pallets/jinja](https://github.com/pallets/jinja) | 21 | Low | 10 | 64 | 0 | 27 | 0 | 334 | 0 | 2949 | 15s |
| [psf/requests](https://github.com/psf/requests) | 25 | Low | 29 | 39 | 3 | 4 | 10 | 780 | 1 | 6481 | 8s |
| [encode/httpx](https://github.com/encode/httpx) | 18 | Low | 17 | 37 | 0 | 8 | 0 | 244 | 0 | 1523 | 13s |
| [tiangolo/fastapi](https://github.com/tiangolo/fastapi) | 35 | Medium | 43 | 52 | 0 | 20 | 24 | 901 | 2 | 7467 | 27s |
| [benoitc/gunicorn](https://github.com/benoitc/gunicorn) | 38 | Medium | 45 | 59 | 2 | 167 | 5 | 444 | 0 | 3617 | 19s |
| [celery/celery](https://github.com/celery/celery) | 38 | Medium | 45 | 62 | 0 | 401 | 11 | 1455 | 8 | 13115 | 31s |
| [pallets/werkzeug](https://github.com/pallets/werkzeug) | 17 | Low | 12 | 45 | 0 | 55 | 0 | 514 | 0 | 5926 | 13s |
| [sqlalchemy/alembic](https://github.com/sqlalchemy/alembic) | 18 | Low | 11 | 48 | 2 | 19 | 0 | 227 | 0 | 2056 | 10s |
| [gin-gonic/gin](https://github.com/gin-gonic/gin) | 21 | Low | 28 | 27 | 0 | 2 | 5 | 538 | 12 | 2004 | 6s |
| [caddyserver/caddy](https://github.com/caddyserver/caddy) | 29 | Medium | 29 | 56 | 0 | 29 | 14 | 413 | 3 | 2614 | 16s |
| [gofiber/fiber](https://github.com/gofiber/fiber) | 21 | Low | 22 | 36 | 3 | 6 | 2 | 478 | 196 | 6241 | 573s |
| [labstack/echo](https://github.com/labstack/echo) | 39 | Medium | 32 | 91 | 0 | 4 | 27 | 320 | 20 | 1891 | 11s |
| [go-chi/chi](https://github.com/go-chi/chi) | 19 | Low | 19 | 39 | 0 | 17 | 2 | 173 | 2 | 810 | 5s |
| [spf13/cobra](https://github.com/spf13/cobra) | 8 | Low | 5 | 20 | 0 | 0 | 0 | 336 | 2 | 1105 | 4s |
| [spf13/viper](https://github.com/spf13/viper) | 13 | Low | 6 | 40 | 0 | 1 | 0 | 197 | 0 | 902 | 4s |
| [gorilla/mux](https://github.com/gorilla/mux) | 10 | Low | 4 | 31 | 1 | 0 | 0 | 120 | 0 | 329 | 5s |
| [urfave/cli](https://github.com/urfave/cli) | 20 | Low | 20 | 39 | 1 | 0 | 1 | 359 | 8 | 3844 | 7s |
| [julienschmidt/httprouter](https://github.com/julienschmidt/httprouter) | 14 | Low | 4 | 47 | 1 | 2 | 0 | 53 | 0 | 294 | 4s |
| [spring-projects/spring-petclinic](https://github.com/spring-projects/spring-petclinic) | 17 | Low | 5 | 58 | 0 | 3 | 0 | 145 | 1 | 1034 | 6s |
| [junit-team/junit4](https://github.com/junit-team/junit4) | 15 | Low | 6 | 46 | 0 | 1 | 0 | 200 | 0 | 2520 | 19s |
| [google/gson](https://github.com/google/gson) | 17 | Low | 12 | 43 | 0 | 0 | 0 | 182 | 0 | 2201 | 13s |
| [mockito/mockito](https://github.com/mockito/mockito) | 34 | Medium | 35 | 67 | 0 | 2 | 9 | 360 | 0 | 6347 | 24s |
| [dropwizard/dropwizard](https://github.com/dropwizard/dropwizard) | 31 | Medium | 35 | 54 | 0 | 3 | 12 | 504 | 2 | 9121 | 145s |
| [perwendel/spark](https://github.com/perwendel/spark) | 23 | Low | 18 | 56 | 1 | 1 | 0 | 162 | 0 | 1067 | 8s |
| [javalin/javalin](https://github.com/javalin/javalin) | 28 | Medium | 32 | 47 | 0 | 0 | 7 | 215 | 6 | 2525 | 7s |
| [sinatra/sinatra](https://github.com/sinatra/sinatra) | 25 | Low | 25 | 49 | 1 | 0 | 9 | 524 | 0 | 4672 | 8s |
| [jekyll/jekyll](https://github.com/jekyll/jekyll) | 23 | Low | 26 | 40 | 0 | 6 | 212 | 1239 | 0 | 11873 | 13s |
| [heartcombo/devise](https://github.com/heartcombo/devise) | 19 | Low | 25 | 27 | 0 | 1 | 303 | 714 | 0 | 3973 | 6s |
| [sidekiq/sidekiq](https://github.com/sidekiq/sidekiq) | 25 | Low | 25 | 43 | 7 | 6 | 9 | 727 | 0 | 5390 | 7s |
| [rack/rack](https://github.com/rack/rack) | 11 | Low | 2 | 41 | 0 | 0 | 0 | 576 | 0 | 3434 | 6s |
| [puma/puma](https://github.com/puma/puma) | 26 | Medium | 25 | 52 | 2 | 1 | 13 | 543 | 4 | 4380 | 8s |
| [kaminari/kaminari](https://github.com/kaminari/kaminari) | 15 | Low | 1 | 58 | 1 | 1 | 0 | 182 | 0 | 1714 | 5s |
| [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) | 39 | Medium | 28 | 100 | 0 | 24 | 13 | 10 | 0 | 134 | 6s |
| [gothinkster/realworld](https://github.com/gothinkster/realworld) | 27 | Medium | 19 | 68 | 1 | 4 | 2 | 94 | 0 | 1155 | 14s |
| [expressjs/express](https://github.com/expressjs/express) | 17 | Low | 12 | 37 | 5 | 37 | 0 | 387 | 1 | 6153 | 7s |
| [koajs/koa](https://github.com/koajs/koa) | 12 | Low | 15 | 11 | 7 | 10 | 0 | 260 | 5 | 1304 | 6s |
| [fastify/fastify](https://github.com/fastify/fastify) | 15 | Low | 22 | 15 | 0 | 41 | 1 | 896 | 8 | 4775 | 7s |
| [axios/axios](https://github.com/axios/axios) | 29 | Medium | 35 | 47 | 0 | 26 | 5 | 649 | 15 | 2125 | 17s |
| [iamkun/dayjs](https://github.com/iamkun/dayjs) | 21 | Low | 26 | 30 | 0 | 0 | 0 | 358 | 1 | 1646 | 39s |
| [colinhacks/zod](https://github.com/colinhacks/zod) | 43 | Medium | 48 | 70 | 5 | 666 | 29 | 539 | 9 | 2927 | 13s |
| [tj/commander.js](https://github.com/tj/commander.js) | 22 | Low | 11 | 63 | 3 | 79 | 0 | 203 | 0 | 1517 | 6s |
| [sindresorhus/got](https://github.com/sindresorhus/got) | 23 | Low | 32 | 24 | 5 | 35 | 3 | 205 | 0 | 1661 | 5s |
| [chalk/chalk](https://github.com/chalk/chalk) | 12 | Low | 1 | 34 | 11 | 2 | 0 | 70 | 0 | 369 | 4s |
| [lodash/lodash](https://github.com/lodash/lodash) | 20 | Low | 34 | 13 | 0 | 8 | 1 | 269 | 0 | 7708 | 45s |
| [honojs/hono](https://github.com/honojs/hono) | 39 | Medium | 53 | 50 | 1 | 490 | 61 | 336 | 11 | 2682 | 13s |

## Distribution

- **Composite range 2–43, mean 22.6, median 21** — tiers: 33 Low, 17 Medium, zero High or Critical. The scorer distributes sensibly across mature open-source projects and never reflexively screams Critical.
- **Reproducibility:** every repo that overlapped with the pilot batch reproduced within ±1 point (flask 26=26, flasky 2=2, DRF 30=30, wagtail 27=27, gin 21=21; the +1s come from the giant-dump signal added between the two runs).
- **The pilot's one failure is resolved:** `gofiber/fiber` scanned cleanly in 9.5 minutes (composite 21) — the pilot's 300s timeout was the killer, exactly as hypothesized, not a scanner bug. gitleaks is simply slow on that repo's history.
- **Intent debt now discriminates** (it was near-zero across the whole pilot): 21/50 repos score above 0, up to 11 (`chalk`). Still the narrowest signal, but no longer flat.
- **AI-assisted commits detected in 23/50 repos** — measured from real Co-Authored-By trailers, not inferred. `gofiber/fiber` leads with 196; `labstack/echo` 20, `axios` 15, `gin` 12. Real-world validation that trailer detection fires on genuine data.

## What the run changed in the tool

- **Dependency scanning was silently dead on almost every repo** — `dependencyVulns` came back null across the batch, because most JS libraries never commit `package-lock.json` and modern Python projects use `pyproject.toml`, not `requirements.txt`. Fixed in v1.13.0: a lockfile is now derived from `package.json` in a temp directory with `--package-lock-only --ignore-scripts` (nothing installed, no target scripts executed). The Python side remains a documented limitation — resolving `pyproject.toml` deps would require building the project, which executes target code. **These numbers predate that fix**, so a re-run on v1.13.0 will shift some technical scores upward on JS repos.

## Honesty check

- **The historical-secrets signal is noisy on open-source repos.** 29/50 repos have gitleaks hits — `devise` 303, `jekyll` 212, `hono` 61 — and in OSS these are overwhelmingly test fixtures and example keys, not live credentials. The 25-points-per-leak formula caps quickly, so it inflates rather than dominates, but treat the secrets column as "needs human review," not "confirmed breaches." For a private codebase audit this signal is far more meaningful than it is here.
- The sample skews toward frameworks and libraries, not application code — app repos (the tool's actual target audience) likely score differently, especially on intent debt.
- Every constant in the scoring is still a v1 heuristic; this run demonstrates the score is stable, bounded, and sane on real code — not that the weights are correct.
