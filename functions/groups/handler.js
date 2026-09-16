/* eslint-disable require-jsdoc */

// No authenticated/admin payloads or upstream errors cross this boundary.
export function createPublicGroupsHandler({loadGroups}) {
  return async (request, response) => {
    response.set("X-Content-Type-Options", "nosniff");
    if (request.method !== "GET") {
      response.set("Allow", "GET");
      response.set("Cache-Control", "no-store");
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    try {
      const groups = await loadGroups();
      response.set("Cache-Control", "public, max-age=60, s-maxage=60");
      response.status(200).json({schemaVersion: 1, groups});
    } catch {
      // Do not include error messages from credentialed API requests in logs
      // or in the public response: they can contain upstream response bodies.
      console.warn("Public Groups directory source unavailable.");
      response.set("Cache-Control", "no-store");
      response.status(503).json({
        error: "Groups are temporarily unavailable. Please try again.",
      });
    }
  };
}
