// Small filesystem/process-existence checks shared across bin/aidebt-scan.js
// and the lib/ modules it wires together — extracted so neither has to
// redefine them.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function binExists(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Writing a report to `deep/nested/report.md` used to crash with a raw
// ENOENT if the directory didn't exist yet — create parents on demand so
// every output flag accepts a not-yet-existing path.
export function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
