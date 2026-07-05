// Small filesystem/process-existence checks shared across bin/aidebt-scan.js
// and the lib/ modules it wires together — extracted so neither has to
// redefine them.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

export function binExists(bin) {
  try {
    execFileSync("which", [bin], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
