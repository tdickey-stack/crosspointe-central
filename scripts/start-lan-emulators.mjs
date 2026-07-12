import {spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sourceConfigPath = path.join(projectDirectory, "firebase.json");
const lanConfigPath = path.join(
    projectDirectory,
    ".firebase.lan.generated.json",
);
const exportDirectory = "/tmp/crosspointe-wayfinder-live-export";
const firebaseBinary = path.join(
    projectDirectory,
    "node_modules",
    ".bin",
    "firebase",
);

const sourceConfig = JSON.parse(await fs.readFile(sourceConfigPath, "utf8"));
const lanConfig = structuredClone(sourceConfig);
const emulatorNames = [
  "auth",
  "firestore",
  "functions",
  "hosting",
  "ui",
];

lanConfig.emulators = lanConfig.emulators || {};
emulatorNames.forEach((name) => {
  lanConfig.emulators[name] = lanConfig.emulators[name] || {};
  lanConfig.emulators[name].host = "0.0.0.0";
});

await fs.writeFile(
    lanConfigPath,
    JSON.stringify(lanConfig, null, 2) + "\n",
    "utf8",
);

console.log("Starting Firebase in trusted-network LAN mode.");
console.log("Stop the emulator when phone testing is finished.");

const child = spawn(firebaseBinary, [
  "emulators:start",
  "--project",
  "crosspointe-central",
  "--config",
  lanConfigPath,
  "--only",
  "auth,functions,firestore,hosting",
  "--import",
  exportDirectory,
  "--export-on-exit",
  exportDirectory,
], {
  cwd: projectDirectory,
  stdio: "inherit",
});

let forwardingSignal = false;
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    if (forwardingSignal) return;
    forwardingSignal = true;
    child.kill(signal);
  });
});

child.on("error", async (error) => {
  await removeGeneratedConfig_();
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", async (code, signal) => {
  await removeGeneratedConfig_();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = Number(code) || 0;
});

async function removeGeneratedConfig_() {
  try {
    await fs.unlink(lanConfigPath);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}
