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

export const DOCUMENT_LINE_LIST_LIMITS = Object.freeze({
  "document-one-pager": Object.freeze({
    primaryItems: Object.freeze({
      draftField: "primaryItemsText",
      label: "primary items",
      maximum: 7,
    }),
    secondaryItems: Object.freeze({
      draftField: "secondaryItemsText",
      label: "secondary items",
      maximum: 7,
    }),
    ownerItems: Object.freeze({
      draftField: "ownerItemsText",
      label: "owner responsibilities",
      maximum: 3,
    }),
    processSteps: Object.freeze({
      draftField: "processStepsText",
      label: "process steps",
      maximum: 8,
    }),
  }),
});

function textToDocumentLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function documentLineListItems(templateId, content, itemsField) {
  const config = DOCUMENT_LINE_LIST_LIMITS[templateId]?.[itemsField];
  if (!config) {
    return (Array.isArray(content?.[itemsField]) ? content[itemsField] : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  return typeof content?.[config.draftField] === "string"
    ? textToDocumentLines(content[config.draftField])
    : (Array.isArray(content?.[itemsField]) ? content[itemsField] : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean);
}

export function documentFieldWarnings(page) {
  const content = page.content || {};
  const textWarnings = Object.entries(
    DOCUMENT_FIELD_LIMITS[page.templateId] || {},
  ).flatMap(([field, maximum]) =>
    String(content[field] || "").length > maximum
      ? [`${field.replace(/([A-Z])/g, " $1").toLowerCase()} exceeds ${maximum} characters. Shorten it before saving or exporting.`]
      : []);
  const listWarnings = Object.entries(
    DOCUMENT_LINE_LIST_LIMITS[page.templateId] || {},
  ).flatMap(([itemsField, config]) => {
    const count = documentLineListItems(
      page.templateId,
      content,
      itemsField,
    ).length;
    if (count <= config.maximum) return [];
    const excess = count - config.maximum;
    return [
      `The ${config.label} list has ${count} items; this layout supports up to ${config.maximum}. Remove ${excess} item${excess === 1 ? "" : "s"} before exporting.`,
    ];
  });
  return [...textWarnings, ...listWarnings];
}
