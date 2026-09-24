const EXPORT_LOAD_ERROR =
  "Studio could not load the export tools. Reload Studio and try the export again.";

export function createStudioExportLoader(
  importExportModule = () => import("./export.js"),
) {
  let modulePromise = null;

  return async function loadStudioExports() {
    if (!modulePromise) {
      modulePromise = Promise.resolve().then(importExportModule);
    }
    try {
      return await modulePromise;
    } catch (error) {
      modulePromise = null;
      const loadError = new Error(EXPORT_LOAD_ERROR);
      loadError.cause = error;
      throw loadError;
    }
  };
}

export const loadStudioExports = createStudioExportLoader();
