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

await build({
  entryPoints: [entryFile],
  outfile: outputFile,
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

const legalFile = `${outputFile}.LEGAL.txt`;
try {
  const legalText = await fs.readFile(legalFile, "utf8");
  const normalizedLegalText = legalText
    .split(/\r?\n/u)
    .map((line) => line.trimEnd())
    .join("\n");
  await fs.writeFile(legalFile, normalizedLegalText, "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

try {
  await fs.access(outputCssFile);
} catch (error) {
  await fs.writeFile(outputCssFile, "", "utf8");
}
