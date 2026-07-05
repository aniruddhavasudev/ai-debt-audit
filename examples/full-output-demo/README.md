# Full output demo

This is a real, unedited scan of this repo itself (`aidebt-scan .`), showing every output format the tool can produce from one command:

```bash
aidebt-scan . --out report.md --html report.html --pdf report.pdf --csv csv-workbook --json scores.json
```

- **`report.md`** — the default Markdown report
- **`report.html`** — a styled standalone HTML version
- **`report.pdf`** — the same report rendered to PDF via headless Chrome, for handing off as a deliverable
- **`csv-workbook/`** — plain-language CSV files: `summary.csv` (one row per debt category), `technical-debt.csv`, `knowledge-risk.csv`, `missing-context.csv`
- **`scores.json`** — the raw composite/category scores, for tracking over time

See [`docs/USAGE.md`](../../docs/USAGE.md) for the full flag reference.
