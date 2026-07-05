#!/usr/bin/env node
// Builds the synthetic "vibe-coded" demo repo the README sample output and
// assets/demo.tape recording are based on — planted findings for every
// detector, with git history shaped to trip the history-based signals too.
// All credentials are AWS's own documentation example keys, not real.
//
// Usage: node scripts/make-demo-repo.mjs [/tmp/demo-app]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] || "/tmp/demo-app");
if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const AUTHORS = {
  alice: { name: "Alice Dev", email: "alice@example.com" },
  bob: { name: "Bob Dev", email: "bob@example.com" },
  carol: { name: "Carol Dev", email: "carol@example.com" },
};

function git(args, author, dateIso) {
  const env = { ...process.env };
  if (author) {
    env.GIT_AUTHOR_NAME = author.name;
    env.GIT_AUTHOR_EMAIL = author.email;
    env.GIT_COMMITTER_NAME = author.name;
    env.GIT_COMMITTER_EMAIL = author.email;
  }
  if (dateIso) {
    env.GIT_AUTHOR_DATE = dateIso;
    env.GIT_COMMITTER_DATE = dateIso;
  }
  execFileSync("git", ["-C", target, ...args], { env, stdio: "ignore" });
}

function write(rel, content) {
  const full = path.join(target, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commit(message, author, dateIso) {
  git(["add", "-A"], author);
  git(["commit", "-q", "--no-verify", "-m", message], author, dateIso);
}

git(["init", "-q", "-b", "main"]);

// 1. Secret committed, then deleted — only visible to full-history scanning.
write("config.py", 'AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCyEXAMPLEKEY"  # example key, not real\n');
commit("add initial config", AUTHORS.alice, "2024-01-10T10:00:00Z");
fs.rmSync(path.join(target, "config.py"));

// 2. AI-pattern smells for Semgrep + Bandit.
write(
  "smelly.js",
  'export function risky(input) {\n  try {\n    JSON.parse(input);\n  } catch (e) {}\n  console.log("debug: got here");\n  return eval(input);\n}\n'
);
write(
  "smelly.py",
  "import pickle\nimport subprocess\n\n\ndef run(cmd, payload):\n    subprocess.call(cmd, shell=True)\n    return pickle.loads(payload)\n"
);
commit("feat: add input processing", AUTHORS.bob, "2024-03-01T10:00:00Z");

// 3. Duplication mass for jscpd.
const dup = Array.from({ length: 30 }, (_, i) =>
  `export function process${i}(row) {\n  const value = row.field${i} * 2 + 1;\n  if (value > 10) { return { ok: true, value }; }\n  return { ok: false, value };\n}`
).join("\n");
write("dupA.js", dup + "\n");
write("dupB.js", dup + "\n");
commit("fix", AUTHORS.carol, "2024-04-01T10:00:00Z"); // generic message

// 4. AI-assisted AND generic — the compounding intent-debt case.
write("notes.md", "# notes\n");
git(["add", "-A"], AUTHORS.carol);
git(
  ["commit", "-q", "--no-verify", "-m", "update\n\nCo-Authored-By: Claude <noreply@anthropic.com>"],
  AUTHORS.carol,
  "2024-05-01T10:00:00Z"
);

// 5. Giant-dump commit: 16 files in one shot.
for (let i = 0; i < 16; i++) write(`bulk/mod${i}.js`, `export const mod${i} = ${i};\n`);
commit("wip", AUTHORS.alice, "2024-06-01T10:00:00Z"); // generic message

console.log(`Demo repo ready: ${target}`);
console.log(`Scan it: aidebt-scan ${target}`);
