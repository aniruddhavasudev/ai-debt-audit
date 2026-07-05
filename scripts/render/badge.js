// shields.io "endpoint badge" schema — any static JSON file at a URL can
// back a live badge via https://img.shields.io/endpoint?url=<raw-json-url>.
// This is what lets a repo embed its own AI-Debt score as a real README
// badge (like a CI-status badge), not just something you read once in a
// generated report — the badge only updates when the JSON is regenerated
// and committed, e.g. from a scheduled CI job.

const TIER_BADGE_COLOR = { Low: "brightgreen", Medium: "yellow", High: "orange", Critical: "red" };

export function renderShieldsBadge(composite, tier) {
  return {
    schemaVersion: 1,
    label: "ai-debt score",
    message: `${composite}/100 (${tier.toLowerCase()})`,
    color: TIER_BADGE_COLOR[tier],
  };
}
