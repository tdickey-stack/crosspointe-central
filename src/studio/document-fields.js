// These stored string limits mirror firestore.rules; arrays are derived from them.
export const DOCUMENT_FIELD_LIMITS = {
  "document-one-pager": {
    primaryItemsText: 700, secondaryItemsText: 700, ownerItemsText: 480,
    processStepsText: 240, footerReference: 34,
  },
  "document-checklist": {
    sectionOneItemsText: 1400, sectionTwoItemsText: 1400, sectionThreeItemsText: 1400,
  },
};
export function documentFieldWarnings(page) {
  return Object.entries(DOCUMENT_FIELD_LIMITS[page.templateId] || {}).flatMap(([field, maximum]) =>
    String(page.content?.[field] || "").length > maximum
      ? [`${field.replace(/([A-Z])/g, " $1").toLowerCase()} exceeds ${maximum} characters. Shorten it before saving or exporting.`] : []);
}
