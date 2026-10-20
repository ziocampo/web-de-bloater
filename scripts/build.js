/**
 * Build Script for WebDeBloater
 * Builds the extension for Chrome, Firefox, and Edge
 */

import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const TARGETS = ["chrome", "firefox", "edge"];
const SOURCE_DIR = ".";
const DIST_DIR = "dist";
const BUILD_DIR = "build";

async function buildTarget(target) {
  console.log(`\n🔨 Building for ${target}...`);

  const targetDistDir = join(DIST_DIR, target);
  const targetBuildDir = join(BUILD_DIR, target);

  // Clean previous builds
  if (existsSync(targetDistDir)) rmSync(targetDistDir, { recursive: true });
  if (existsSync(targetBuildDir)) rmSync(targetBuildDir, { recursive: true });

  mkdirSync(targetDistDir, { recursive: true });
  mkdirSync(targetBuildDir, { recursive: true });

  // Copy static files
  copyStaticFiles(targetDistDir, target);

  // Build JavaScript bundles
  await buildJavaScript(targetDistDir, target);

  // Create manifest for target
  createManifest(targetDistDir, target);

  // Package
  await packageExtension(targetDistDir, targetBuildDir, target);

  console.log(`✅ ${target} build complete: ${targetBuildDir}`);
}

function copyStaticFiles(destDir, target) {
  const staticFiles = [
    "popup/popup.html",
    "popup/popup.js",
    "options/options.html",
    "options/options.js",
    "content/content-script.js",
    "content/selectors.json",
    "rules/dnr-rules.json",
    "styles/popup.css",
    "styles/options.css",
    "utils/browser-polyfill.js",
    "utils/storage.js",
    "background/background.js"
  ];

  const localeDirs = ["_locales/it", "_locales/en"];

  for (const file of staticFiles) {
    const src = join(SOURCE_DIR, file);
    const dest = join(destDir, file);
    mkdirSync(join(destDir, join(file, "..")), { recursive: true });
    copyFileSync(src, dest);
  }

  for (const localeDir of localeDirs) {
    const srcDir = join(SOURCE_DIR, localeDir);
    const destDir2 = join(destDir, localeDir);
    copyDirSync(srcDir, destDir2);
  }

  // Copy icons
  const iconsSrc = join(SOURCE_DIR, "icons");
  const iconsDest = join(destDir, "icons");
  if (existsSync(iconsSrc)) {
    copyDirSync(iconsSrc, iconsDest);
  } else {
    console.warn("⚠️  Icons directory not found, using placeholders");
    generatePlaceholderIcons(iconsDest);
  }

  // Firefox-specific: copy manifest with browser_specific_settings
  if (target === "firefox") {
    // Already handled in createManifest
  }
}

function copyDirSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

async function buildJavaScript(destDir, target) {
  // Build background script
  await build({
    entryPoints: ["background/background.js"],
    bundle: true,
    platform: "node",
    target: "es2020",
    format: "esm",
    outfile: join(destDir, "background/background.js"),
    external: ["chrome", "browser"],
    define: {
      "process.env.NODE_ENV": '"production"'
    }
  });

  // Build content script
  await build({
    entryPoints: ["content/content-script.js"],
    bundle: true,
    platform: "node",
    target: "es2020",
    format: "esm",
    outfile: join(destDir, "content/content-script.js"),
    external: ["chrome", "browser"]
  });

  // Build popup script
  await build({
    entryPoints: ["popup/popup.js"],
    bundle: true,
    platform: "node",
    target: "es2020",
    format: "esm",
    outfile: join(destDir, "popup/popup.js"),
    external: ["chrome", "browser"]
  });

  // Build options script
  await build({
    entryPoints: ["options/options.js"],
    bundle: true,
    platform: "node",
    target: "es2020",
    format: "esm",
    outfile: join(destDir, "options/options.js"),
    external: ["chrome", "browser"]
  });
}

function createManifest(destDir, target) {
  const manifest = JSON.parse(readFileSync(join(SOURCE_DIR, "manifest.json"), "utf-8"));

  // Target-specific adjustments
  if (target === "firefox") {
    // Firefox needs explicit browser_specific_settings
    manifest.browser_specific_settings = {
      gecko: {
        id: "web-de-bloater@daniele.example",
        strict_min_version: "109.0"
      }
    };
    // Firefox uses browser.* not chrome.*
    // Our polyfill handles this
  } else if (target === "edge") {
    // Edge is Chromium-based, same as Chrome
    // Remove gecko settings
    delete manifest.browser_specific_settings;
  } else {
    // Chrome
    delete manifest.browser_specific_settings;
  }

  writeFileSync(join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function packageExtension(sourceDir, buildDir, target) {
  // Create ZIP for Chrome/Edge
  if (target === "chrome" || target === "edge") {
    const { createZip } = await import("./zip.js");
    await createZip(sourceDir, join(buildDir, `web-de-bloater-${target}.zip`));
  }

  // Create XPI for Firefox
  if (target === "firefox") {
    const { createXpi } = await import("./xpi.js");
    await createXpi(sourceDir, join(buildDir, `web-de-bloater-firefox.xpi`));
  }
}

function generatePlaceholderIcons(destDir) {
  mkdirSync(destDir, { recursive: true });
  // Generate simple SVG icons and convert to PNG would require sharp/canvas
  // For now, create placeholder SVGs
  const sizes = [16, 32, 48, 128];
  const svgTemplate = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#3b82f6"/>
  <path d="M8 8L16 16M16 8L8 16" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

  for (const size of sizes) {
    writeFileSync(join(destDir, `icon-${size}.svg`), svgTemplate(size));
  }
  console.log("📝 Created placeholder SVG icons (replace with PNG for production)");
}

// CLI
const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : null;

if (target && !TARGETS.includes(target)) {
  console.error(`❌ Unknown target: ${target}. Valid: ${TARGETS.join(", ")}`);
  process.exit(1);
}

const targetsToBuild = target ? [target] : TARGETS;

async function main() {
  console.log("🚀 WebDeBloater Build System");
  console.log("=============================");

  for (const t of targetsToBuild) {
    try {
      await buildTarget(t);
    } catch (error) {
      console.error(`❌ Build failed for ${t}:`, error);
      process.exit(1);
    }
  }

  console.log("\n🎉 All builds completed successfully!");
  console.log(`📦 Output: ${BUILD_DIR}/`);
}

main();

// Node.js fs/promises helpers
import { readFileSync, writeFileSync } from "fs";