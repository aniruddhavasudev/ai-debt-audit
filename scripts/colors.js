// Minimal ANSI helper — deliberately no dependency (chalk/picocolors) for
// a two-script CLI; respects NO_COLOR and non-TTY output so piped/CI usage
// doesn't get raw escape codes dumped into logs.
const isEnabled = !process.env.NO_COLOR && process.stdout.isTTY;

const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  orange: "\x1b[38;5;208m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function wrap(code) {
  return (text) => (isEnabled ? `${code}${text}${codes.reset}` : String(text));
}

export const c = {
  bold: wrap(codes.bold),
  dim: wrap(codes.dim),
  red: wrap(codes.red),
  green: wrap(codes.green),
  yellow: wrap(codes.yellow),
  orange: wrap(codes.orange),
  cyan: wrap(codes.cyan),
  gray: wrap(codes.gray),
};

export function tierColor(tier, text) {
  const t = String(text ?? tier);
  switch (tier) {
    case "Low":
      return c.green(t);
    case "Medium":
      return c.yellow(t);
    case "High":
      return c.orange(t);
    case "Critical":
      return c.red(c.bold(t));
    default:
      return t;
  }
}

export function barChart(score, width = 24) {
  const filled = Math.round((score / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const color = score <= 25 ? c.green : score <= 50 ? c.yellow : score <= 75 ? c.orange : c.red;
  return color(bar);
}
