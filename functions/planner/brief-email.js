/* eslint-disable max-len, require-jsdoc */

const MAX_RECIPIENTS = 20;
const MAX_PDF_BASE64_LENGTH = 12000000;

function text(value, maximum = 2000) {
  return String(value || "").trim().slice(0, maximum);
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value, 320).toLowerCase());
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function dateValue(value) {
  const normalized = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function formatDate(value) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"});
}

function escapeHtml(value) {
  return text(value, 10000)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
}

function normalizeRecipients(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[,;\n]/u);
  const recipients = [...new Set(source.map((item) => text(item, 320).toLowerCase()).filter(Boolean))];
  if (!recipients.length) fail("Enter at least one recipient email address.");
  if (recipients.length > MAX_RECIPIENTS) fail(`A promotion brief can be sent to at most ${MAX_RECIPIENTS} recipients at once.`);
  const invalid = recipients.find((item) => !looksLikeEmail(item));
  if (invalid) fail(`Check the recipient email address: ${invalid}`);
  return recipients;
}

function normalizeAnnouncement(value) {
  const source = value && typeof value === "object" ? value : {};
  const playType = text(source.playType, 100);
  if (!playType) fail("Each promotion in the brief needs a promotion type.");
  return {
    playType,
    channel: text(source.channel, 100),
    scheduledDate: dateValue(source.scheduledDate),
    needsAttention: source.needsAttention === true,
    smuggle: normalizeAnnouncementSmuggle(source.smuggle),
  };
}

function normalizeAnnouncementSmuggle(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const beneficiaryName = text(source.beneficiaryName, 180);
  if (!beneficiaryName) return null;
  return {
    beneficiaryName,
    beneficiaryLevel: Math.min(5, Math.max(4, Number(source.beneficiaryLevel || 5))),
  };
}

function normalizeSmuggledInto(value) {
  const source = value && typeof value === "object" ? value : {};
  const hostCampaignName = text(source.hostCampaignName, 180);
  if (!hostCampaignName) fail("Each Smuggle relationship needs a host campaign.");
  return {
    id: text(source.id, 240),
    hostCampaignName,
    hostCampaignLevel: Math.min(3, Math.max(1, Number(source.hostCampaignLevel || 3))),
    hostPlayType: text(source.hostPlayType, 100) || "Promotion",
    hostChannel: text(source.hostChannel, 100),
    scheduledDate: dateValue(source.scheduledDate),
  };
}

function normalizeEntry(value) {
  const source = value && typeof value === "object" ? value : {};
  const name = text(source.name, 180);
  if (!name) fail("Each campaign in the brief needs a name.");
  const announcements = Array.isArray(source.announcements) ?
    source.announcements.slice(0, 60).map(normalizeAnnouncement) :
    [];
  const smuggledInto = Array.isArray(source.smuggledInto) ?
    source.smuggledInto.slice(0, 20).map(normalizeSmuggledInto) :
    [];
  if (!announcements.length && !smuggledInto.length) fail(`${name} does not contain any selected promotions.`);
  return {
    name,
    kind: source.kind === "content" ? "content" : "campaign",
    level: source.kind === "content" ? null : Math.min(5, Math.max(1, Number(source.level || 5))),
    eventDate: dateValue(source.eventDate),
    registrationDeadline: dateValue(source.registrationDeadline),
    notes: text(source.notes, 2400),
    announcements,
    smuggledInto,
  };
}

