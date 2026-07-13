import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIRECTORY = path.resolve(
    SCRIPT_DIRECTORY,
    "../../data/ask-central",
);

export async function loadWayfinderBundles() {
  const names = (await fs.readdir(KNOWLEDGE_DIRECTORY))
      .filter((name) => name.endsWith(".json"))
      .sort();

  return Promise.all(names.map(async (name) => {
    const sourcePath = path.join(KNOWLEDGE_DIRECTORY, name);
    const rawContent = await fs.readFile(sourcePath, "utf8");
    return {
      sourceName: name,
      sourcePath: sourcePath,
      bundle: JSON.parse(rawContent),
    };
  }));
}
