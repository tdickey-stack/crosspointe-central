import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {build} from "esbuild";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const outputFile = path.join(projectRoot, "public", "planner.js");

await build({
  entryPoints: [path.join(projectRoot, "src", "planner", "main.jsx")],
  outfile: outputFile,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  logLevel: "info",
  legalComments: "external",
  minify: true,
  sourcemap: false,
  supported: {"template-literal": false},
  target: ["es2020"],
  loader: {".css": "css"},
});

const legalFile = `${outputFile}.LEGAL.txt`;
try {
  const legalText = await fs.readFile(legalFile, "utf8");
  await fs.writeFile(
    legalFile,
    legalText.split(/\r?\n/u).map((line) => line.trimEnd()).join("\n"),
    "utf8",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
