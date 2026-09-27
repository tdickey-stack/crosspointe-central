import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");

// Keep this IIFE self-contained: embeds.js can load it in the Admin page
// without turning the legacy page into an ES module.
await build({
  entryPoints: [path.join(projectRoot, "src", "embed-preview.js")],
  outfile: path.join(projectRoot, "public", "embed-preview.js"),
  bundle: true,
  format: "iife",
  globalName: "CentralEmbedPreviewBundle",
  legalComments: "none",
  minify: true,
  sourcemap: false,
  target: ["es2020"],
});
