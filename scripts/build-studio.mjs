import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {build} from "esbuild";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const projectRoot = path.resolve(currentDir, "..");
const entryFile = path.join(projectRoot, "src", "studio", "main.jsx");
const outputFile = path.join(projectRoot, "public", "studio.js");
const outputCssFile = path.join(projectRoot, "public", "studio.css");

// Retain previously published hashed chunks. Tabs opened before a deployment
// may request their export module for the first time after the new release.
// Do not clean public/studio-chunks as part of this build or deployment.
await build({
  entryPoints: {studio: entryFile},
  outdir: path.dirname(outputFile),
  splitting: true,
  chunkNames: "studio-chunks/[name]-[hash]",
  bundle: true,
  format: "esm",
  jsx: "automatic",
  logLevel: "info",
  legalComments: "external",
  minify: true,
  sourcemap: false,
  supported: {
    "template-literal": false,
  },
  target: ["es2020"],
  loader: {
    ".css": "css",
  },
});

const chunkDirectory = path.join(projectRoot, "public", "studio-chunks");
const legalFiles = [
  `${outputFile}.LEGAL.txt`,
  ...(await fs.readdir(chunkDirectory)).filter((name) => name.endsWith(".LEGAL.txt"))
    .map((name) => path.join(chunkDirectory, name)),
];
for (const legalFile of legalFiles) {
  try {
    const legalText = await fs.readFile(legalFile, "utf8");
    await fs.writeFile(legalFile, legalText.split(/\r?\n/u).map((line) => line.trimEnd()).join("\n"), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

try {
  await fs.access(outputCssFile);
} catch (error) {
  await fs.writeFile(outputCssFile, "", "utf8");
}
