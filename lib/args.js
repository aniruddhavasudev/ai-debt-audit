// Minimal `--flag value` CLI arg parser shared by bin/aidebt-scan.js and
// scripts/score.js — previously duplicated near-identically in both files.
// Supports bare positional arguments (collected into `_`) as a superset of
// score.js's original parser, which never received positional args anyway.

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else {
      args._.push(argv[i]);
    }
  }
  return args;
}
