// Renders the HTML report to PDF via headless Chrome/Chromium — the actual
// client-deliverable format, not just an internal artifact.

import { execFileSync } from "node:child_process";
import { c } from "../scripts/colors.js";
import { binExists, fileExists } from "./fs-utils.js";

// Prefer chromium (lighter, common on CI images) but fall back to a full
// Chrome install — either one's headless print-to-pdf is the same engine
// that renders the HTML report, so the PDF is pixel-faithful to it.
const PDF_RENDERER_CANDIDATES = ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];

function findPdfRenderer() {
  return PDF_RENDERER_CANDIDATES.find(binExists) || null;
}

export function runPdfExport(htmlPath, pdfPath) {
  const renderer = findPdfRenderer();
  if (!renderer) {
    console.error(c.yellow("  no Chromium/Chrome found on PATH — skipping PDF export"));
    return null;
  }
  try {
    execFileSync(
      renderer,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--no-pdf-header-footer",
        `--print-to-pdf=${pdfPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: ["ignore", "ignore", "ignore"] }
    );
  } catch {
    // Headless Chrome's own harmless dbus/gpu warnings can make this exit
    // non-zero even on success — check for the actual output file instead.
  }
  return fileExists(pdfPath) ? pdfPath : null;
}
