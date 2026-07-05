# Language support samples

One small, clean file per language `aidebt-scan` supports — Python, Ruby, Go, and Java (JavaScript/TypeScript is already the bulk of this repo's own source).

These exist only so GitHub's language detection reflects the tool's real coverage. They're intentionally boring: no vulnerabilities, no fake secrets, nothing for the scanner to flag. For files that *do* exercise every detection rule (deliberately insecure, used in CI regression tests), see `test-fixtures/` on the [`test-data`](https://github.com/aniruddhavasudev/ai-debt-audit/tree/test-data) branch.
