// Minimal `--flag value` CLI arg parser shared by bin/aidebt-scan.js and
// scripts/score.js — previously duplicated near-identically in both files.
// Supports bare positional arguments (collected into `_`) as a superset of
// score.js's original parser, which never received positional args anyway.

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      // A bare flag followed by another flag (e.g. `--json --sarif x`) must
      // not swallow the next flag as its value — no flag in this CLI takes
      // a value that starts with "--". Previously `--out --html x` silently
      // made "--html" the output path and "x" the scan target.
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[argv[i].slice(2)] = next;
        i++;
      } else {
        args[argv[i].slice(2)] = undefined;
      }
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}
