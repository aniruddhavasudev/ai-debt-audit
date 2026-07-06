# Releasing

Two independent publish steps — do them in either order, both from the repo root after merging to `main`.

## 1. Publish to npm (makes `npx ai-debt-audit` work)

One-time setup, then a single command per release.

```bash
npm login                 # one-time; needs an npmjs.org account
npm publish               # `prepublishOnly` runs the test suite first — publish aborts if it fails
```

`npm pack --dry-run` is a safe way to preview exactly what will be uploaded (it should list `bin/`, `lib/`, `scripts/`, `rules/`, `README.md`, `LICENSE` — nothing else). The package name `ai-debt-audit` is unclaimed on the npm registry as of this writing.

For every release after the first: bump `version` in `package.json` (and `.claude-plugin/plugin.json` to match), then `npm publish` again. `npm version patch|minor|major` does the bump and creates the matching git tag in one step if you prefer that over editing `package.json` by hand.

## 2. Publish to the GitHub Actions Marketplace

The action (`action.yml`) already works today via `uses: aniruddhavasudev/ai-debt-audit@main` — this step only adds the searchable Marketplace listing.

1. Push a version tag: `git tag v1 && git push origin v1` (Marketplace convention is a major-version tag like `v1` that you re-point at each compatible release, so `uses: .../ai-debt-audit@v1` keeps working without users bumping their workflow).
2. GitHub UI → **Releases** → **Draft a new release** → choose the `v1` tag.
3. Check **"Publish this Action to the GitHub Marketplace"**.
4. Fill in a Marketplace category (e.g. "Code quality") — `action.yml`'s `name`, `description`, and `branding` (icon: `search`, color: `orange`) are already set and will populate the listing.
5. Publish the release.

After this, update the README's Roadmap section to drop the "Marketplace packaging is next" line and link the listing instead.

## Pre-flight checklist (both)

- [ ] `npm test` passes (unit tests + zero-external-tools degradation test)
- [ ] `node scripts/test-rules.js` — 60/60 Semgrep rules fire against `test-fixtures/` (checked out from the `test-data` branch; not in `main`)
- [ ] `node scripts/test-config-integration.js` passes
- [ ] Version numbers match across `package.json` and `.claude-plugin/plugin.json`
- [ ] `npm pack --dry-run` output looks right (no `test-fixtures/`, no `node_modules/`, no local scan artifacts)
