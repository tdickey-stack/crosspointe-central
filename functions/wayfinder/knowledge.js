const RESPONSE_MODES = new Set([
  "flexible",
  "guided",
  "fixed_safety",
]);

const ENTRY_CONTENT_FIELDS = [
  "requiredFacts",
  "allowedPublicFacts",
  "requiredActions",
  "approvedActions",
  "routingGuidance",
  "retrievalRules",
  "dynamicSourceRules",
  "requiredSourceType",
  "requiredSourceTypeForDates",
];

export function validateWayfinderBundle(bundle, sourceName = "bundle") {
  const errors = [];
  const value = bundle && typeof bundle === "object" ? bundle : {};

  if (value.schemaVersion !== 1) {
    errors.push(sourceName + ": schemaVersion must be 1.");
  }

  if (!isSafeId_(value.documentId)) {
    errors.push(sourceName + ": documentId is missing or invalid.");
  }

  if (value.status !== "approved") {
    errors.push(sourceName + ": status must be approved before import.");
  }

  if (!value.firestoreTarget || typeof value.firestoreTarget !== "object") {
    errors.push(sourceName + ": firestoreTarget is required.");
  } else if (!isSafeCollection_(value.firestoreTarget.draftCollection)) {
    errors.push(
        sourceName + ": draftCollection is missing or invalid.",
    );
  }

  if (value.documentType === "assistant_policy") {
    if (!value.assistantIdentity || !value.responsePolicy) {
      errors.push(sourceName + ": assistant policy content is incomplete.");
    }
    return errors;
  }

  if (value.documentType !== "knowledge_bundle") {
    errors.push(sourceName + ": unsupported documentType.");
    return errors;
  }

  if (!Array.isArray(value.entries) || value.entries.length === 0) {
    errors.push(sourceName + ": knowledge bundle must contain entries.");
    return errors;
  }

  const seenIds = new Set();
  value.entries.forEach((entry, index) => {
    const label = sourceName + ": entries[" + index + "]";
    validateEntry_(entry, label, errors);

    if (entry && isSafeId_(entry.id)) {
      if (seenIds.has(entry.id)) {
        errors.push(label + ": duplicate entry id " + entry.id + ".");
      }
      seenIds.add(entry.id);
    }
  });

  return errors;
}

export function flattenWayfinderBundles(namedBundles) {
  const sources = Array.isArray(namedBundles) ? namedBundles : [];
  const errors = [];
  const entries = [];
  const policies = [];
  const globalEntryIds = new Set();

  sources.forEach((namedBundle) => {
    const sourceName = String(
        namedBundle && namedBundle.sourceName || "bundle",
    );
    const bundle = namedBundle && namedBundle.bundle;
    errors.push(...validateWayfinderBundle(bundle, sourceName));

    if (!bundle || typeof bundle !== "object") return;

    if (bundle.documentType === "assistant_policy") {
      policies.push({
        id: bundle.firestoreTarget && bundle.firestoreTarget.documentId ||
          bundle.documentId,
        collection: bundle.firestoreTarget &&
          bundle.firestoreTarget.draftCollection,
        data: buildPolicyImportDocument_(bundle, sourceName),
      });
      return;
    }

    if (!Array.isArray(bundle.entries)) return;

    bundle.entries.forEach((entry) => {
      if (globalEntryIds.has(entry.id)) {
        errors.push(sourceName + ": duplicate global entry id " +
          entry.id + ".");
      }
      globalEntryIds.add(entry.id);

      entries.push({
        id: entry.id,
        collection: bundle.firestoreTarget.draftCollection,
        data: {
          ...entry,
          approvalStatus: bundle.status,
          approvedDate: bundle.approvedDate,
          publicationState: "draft",
          sourceBundleId: bundle.documentId,
          sourceBundleTitle: bundle.title,
          sourceFile: sourceName,
          schemaVersion: bundle.schemaVersion,
        },
      });
    });
  });

  return {errors, entries, policies};
}

function validateEntry_(entry, label, errors) {
  const value = entry && typeof entry === "object" ? entry : {};

  if (!isSafeId_(value.id)) {
    errors.push(label + ": id is missing or invalid.");
  }

  if (!isNonEmptyString_(value.topic)) {
    errors.push(label + ": topic is required.");
  }

  if (!isNonEmptyString_(value.title)) {
    errors.push(label + ": title is required.");
  }

  if (!RESPONSE_MODES.has(value.responseMode)) {
    errors.push(label + ": responseMode is invalid.");
  }

  if (!Array.isArray(value.sampleQuestions) ||
    value.sampleQuestions.length === 0) {
    errors.push(label + ": sampleQuestions must not be empty.");
  }

  if (!Array.isArray(value.keywords) || value.keywords.length === 0) {
    errors.push(label + ": keywords must not be empty.");
  }

  const hasContent = ENTRY_CONTENT_FIELDS.some((field) => {
    const fieldValue = value[field];
    return Array.isArray(fieldValue) ? fieldValue.length > 0 :
      isNonEmptyString_(fieldValue);
  });

  if (!hasContent) {
    errors.push(label + ": entry has no approved answer guidance.");
  }

  (value.approvedLinks || []).forEach((link, linkIndex) => {
    const linkLabel = label + ": approvedLinks[" + linkIndex + "]";
    if (!link || !isNonEmptyString_(link.label)) {
      errors.push(linkLabel + ": label is required.");
    }
    if (!isApprovedUrl_(link && link.url)) {
      errors.push(linkLabel + ": URL must be a valid HTTPS URL.");
    }
  });
}

function buildPolicyImportDocument_(bundle, sourceName) {
  const content = {...bundle};
  delete content.firestoreTarget;

  return {
    ...content,
    approvalStatus: bundle.status,
    publicationState: "draft",
    sourceFile: sourceName,
  };
}

function isSafeId_(value) {
  return /^[a-z0-9][a-z0-9-]{1,119}$/.test(String(value || ""));
}

function isSafeCollection_(value) {
  return /^[A-Za-z][A-Za-z0-9]{2,119}$/.test(String(value || ""));
}

function isNonEmptyString_(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isApprovedUrl_(value) {
  try {
    return new URL(String(value || "")).protocol === "https:";
  } catch (error) {
    return false;
  }
}
