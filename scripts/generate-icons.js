/**
 * Generate placeholder PNG icons from SVG
 * Requires: npm install sharp
 * Run: node scripts/generate-icons.js
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ICONS_DIR = join("icons");
const SIZES = [16, 32, 48, 128];

// Simple SVG icon
function generateSVG(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#3b82f6"/>
  <path d="M8 8L16 16M16 8L8 16" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
}

async function generateIcons() {
  if (!existsSync(ICONS_DIR)) {
    mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log("🎨 Generating placeholder icons...");

  // Generate SVGs
  for (const size of SIZES) {
    const svgPath = join(ICONS_DIR, `icon-${size}.svg`);
    writeFileSync(svgPath, generateSVG(size));
    console.log(`  ✅ icon-${size}.svg`);
  }

  console.log("\n📝 Note: For production, convert SVGs to PNG using:");
  console.log("  npx sharp-cli -i icons/icon-*.svg -o icons/icon-{width}.png");
  console.log("  Or use an online converter / ImageMagick:");
  console.log("  for f in icons/icon-*.svg; do convert -background none \"$f\" \"${f%.svg}.png\"; done");
}

generateIcons().catch(console.error);