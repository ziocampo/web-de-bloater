/**
 * XPI packaging for Firefox
 * Firefox XPI is essentially a ZIP with specific structure
 */

import { createWriteStream } from "fs";
import { join } from "path";
import archiver from "archiver";
import { readdirSync } from "fs";

export async function createXpi(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`📦 Created ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    function addFiles(dir, prefix = "") {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const archivePath = join(prefix, entry.name);
        if (entry.isDirectory()) {
          addFiles(fullPath, archivePath);
        } else {
          archive.file(fullPath, { name: archivePath });
        }
      }
    }

    addFiles(sourceDir);
    archive.finalize();
  });
}