/**
 * Preserves unrelated fields when publishing one section of a shared document.
 *
 * @param {Object} existingData Current published document data.
 * @param {Object} nextPayload Fields owned by the section being published.
 * @return {Object} Merged data ready for publish metadata.
 */
export function mergePreviewSingletonPayload(existingData, nextPayload) {
  return {
    ...(existingData || {}),
    ...(nextPayload || {}),
  };
}
