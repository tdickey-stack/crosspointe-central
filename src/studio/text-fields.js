export const EVENT_TEXT_FIELDS = Object.freeze({
  eyebrow: Object.freeze({label: "Utility label", maximum: 30}),
  title: Object.freeze({label: "Event title", maximum: 52}),
  subtitle: Object.freeze({
    label: "Supporting line",
    maximum: 110,
    multiline: true,
  }),
  date: Object.freeze({label: "Date", maximum: 28}),
  time: Object.freeze({label: "Time", maximum: 24}),
  location: Object.freeze({label: "Location", maximum: 34}),
  cta: Object.freeze({label: "Call to action", maximum: 44}),
});

export const SOCIAL_TEXT_FIELDS = Object.freeze({
  eyebrow: Object.freeze({label: "Context label", maximum: 30}),
  title: Object.freeze({label: "Main text", maximum: 220, multiline: true}),
  subtitle: Object.freeze({
    label: "Reference, attribution, or supporting text",
    maximum: 110,
    multiline: true,
  }),
  cta: Object.freeze({label: "Footer text", maximum: 44}),
});

export const SMALL_GROUP_TEXT_FIELDS = Object.freeze({
  eyebrow: Object.freeze({label: "Ministry label", maximum: 30}),
  title: Object.freeze({label: "Group name", maximum: 52}),
  subtitle: Object.freeze({label: "Leader names", maximum: 110}),
  date: Object.freeze({label: "Meeting day", maximum: 28}),
  time: Object.freeze({label: "Meeting time", maximum: 48}),
  location: Object.freeze({label: "Meeting location", maximum: 34}),
  cta: Object.freeze({label: "Directory prompt", maximum: 44}),
});

export function getGraphicTextFields(template) {
  if (template?.variant === "small-group-leader") {
    return SMALL_GROUP_TEXT_FIELDS;
  }
  if (template?.kind === "social") return SOCIAL_TEXT_FIELDS;
  return EVENT_TEXT_FIELDS;
}

export function normalizeGraphicText(value, multiline = false) {
  const normalized = String(value || "")
    .replace(/\u00a0/gu, " ")
    .replace(/\r\n?/gu, "\n");
  return multiline ? normalized : normalized.replace(/\n+/gu, " ");
}

export function validateGraphicTextEdit(value, config) {
  const normalized = normalizeGraphicText(value, config?.multiline);
  const maximum = Number(config?.maximum) || 0;
  return {
    accepted: !maximum || normalized.length <= maximum,
    value: normalized,
    maximum,
  };
}