function normalizeAttachment(value) {
  const source = value && typeof value === "object" ? value : {};
  const base64 = text(source.base64, MAX_PDF_BASE64_LENGTH + 1).replace(/\s+/gu, "");
  if (!base64 || base64.length > MAX_PDF_BASE64_LENGTH || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    fail("The attached promotion brief PDF is missing or too large.");
  }
  const filename = text(source.filename, 120)
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "promotion-brief.pdf";
  return {
    filename: filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`,
    contentType: "application/pdf",
    base64,
  };
}

export function normalizePlannerBriefEmailPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const briefSource = source.brief && typeof source.brief === "object" ? source.brief : {};
  const entries = Array.isArray(briefSource.entries) ?
    briefSource.entries.slice(0, 120).map(normalizeEntry) :
    [];
  if (!entries.length) fail("Choose at least one campaign or content item before sending the brief.");
  const startDate = dateValue(briefSource.startDate);
  const endDate = dateValue(briefSource.endDate);
  if (!startDate || !endDate || startDate > endDate) fail("Choose a valid report date range.");
  const subject = text(source.subject, 160);
  if (!subject) fail("Enter an email subject.");
  return {
    recipients: normalizeRecipients(source.recipients),
    subject,
    message: text(source.message, 1500),
    brief: {
      title: text(briefSource.title, 120) || "Promotion Brief",
      startDate,
      endDate,
      announcementTypes: Array.isArray(briefSource.announcementTypes) ?
        briefSource.announcementTypes.slice(0, 60).map((item) => text(item, 100)).filter(Boolean) :
        [],
      entries,
      announcementCount: entries.reduce((total, entry) => total + entry.announcements.length, 0),
      attentionCount: entries.reduce((total, entry) => total + entry.announcements.filter((item) => item.needsAttention).length, 0),
    },
    attachment: normalizeAttachment(source.attachment),
  };
}

export function buildPlannerBriefEmailText(payload) {
  const {brief} = payload;
  const lines = [
    brief.title,
    `${formatDate(brief.startDate)} - ${formatDate(brief.endDate)}`,
    "",
    payload.message || "Here is the latest promotion brief from Central.",
    "",
    `Promotions: ${brief.announcementCount}`,
    `Campaigns and content: ${brief.entries.length}`,
    `Need attention: ${brief.attentionCount}`,
    "",
  ];
  brief.entries.forEach((entry) => {
    lines.push(`${entry.kind === "content" ? "CONTENT" : `LEVEL ${entry.level}`} - ${entry.name}`);
    if (entry.eventDate) lines.push(`Event: ${formatDate(entry.eventDate)}`);
    entry.smuggledInto.forEach((relationship) => {
      lines.push(`SMUGGLED INTO: Level ${relationship.hostCampaignLevel} ${relationship.hostCampaignName} | ${relationship.hostPlayType} | ${formatDate(relationship.scheduledDate)}`);
    });
    entry.announcements.forEach((announcement) => {
      lines.push(`- ${announcement.playType} | ${formatDate(announcement.scheduledDate)} | ${announcement.channel || "Channel not set"}${announcement.needsAttention ? " | NEEDS ATTENTION" : ""}`);
      if (announcement.smuggle) lines.push(`  SMUGGLE CONTAINS: Level ${announcement.smuggle.beneficiaryLevel} ${announcement.smuggle.beneficiaryName}`);
    });
    if (entry.notes) lines.push(`Notes: ${entry.notes}`);
    lines.push("");
  });
  lines.push("The complete promotion brief is attached as a PDF.");
  lines.push("Generated by CrossPointe Central Promotion Planner.");
  return lines.join("\n");
}

export function buildPlannerBriefEmailHtml(payload) {
  const {brief} = payload;
  const cards = brief.entries.map((entry) => {
    const announcements = entry.announcements.map((announcement) => `
      <tr>
        <td style="padding:9px 0;border-top:1px solid #e5e7eb;font-weight:700;color:#27272a;">${escapeHtml(announcement.playType)}${announcement.smuggle ? `<br><span style="display:inline-block;margin-top:5px;color:#7e5cc4;font-size:11px;">Smuggle contains Level ${announcement.smuggle.beneficiaryLevel} ${escapeHtml(announcement.smuggle.beneficiaryName)}</span>` : ""}</td>
        <td style="padding:9px 0;border-top:1px solid #e5e7eb;color:#71717a;text-align:right;">${escapeHtml(formatDate(announcement.scheduledDate))}<br>${escapeHtml(announcement.channel || "Channel not set")}${announcement.needsAttention ? "<br><strong style=\"color:#ef3e2d;\">Needs attention</strong>" : ""}</td>
      </tr>`).join("");
    const smuggledInto = entry.smuggledInto.map((relationship) => `
      <div style="margin:10px 0;padding:10px 12px;border:1px solid #ddd6fe;border-radius:9px;background:#f5f3ff;color:#6d4bb3;font-size:12px;font-weight:700;">
        Smuggled into Level ${relationship.hostCampaignLevel} ${escapeHtml(relationship.hostCampaignName)}<br>
        <span style="color:#71717a;font-weight:400;">${escapeHtml(relationship.hostPlayType)} &nbsp;|&nbsp; ${escapeHtml(formatDate(relationship.scheduledDate))}</span>
      </div>`).join("");
    return `
      <div style="margin:0 0 14px;padding:18px;border:1px solid #e4e4e7;border-left:5px solid ${entry.kind === "content" ? "#f472b6" : ["", "#ef3e2d", "#f59e0b", "#4bb8e9", "#4bc3a7", "#a78bfa"][entry.level]};border-radius:12px;background:#ffffff;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#71717a;">${entry.kind === "content" ? "Content" : `Level ${entry.level}`}</div>
        <h2 style="margin:5px 0 3px;font-size:19px;line-height:1.25;color:#18181b;">${escapeHtml(entry.name)}</h2>
        ${entry.eventDate ? `<p style="margin:0 0 10px;color:#71717a;font-size:13px;">Event ${escapeHtml(formatDate(entry.eventDate))}${entry.registrationDeadline ? ` &nbsp;|&nbsp; Registration ${escapeHtml(formatDate(entry.registrationDeadline))}` : ""}</p>` : ""}
        ${smuggledInto}
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;">${announcements}</table>
        ${entry.notes ? `<p style="margin:12px 0 0;padding-top:10px;border-top:1px solid #e5e7eb;color:#52525b;font-size:13px;line-height:1.55;"><strong style="color:#27272a;">Notes:</strong> ${escapeHtml(entry.notes)}</p>` : ""}
      </div>`;
  }).join("");
  return `<!doctype html>
  <html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#27272a;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(brief.title)} from CrossPointe Central.</div>
    <div style="max-width:680px;margin:0 auto;padding:24px 14px;">
      <div style="padding:28px;border-radius:16px 16px 0 0;background:#18181b;border-left:7px solid #ef3e2d;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#ef3e2d;">CROSSPOINTE CENTRAL</div>
        <h1 style="margin:8px 0 5px;font-size:28px;color:#ffffff;">${escapeHtml(brief.title)}</h1>
        <p style="margin:0;color:#d4d4d8;font-size:14px;">${escapeHtml(formatDate(brief.startDate))} - ${escapeHtml(formatDate(brief.endDate))}</p>
      </div>
      <div style="padding:24px;background:#ffffff;border:1px solid #e4e4e7;border-top:0;">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(payload.message || "Here is the latest promotion brief from Central.")}</p>
        <div style="margin:0 0 20px;padding:15px;border-radius:10px;background:#f4f4f5;font-size:13px;color:#52525b;">
          <strong style="color:#18181b;">${brief.announcementCount}</strong> promotions &nbsp;|&nbsp;
          <strong style="color:#18181b;">${brief.entries.length}</strong> campaigns + content &nbsp;|&nbsp;
          <strong style="color:${brief.attentionCount ? "#ef3e2d" : "#18181b"};">${brief.attentionCount}</strong> need attention
        </div>
        ${cards}
        <p style="margin:20px 0 0;color:#71717a;font-size:12px;line-height:1.5;">The complete promotion brief is attached as a PDF. Generated by CrossPointe Central Promotion Planner.</p>
      </div>
    </div>
  </body></html>`;
}
