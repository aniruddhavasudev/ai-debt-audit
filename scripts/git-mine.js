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

// Known AI coding-tool commit signatures — the trailers (or, for Claude
// Code, the footer line) these tools actually stamp on commits made on a
// user's behalf. Not exhaustive: this is the starting, provisional list of
// tools this project has directly observed signing commits, not a claim of
// full market coverage. Add a new { tool, pattern } entry for any other
// tool's real signature as it's confirmed — PRs welcome.
const AI_AUTHORSHIP_SIGNATURES = [
  // Claude Code's default trailer is "Co-Authored-By: Claude <noreply@anthropic.com>"
  // (the display name varies by model — "Claude", "Claude Sonnet 5", "Claude
  // Opus", etc. — so this matches on the @anthropic.com email, not the name).
  { tool: "Claude Code", pattern: /co-authored-by:[^\n]*<[^>]*@anthropic\.com>/i },
  // Claude Code also appends this footer line to commits it generates.
  { tool: "Claude Code", pattern: /generated with \[claude code\]/i },
  // GitHub Copilot's coding-agent (workspace) commits.
  { tool: "GitHub Copilot", pattern: /co-authored-by:[^\n]*copilot[^\n]*<[^>]*>/i },
  // Cursor's background-agent commits.
  { tool: "Cursor", pattern: /co-authored-by:[^\n]*<[^>]*@cursor\.(sh|com|ai)>/i },
];

function detectAiTool(commitBody) {
  for (const { tool, pattern } of AI_AUTHORSHIP_SIGNATURES) {
    if (pattern.test(commitBody)) return tool;
  }
  return null;
}

function git(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 256,
  });
}

function mineCommitMessages(repoPath) {
  // \x1f separates fields within one commit's record; \x1e separates
  // records from each other. %B (the full raw body — subject, blank line,
  // body, and trailers) is needed rather than just %s (subject) because
  // AI tools stamp their Co-Authored-By trailer in the body, below the
  // subject line — %s alone would never see it.
  const raw = git(repoPath, ["log", "--no-merges", "--pretty=format:%h\x1f%an\x1f%B\x1e"]);
  // Git inserts its own newline after every formatted entry regardless of
  // the custom format string, which lands as a single leading "\n" on the
  // *next* record once split on \x1e — strip exactly that, not a full
  // trim (which could eat meaningful trailing whitespace in a body).
  const records = raw
    .split("\x1e")
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.length > 0);

  let refactorCommits = 0;
  let genericMessageCommits = 0;
  let aiAssistedCommits = 0;
  let aiAssistedGenericCommits = 0;
  const authorCounts = {};
  // Every commit actually flagged generic, not just the count -- a report
  // meant to be evidence should let a reader see *which* commits, not just
  // trust a percentage (same principle as not silently capping findings).
  const genericCommitList = [];
  const aiToolCounts = {};
  const aiAssistedCommitList = [];

  for (const record of records) {
    const firstSep = record.indexOf("\x1f");
    const secondSep = record.indexOf("\x1f", firstSep + 1);
    if (firstSep === -1 || secondSep === -1) continue;
    const hash = record.slice(0, firstSep);
    const author = record.slice(firstSep + 1, secondSep);
    const body = record.slice(secondSep + 1);
    const subject = body.split("\n")[0] || "";

    authorCounts[author] = (authorCounts[author] || 0) + 1;
    if (REFACTOR_RE.test(subject)) refactorCommits++;

    const isGeneric = GENERIC_MSG_RE.test(subject.trim()) || subject.trim().length < 6;
    if (isGeneric) {
      genericMessageCommits++;
      genericCommitList.push({ hash, author, subject });
    }

    const aiTool = detectAiTool(body);
    if (aiTool) {
      aiAssistedCommits++;
      aiToolCounts[aiTool] = (aiToolCounts[aiTool] || 0) + 1;
      aiAssistedCommitList.push({ hash, author, tool: aiTool, subject });
      // The compounding risk pattern this exists to catch: AI wrote it
      // *and* nobody explained why — not "AI was involved" on its own,
      // which a disclosed, well-labeled trailer is actually good evidence
      // against (see scripts/scoring.js's scoreIntentDebt for how this
      // is weighted).
      if (isGeneric) aiAssistedGenericCommits++;
    }
  }

  const totalCommits = records.length;
  return {
    totalCommits,
    refactorCommits,
    refactorRatio: totalCommits ? refactorCommits / totalCommits : 0,
    genericMessageCommits,
    genericMessageRatio: totalCommits ? genericMessageCommits / totalCommits : 0,
    authorCounts,
    genericCommitList,
    aiAssistedCommits,
    aiAssistedRatio: totalCommits ? aiAssistedCommits / totalCommits : 0,
    aiToolCounts,
    aiAssistedCommitList,
    aiAssistedGenericCommits,
    aiAssistedGenericRatio: totalCommits ? aiAssistedGenericCommits / totalCommits : 0,
  };
}

