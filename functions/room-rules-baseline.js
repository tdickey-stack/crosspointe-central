/**
 * Returns the rules that edits should use as their current baseline.
 * @param {object} roomRulesOverride Firestore override state.
 * @param {*} fallbackItems Built-in room rules.
 * @return {object[]} Effective baseline rules.
 */
export function resolveEffectiveRoomRulesBaseline(
    roomRulesOverride,
    fallbackItems,
) {
  const override = roomRulesOverride &&
    typeof roomRulesOverride === "object" ?
    roomRulesOverride :
    {};
  if (override.shouldOverride) {
    return Array.isArray(override.items) ? override.items : [];
  }
  return Array.isArray(fallbackItems) ? fallbackItems : [];
}
