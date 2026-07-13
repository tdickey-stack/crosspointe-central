import {flattenWayfinderBundles} from "../wayfinder/knowledge.js";
import {rankWayfinderKnowledge} from "../wayfinder/retrieval.js";
import {loadWayfinderBundles} from "./wayfinder-bundles.js";

const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.error(
      "Enter a question. Example:\n" +
      "npm run wayfinder:query -- \"Do I have to dress up for church?\"",
  );
  process.exitCode = 1;
} else {
  try {
    const bundles = await loadWayfinderBundles();
    const flattened = flattenWayfinderBundles(bundles);

    if (flattened.errors.length) {
      throw new Error(flattened.errors.join("\n"));
    }

    const entries = flattened.entries.map((entry) => entry.data);
    const retrieval = rankWayfinderKnowledge(question, entries, {limit: 5});

    console.log("\nQuestion: " + question);
    console.log("Confidence: " + retrieval.confidence);

    if (!retrieval.results.length) {
      console.log("\nNo approved knowledge entry matched this question.");
    } else {
      console.log("\nBest matches:");
      retrieval.results.forEach((result, index) => {
        console.log(
            "\n" + (index + 1) + ". " + result.title +
            " [" + result.id + "]",
        );
        console.log("   Score: " + result.score);
        console.log("   Matched: " +
          (result.matchedTerms.join(", ") || "none"));
        console.log("   Response mode: " + result.responseMode);

        if (result.requiredSourceType) {
          console.log("   Requires live source: " +
            result.requiredSourceType);
        }

        if (result.requiredFacts.length) {
          console.log("   Approved facts:");
          result.requiredFacts.forEach((fact) => {
            console.log("   - " + fact);
          });
        }

        if (result.approvedLinks.length) {
          console.log("   Approved links:");
          result.approvedLinks.forEach((link) => {
            console.log("   - " + link.label + ": " + link.url);
          });
        }

        if (result.prohibitedClaims.length ||
          result.prohibitedInformation.length) {
          console.log("   Guardrails:");
          [
            ...result.prohibitedClaims,
            ...result.prohibitedInformation,
          ].forEach((guardrail) => {
            console.log("   - " + guardrail);
          });
        }
      });
    }

    console.log("\nRetrieval only: Gemini did not generate an answer.\n");
  } catch (error) {
    console.error(error && error.stack || error);
    process.exitCode = 1;
  }
}
