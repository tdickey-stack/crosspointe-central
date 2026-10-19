export function isGeneralPromotionRequest(request) {
  return String(request?.sourceFormId || "") === "1229879";
}

export function promotionRequestInitialForm(request) {
  return {
    name: request.proposedName || "",
    eventDate: isGeneralPromotionRequest(request) ? "" : request.eventDate || "",
    campaignEndDate: isGeneralPromotionRequest(request) ? request.requestedPromotionEnd || "" : "",
    level: "",
    playbookId: "",
  };
}

export function campaignFromPromotionRequest({request, form, playbook}) {
  const windowBased = isGeneralPromotionRequest(request);
  if (!form.name.trim() || !(windowBased ? form.campaignEndDate : form.eventDate) || !playbook) {
    throw new Error("Confirm the campaign name, planning date, and playbook.");
  }
  return {
    id: `pco-form-${request.sourceFormId}-${request.sourceSubmissionId}`
      .replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128),
    name: form.name.trim(),
    eventDate: windowBased ? "" : form.eventDate,
    registrationDeadline: "",
    submittedAt: request.submittedAt,
    level: playbook.level,
    campaignType: playbook.campaignType,
    playbookId: playbook.id,
    sourceEventId: `pco-form:${request.sourceFormId}:${request.sourceSubmissionId}`,
    eventDetails: String(request.description || "").trim(),
    sampleAnnouncement: "",
    notes: String(request.notes || "").trim(),
    status: "active",
    ...(windowBased ? {
      scheduleMode: "promotion-window",
      campaignEndDate: form.campaignEndDate,
      requestedPromotionStart: request.requestedPromotionStart || "",
      requestedPromotionEnd: request.requestedPromotionEnd || "",
    } : {}),
  };
}

export function promotionRequestConversionUpdates(request, campaign) {
  const updates = {proposedName: campaign.name, status: "converted", campaignId: campaign.id};
  // A general request has no event date. Preserve that source fact when it is
  // converted; its selected promotion end belongs to the resulting campaign.
  if (isGeneralPromotionRequest(request)) return updates;
  const eventDate = campaign.eventDate;
  const changed = eventDate !== request.eventDate || ["needs-review", "manual-required"].includes(request.dateParseStatus);
  return {
    ...updates,
    eventDate,
    eventDates: changed ? [eventDate] : request.eventDates?.length ? request.eventDates : [eventDate],
    eventDateEnd: changed ? "" : request.eventDateEnd || "",
    dateParseStatus: changed ? "manual" : request.dateParseStatus || "parsed",
    dateParseKind: changed ? "single" : request.dateParseKind || "single",
    dateSource: changed ? "manual-review" : request.dateSource || "form-parser",
  };
}
