// Appends this run's score to a small local JSON history file so a repo can
// be tracked over time — "is this getting better or worse" is a genuinely
// different question than "what's the score right now," and one-shot
// competitors (the manual audit agencies) can't answer it at all since they
// don't run continuously against the same repo.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { c } from "../scripts/colors.js";
import { fileExists } from "./fs-utils.js";

function getGitCommitSha(targetPath) {
  try {
    return execFileSync("git", ["-C", targetPath, "rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

export function recordHistory(historyPath, targetPath, scores) {
  let history = [];
  if (fileExists(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
      if (!Array.isArray(history)) history = [];
    } catch {
      console.error(c.yellow(`  Warning: ${historyPath} exists but isn't valid JSON — starting a new history.`));
      history = [];
    }
  }

  history.push({
    timestamp: new Date().toISOString(),
    commit: getGitCommitSha(targetPath),
    composite: scores.composite,
    tier: scores.tier,
    technical: scores.technical.blendedScore,
    cognitive: scores.cognitive.score,
    intent: scores.intent.score,
  });

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  return history;
}
