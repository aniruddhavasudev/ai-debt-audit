#!/usr/bin/env node
/**
 * git-mine.js — behavioral signal extraction for the "cognitive debt" and
 * "intent debt" categories (see the Triple Debt Model: technical debt in
 * code, cognitive debt in people, intent debt in externalized rationale).
 *
 * Semgrep can only ever see the code as it is *right now*. It cannot tell
 * you whether the team understands it, whether one person is the only
 * one who's ever touched it, or whether commits explain *why* a change
 * was made. Those signals only exist in git history — so this script
 * mines `git log` directly instead of reaching for a heavier dependency.
 *
 * Usage: node git-mine.js <path-to-repo>
 * Output: JSON to stdout — feeds into scripts/score.js
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

const REFACTOR_RE = /\b(refactor|cleanup|clean up|simplify|restructure|reorgani[sz]e)\b/i;
const GENERIC_MSG_RE = /^(fix|update|updates|wip|changes|misc|stuff|minor|typo|test|tmp|temp|asdf|x+|\.+)$/i;

function git(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 256,
  });
}

function mineCommitMessages(repoPath) {
  // %x1f is a field separator that will never appear in a commit subject
  const raw = git(repoPath, ["log", "--no-merges", "--pretty=format:%an%x1f%s"]);
  const lines = raw.split("\n").filter(Boolean);

  let refactorCommits = 0;
  let genericMessageCommits = 0;
  const authorCounts = {};

  for (const line of lines) {
    const [author, subject] = line.split("");
    authorCounts[author] = (authorCounts[author] || 0) + 1;
    if (REFACTOR_RE.test(subject)) refactorCommits++;
    if (GENERIC_MSG_RE.test(subject.trim()) || subject.trim().length < 6) {
      genericMessageCommits++;
    }
  }

  return {
    totalCommits: lines.length,
    refactorCommits,
    refactorRatio: lines.length ? refactorCommits / lines.length : 0,
    genericMessageCommits,
    genericMessageRatio: lines.length ? genericMessageCommits / lines.length : 0,
    authorCounts,
  };
}

function mineBusFactor(repoPath) {
  // For each commit, list the author + the files it touched, so we can
  // build a map of file -> set(authors who have ever touched it).
  const raw = git(repoPath, [
    "log",
    "--no-merges",
    "--name-only",
    "--pretty=format:__COMMIT__%x1f%an",
  ]);

  const fileAuthors = new Map(); // filePath -> Set<author>
  let currentAuthor = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("__COMMIT__")) {
      currentAuthor = line.split("")[1];
      continue;
    }
    const file = line.trim();
    if (!file || !currentAuthor) continue;
    if (!fileAuthors.has(file)) fileAuthors.set(file, new Set());
    fileAuthors.get(file).add(currentAuthor);
  }

  let singleAuthorFiles = 0;
  for (const authors of fileAuthors.values()) {
    if (authors.size === 1) singleAuthorFiles++;
  }

  const totalFiles = fileAuthors.size;
  return {
    totalFilesTracked: totalFiles,
    singleAuthorFiles,
    // "bus factor risk" = fraction of the codebase only one person has
    // ever touched — the person most likely to be the only one who
    // understands why an AI-assisted change was made this way.
    busFactorRiskRatio: totalFiles ? singleAuthorFiles / totalFiles : 0,
  };
}

function main() {
  const repoPath = path.resolve(process.argv[2] || ".");
  const commitStats = mineCommitMessages(repoPath);
  const busFactorStats = mineBusFactor(repoPath);

  const result = {
    repoPath,
    commitStats,
    busFactorStats,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