function mineBusFactor(repoPath) {
  // For each commit, list the author + the files it touched, so we can
  // build a map of file -> set(authors who have ever touched it).
  const raw = git(repoPath, [
    "log",
    "--no-merges",
    "--name-only",
    "--pretty=format:__COMMIT__\x1f%an",
  ]);

  const fileAuthors = new Map(); // filePath -> Set<author>
  let currentAuthor = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("__COMMIT__")) {
      currentAuthor = line.split("\x1f")[1];
      continue;
    }
    const file = line.trim();
    if (!file || !currentAuthor) continue;
    if (!fileAuthors.has(file)) fileAuthors.set(file, new Set());
    fileAuthors.get(file).add(currentAuthor);
  }

  let singleAuthorFiles = 0;
  // Every single-author file and who owns it, not just the count — this
  // is the actual actionable list ("here is what to pair on"), the ratio
  // alone is just a temperature reading.
  const riskyFiles = [];
  for (const [file, authors] of fileAuthors.entries()) {
    if (authors.size === 1) {
      singleAuthorFiles++;
      riskyFiles.push({ file, author: [...authors][0] });
    }
  }

  const totalFiles = fileAuthors.size;
  return {
    totalFilesTracked: totalFiles,
    singleAuthorFiles,
    // "bus factor risk" = fraction of the codebase only one person has
    // ever touched — the person most likely to be the only one who
    // understands why an AI-assisted change was made this way.
    busFactorRiskRatio: totalFiles ? singleAuthorFiles / totalFiles : 0,
    riskyFiles,
  };
}

// A commit is flagged as a "giant dump" if it touches at least this many
// files, OR churns at least this many total lines (added + deleted) —
// either condition alone is a real risk: a huge rename/refactor touching
// many files with modest per-file changes, or a handful of files each
// rewritten wholesale. Provisional v1 heuristic, same status as every
// other constant in this file — not derived from a large dataset yet.
const GIANT_DUMP_MIN_FILES = 15;
const GIANT_DUMP_MIN_LINES = 500;

function mineCommitChurn(repoPath) {
  // --numstat prints one "added\tdeleted\tfilename" line per file changed,
  // immediately after each commit's own formatted header line. Binary
  // files report "-\t-\tfilename" (no line counts), handled below by
  // treating a non-numeric added/deleted as 0 rather than NaN-poisoning
  // the running total.
  const raw = git(repoPath, [
    "log",
    "--no-merges",
    "--numstat",
    "--pretty=format:__COMMIT__\x1f%h\x1f%an\x1f%s",
  ]);

  const commits = [];
  let current = null;

  for (const line of raw.split("\n")) {
    if (line.startsWith("__COMMIT__")) {
      if (current) commits.push(current);
      const [, hash, author, subject] = line.split("\x1f");
      current = { hash, author, subject, filesChanged: 0, linesAdded: 0, linesDeleted: 0 };
      continue;
    }
    if (!line.trim() || !current) continue;
    const [addedRaw, deletedRaw] = line.split("\t");
    current.filesChanged++;
    const added = Number(addedRaw);
    const deleted = Number(deletedRaw);
    if (!Number.isNaN(added)) current.linesAdded += added;
    if (!Number.isNaN(deleted)) current.linesDeleted += deleted;
  }
  if (current) commits.push(current);

  let giantDumpCommits = 0;
  // Every giant-dump commit, not just the count — the actionable evidence
  // ("here is the commit that wasn't reviewed incrementally"), matching
  // every other list in this file.
  const giantDumpCommitList = [];
  for (const c of commits) {
    const totalChurn = c.linesAdded + c.linesDeleted;
    if (c.filesChanged >= GIANT_DUMP_MIN_FILES || totalChurn >= GIANT_DUMP_MIN_LINES) {
      giantDumpCommits++;
      giantDumpCommitList.push({
        hash: c.hash,
        author: c.author,
        subject: c.subject,
        filesChanged: c.filesChanged,
        linesAdded: c.linesAdded,
        linesDeleted: c.linesDeleted,
      });
    }
  }

  const totalCommits = commits.length;
  return {
    totalCommits,
    giantDumpCommits,
    giantDumpRatio: totalCommits ? giantDumpCommits / totalCommits : 0,
    giantDumpCommitList,
  };
}

// A shallow clone (git's own default for CI checkouts — GitHub Actions'
// actions/checkout defaults to fetch-depth: 1, a single commit) severely
// distorts every signal in this file: bus-factor undercounts historical
// authors per file, and commit-message/refactor-ratio stats only see
// whatever tiny window was fetched. Confirmed empirically during
// development — a shallow 50-commit clone of a mature, widely-contributed
// project scored cognitive debt at 86/100; the same repo with full history
// scored 37/100. Surface this so a caller can warn instead of silently
// trusting a distorted number.
function isShallowRepo(repoPath) {
  try {
    return git(repoPath, ["rev-parse", "--is-shallow-repository"]).trim() === "true";
  } catch {
    return false;
  }
}

function main() {
  const repoPath = path.resolve(process.argv[2] || ".");
  const commitStats = mineCommitMessages(repoPath);
  const busFactorStats = mineBusFactor(repoPath);
  const churnStats = mineCommitChurn(repoPath);
  const isShallowClone = isShallowRepo(repoPath);

  const result = {
    repoPath,
    commitStats,
    busFactorStats,
    churnStats,
    isShallowClone,
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main();
