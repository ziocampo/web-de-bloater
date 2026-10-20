/**
 * Package script - creates final distributables
 */

import { rmSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { join } from "path";
import { buildTarget } from "./build.js";
import { createZip } from "./zip.js";

const BUILD_DIR = "build";
const RELEASE_DIR = "release";

async function packageAll() {
  console.log("📦 Packaging release...");

  // Clean release dir
  if (existsSync(RELEASE_DIR)) rmSync(RELEASE_DIR, { recursive: true });
  mkdirSync(RELEASE_DIR, { recursive: true });

  // Build all targets
  for (const target of ["chrome", "firefox", "edge"]) {
    await buildTarget(target);
  }

  // Copy to release with versioned names
  const manifest = JSON.parse(await import("fs/promises").then(fs => fs.readFile("manifest.json", "utf-8")));
  const version = manifest.version;

  const targets = [
    { src: "build/chrome/web-de-bloater-chrome.zip", dest: `web-de-bloater-v${version}-chrome.zip` },
    { src: "build/edge/web-de-bloater-edge.zip", dest: `web-de-bloater-v${version}-edge.zip` },
    { src: "build/firefox/web-de-bloater-firefox.xpi", dest: `web-de-bloater-v${version}-firefox.xpi` }
  ];

  for (const { src, dest } of targets) {
    if (existsSync(src)) {
      copyFileSync(src, join(RELEASE_DIR, dest));
      console.log(`📋 Copied ${dest}`);
    }
  }

  // Create source zip
  await createZip(".", join(RELEASE_DIR, `web-de-bloater-v${version}-source.zip`));

  console.log(`\n✅ Release packaged in ${RELEASE_DIR}/`);
  console.log("Files:");
  for (const file of readdirSync(RELEASE_DIR)) {
    console.log(`  - ${file}`);
  }
}

packageAll().catch(console.error);