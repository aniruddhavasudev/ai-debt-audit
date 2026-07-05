// Loads and applies .aidebtrc.json — the per-target-repo config that can
// override category weights, ignore specific rule IDs, and exclude paths
// from scoring entirely. Deliberately separate from scoring.js: this is
// config *loading*, not scoring math.

import fs from "node:fs";
import path from "node:path";

const WEIGHTS = {
  technical: 0.5,
  cognitive: 0.25,
  intent: 0.25,
};

const CONFIG_FILENAME = ".aidebtrc.json";

// Deliberately no dependency (minimatch etc.) for one small glob need —
// converts simple patterns like "vendor/**" or "*.generated.js" into a
// RegExp. Not a full glob implementation, just enough for exclude lists.
export function globToRegExp(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, " ")
    .replace(/\*/g, "[^/]*")
    .replace(/ /g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function loadConfig(repoRoot) {
  const configPath = path.join(repoRoot, CONFIG_FILENAME);
  const defaults = { weights: { ...WEIGHTS }, ignoreRules: [], excludePaths: [] };
  if (!fs.existsSync(configPath)) return defaults;

  try {
    const userConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      weights: { ...defaults.weights, ...(userConfig.weights || {}) },
      ignoreRules: userConfig.ignoreRules || [],
      excludePaths: (userConfig.excludePaths || []).map(globToRegExp),
    };
  } catch (err) {
    console.error(`Warning: failed to parse ${CONFIG_FILENAME} (${err.message}) — using defaults.`);
    return defaults;
  }
}

export function applyConfigFilters(results, config, { ruleIdKey, pathKey }) {
  if (!results) return results;
  const filtered = (results.results || []).filter((r) => {
    const ruleId = ruleIdKey(r);
    if (config.ignoreRules.includes(ruleId)) return false;
    const filePath = pathKey(r);
    if (filePath && config.excludePaths.some((re) => re.test(filePath))) return false;
    return true;
  });
  return { ...results, results: filtered };
}
