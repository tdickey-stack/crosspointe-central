/* eslint-disable require-jsdoc */

export function createCentralEmbedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function getCentralEmbedStatusCode(error) {
  const code = error && error.code;
  if (code === "not-found" || code === "not-published") return 404;
  if (code === "invalid-payload") return 400;
  if (code === "auth-required") return 401;
  if (code === "access-required" || code === "forbidden") return 403;
  return 500;
}

export function getCentralEmbedErrorMessage(error) {
  return error && error.message ?
    error.message :
    "Central Embeds could not complete that request.";
}
