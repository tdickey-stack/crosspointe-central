import {flattenWayfinderBundles} from "../wayfinder/knowledge.js";
import {loadWayfinderBundles} from "./wayfinder-bundles.js";

try {
  const bundles = await loadWayfinderBundles();
  const result = flattenWayfinderBundles(bundles);

  if (result.errors.length) {
    result.errors.forEach((error) => console.error("- " + error));
    process.exitCode = 1;
  } else {
    console.log("Wayfinder knowledge is valid.");
    console.log("Bundles: " + bundles.length);
    console.log("Policy documents: " + result.policies.length);
    console.log("Knowledge entries: " + result.entries.length);
  }
} catch (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}
