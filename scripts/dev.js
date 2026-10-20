/**
 * Development script - watches for changes and rebuilds
 */

import { build } from "esbuild";
import { watch } from "fs";
import { join } from "path";

const SOURCE_DIR = ".";
const DIST_DIR = "dist/chrome"; // Default dev target

async function devBuild() {
  console.log("🔄 Rebuilding...");

  try {
    await Promise.all([
      build({
        entryPoints: ["background/background.js"],
        bundle: true,
        platform: "node",
        target: "es2020",
        format: "esm",
        outfile: join(DIST_DIR, "background/background.js"),
        external: ["chrome", "browser"]
      }),
      build({
        entryPoints: ["content/content-script.js"],
        bundle: true,
        platform: "node",
        target: "es2020",
        format: "esm",
        outfile: join(DIST_DIR, "content/content-script.js"),
        external: ["chrome", "browser"]
      }),
      build({
        entryPoints: ["popup/popup.js"],
        bundle: true,
        platform: "node",
        target: "es2020",
        format: "esm",
        outfile: join(DIST_DIR, "popup/popup.js"),
        external: ["chrome", "browser"]
      }),
      build({
        entryPoints: ["options/options.js"],
        bundle: true,
        platform: "node",
        target: "es2020",
        format: "esm",
        outfile: join(DIST_DIR, "options/options.js"),
        external: ["chrome", "browser"]
      })
    ]);

    console.log("✅ Dev rebuild complete");
  } catch (error) {
    console.error("❌ Dev build failed:", error);
  }
}

// Initial build
await devBuild();

// Watch for changes
const watchDirs = ["background", "content", "popup", "options", "utils", "styles", "_locales"];

for (const dir of watchDirs) {
  watch(join(SOURCE_DIR, dir), { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith(".js") || filename.endsWith(".html") || filename.endsWith(".css") || filename.endsWith(".json"))) {
      console.log(`📝 Changed: ${dir}/${filename}`);
      devBuild();
    }
  });
}

console.log("👀 Watching for changes... (Ctrl+C to stop)");