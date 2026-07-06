import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {build} from "esbuild";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const projectRoot = path.resolve(currentDir, "..");
const entryFile = path.join(projectRoot, "src", "youversion-reader.jsx");
const outputFile = path.join(projectRoot, "public", "youversion-reader.js");
const outputCssFile = path.join(projectRoot, "public", "youversion-reader.css");

await build({
  entryPoints: [entryFile],
  outfile: outputFile,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  logLevel: "info",
  minify: true,
  sourcemap: false,
  target: ["es2020"],
  loader: {
    ".css": "css",
  },
});

try {
  await fs.access(outputCssFile);
} catch (error) {
  await fs.writeFile(outputCssFile, "", "utf8");
}
