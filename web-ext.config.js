/** @type {import('web-ext').WebExtConfig} */
export default {
  sourceDir: "dist/firefox",
  artifactsDir: "build/firefox",
  overwriteDest: true,
  verbose: true,
  ignoreFiles: [
    "**/*.map",
    "**/*.ts",
    "scripts/**",
    "*.config.js"
  ],
  startUrls: ["about:debugging"]
};