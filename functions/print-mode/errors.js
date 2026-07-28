export function createPrintModeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function getPrintModeStatusCode(error) {
  if (!error || !error.code) {
    return 500;
  }

  if (
    error.code === "admin-email-required" ||
    error.code === "admin-access-required" ||
    error.code === "bulletin-mode-forbidden"
  ) {
    return 403;
  }

  return 400;
}

export function getPrintModeErrorMessage(error) {
  return error && error.message ?
    error.message :
    "Unable to load or save Print Mode settings.";
}
