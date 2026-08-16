import {jsPDF} from "jspdf";
import {buildSmuggleRelationships} from "./domain.js";

const HIDDEN_PROMOTION_STATUSES = new Set(["missed", "skipped"]);
const LEVEL_COLORS = {
  1: [239, 62, 45],
  2: [245, 158, 11],
  3: [75, 184, 233],
  4: [75, 195, 167],
  5: [167, 139, 250],
};
const CONTENT_COLOR = [244, 114, 182];

function safeText(value, maximum = 2000) {
  return String(value || "").trim().slice(0, maximum);
}

function safeFilename(value, fallback = "promotion-brief") {
  const normalized = safeText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || fallback;
}

function formatBriefDate(value, {year = true} = {}) {
  if (!value) return "Not set";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return safeText(value);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? {year: "numeric"} : {}),
  });
}

function promotionSort(left, right) {
  return String(left.scheduledDate).localeCompare(String(right.scheduledDate)) ||
    String(left.playType).localeCompare(String(right.playType));
}

function campaignSort(left, right) {
  const leftLevel = left.kind === "content" ? 6 : Number(left.level || 5);
  const rightLevel = right.kind === "content" ? 6 : Number(right.level || 5);
  return leftLevel - rightLevel ||
    String(left.eventDate || left.firstPromotionDate).localeCompare(
      String(right.eventDate || right.firstPromotionDate),
    ) ||
    left.name.localeCompare(right.name);
}

export function buildPromotionBrief({
  campaigns = [],
  scheduledPlays = [],
  selectedPlayTypes = [],
  startDate = "",
  endDate = "",
  title = "Promotion Brief",
  generatedAt = new Date(),
} = {}) {
  const selected = new Set(selectedPlayTypes.map((item) => safeText(item, 100)).filter(Boolean));
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const relationships = buildSmuggleRelationships({plays: scheduledPlays, campaigns});
  const smuggledPlayIds = new Set(relationships.map((relationship) => relationship.beneficiaryPlayId).filter(Boolean));
  const matching = scheduledPlays.filter((play) =>
    !smuggledPlayIds.has(play.id) &&
    !HIDDEN_PROMOTION_STATUSES.has(play.status) &&
    selected.has(safeText(play.playType, 100)) &&
    (!startDate || play.scheduledDate >= startDate) &&
    (!endDate || play.scheduledDate <= endDate),
  );
  const grouped = new Map();
  const matchingPlayIds = new Set(matching.map((play) => play.id));
  const relationshipsByHostPlay = new Map(relationships
    .filter((relationship) => matchingPlayIds.has(relationship.hostPlayId))
    .map((relationship) => [relationship.hostPlayId, relationship]));

  const ensureEntry = (id, campaign = {}, play = {}) => {
    if (!grouped.has(id)) {
      const content = campaign.campaignType === "standalone-content" ||
        play.campaignType === "standalone-content";
      grouped.set(id, {
        id,
        name: safeText(campaign.name || play.campaignName || "Untitled campaign", 180),
        kind: content ? "content" : "campaign",
        level: content ? null : Number(campaign.level || play.campaignLevel || 5),
        eventDate: safeText(campaign.eventDate, 10),
        registrationDeadline: safeText(campaign.registrationDeadline, 10),
        notes: safeText(campaign.notes, 2400),
        announcements: [],
        smuggledInto: [],
      });
    }
    return grouped.get(id);
  };

  matching.forEach((play) => {
    const campaign = campaignById.get(play.campaignId) || {};
    const id = safeText(play.campaignId || campaign.id || play.campaignName, 180);
    const relationship = relationshipsByHostPlay.get(play.id);
    ensureEntry(id, campaign, play).announcements.push({
      id: safeText(play.id, 180),
      playType: safeText(play.playType, 100),
      channel: safeText(play.channel, 100),
      scheduledDate: safeText(play.scheduledDate, 10),
      phase: safeText(play.phase, 100),
      status: safeText(play.status, 60),
      needsAttention: ["conflict", "needs-decision"].includes(play.status) ||
        (play.conflictState && play.conflictState !== "none"),
      conflictReason: safeText(play.conflictReason, 500),
      smuggle: relationship ? {
        beneficiaryCampaignId: safeText(relationship.beneficiaryCampaignId, 180),
        beneficiaryName: safeText(relationship.beneficiaryName, 180),
        beneficiaryLevel: Number(relationship.beneficiaryLevel || 5),
        beneficiaryPlayType: safeText(relationship.beneficiaryPlayType, 100),
        hostCampaignId: safeText(relationship.hostCampaignId, 180),
        hostCampaignName: safeText(relationship.hostCampaignName, 180),
        hostCampaignLevel: Number(relationship.hostCampaignLevel || 3),
      } : null,
    });
    if (relationship) {
      const beneficiaryCampaign = campaignById.get(relationship.beneficiaryCampaignId) || {};
      const beneficiaryId = safeText(relationship.beneficiaryCampaignId, 180);
      ensureEntry(beneficiaryId, beneficiaryCampaign, {
        campaignName: relationship.beneficiaryName,
        campaignLevel: relationship.beneficiaryLevel,
      }).smuggledInto.push({
        id: relationship.id,
        hostCampaignId: safeText(relationship.hostCampaignId, 180),
        hostCampaignName: safeText(relationship.hostCampaignName, 180),
        hostCampaignLevel: Number(relationship.hostCampaignLevel || 3),
        hostPlayType: safeText(relationship.hostPlayType, 100),
        hostChannel: safeText(relationship.hostChannel, 100),
        scheduledDate: safeText(relationship.scheduledDate, 10),
      });
    }
  });

  const entries = [...grouped.values()].map((entry) => {
    const announcements = entry.announcements.sort(promotionSort);
    return {
      ...entry,
      announcements,
      smuggledInto: entry.smuggledInto.sort((left, right) => String(left.scheduledDate).localeCompare(String(right.scheduledDate))),
      firstPromotionDate: announcements[0]?.scheduledDate || entry.smuggledInto[0]?.scheduledDate || "",
      lastPromotionDate: announcements.at(-1)?.scheduledDate || entry.smuggledInto.at(-1)?.scheduledDate || "",
    };
  }).sort(campaignSort);

  return {
    title: safeText(title, 120) || "Promotion Brief",
    startDate: safeText(startDate, 10),
    endDate: safeText(endDate, 10),
    generatedAt: generatedAt instanceof Date ? generatedAt.toISOString() : String(generatedAt || ""),
    announcementTypes: [...selected].sort((left, right) => left.localeCompare(right)),
    entries,
    campaignCount: entries.filter((entry) => entry.kind === "campaign").length,
    contentCount: entries.filter((entry) => entry.kind === "content").length,
    announcementCount: matching.length,
    attentionCount: matching.filter((play) =>
      ["conflict", "needs-decision"].includes(play.status) ||
      (play.conflictState && play.conflictState !== "none"),
    ).length,
  };
}

const PDF_LAYOUT = {
  left: 0.62,
  right: 7.88,
  width: 7.26,
  contentTop: 1.48,
  contentBottom: 10.28,
};

function drawPageHeader(pdf, brief, pageNumber) {
  pdf.setFillColor(21, 21, 24);
  pdf.rect(0, 0, 8.5, 1.18, "F");
  pdf.setFillColor(239, 62, 45);
  pdf.rect(0, 0, 0.12, 1.18, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(239, 62, 45);
  pdf.text("CROSSPOINTE CENTRAL", 0.62, 0.38);
  pdf.setFontSize(20);
  pdf.setTextColor(255, 255, 255);
  const titleLines = pdf.splitTextToSize(brief.title, 7.1).slice(0, 2);
  pdf.text(titleLines, PDF_LAYOUT.left, 0.69, {lineHeightFactor: 0.92});
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(190, 190, 196);
  pdf.text(
    `${formatBriefDate(brief.startDate)} - ${formatBriefDate(brief.endDate)}  |  Page ${pageNumber}`,
    0.62,
    1.01,
  );
}

function addPage(pdf, brief) {
  if (pdf.getNumberOfPages() > 0) pdf.addPage();
  drawPageHeader(pdf, brief, pdf.getNumberOfPages());
  return PDF_LAYOUT.contentTop;
}

function wrap(pdf, text, width) {
  return pdf.splitTextToSize(safeText(text), width);
}

function entryHeaderLayout(pdf, entry, continued = false) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  const suffix = continued ? " (continued)" : "";
  const nameLines = wrap(pdf, `${entry.name}${suffix}`, 5.35).slice(0, 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  const scheduleLabel = entry.kind === "content"
    ? `${formatBriefDate(entry.firstPromotionDate)} - ${formatBriefDate(entry.lastPromotionDate)}`
    : `Event ${formatBriefDate(entry.eventDate)}${entry.registrationDeadline ? `  |  Registration ${formatBriefDate(entry.registrationDeadline)}` : ""}`;
  const scheduleLines = wrap(pdf, scheduleLabel, 6.45).slice(0, 2);
  return {
    nameLines,
    scheduleLines,
    height: Math.max(0.58, 0.15 + nameLines.length * 0.16 + scheduleLines.length * 0.12 + 0.12),
  };
}

function announcementLayout(pdf, announcement) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  const titleLines = wrap(pdf, announcement.playType, 3.45);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const detailLines = wrap(
    pdf,
    `${formatBriefDate(announcement.scheduledDate)}  |  ${announcement.channel || "Channel not set"}`,
    3.0,
  );
  const lineCount = Math.max(titleLines.length, detailLines.length);
  const smuggleLines = announcement.smuggle ? wrap(
    pdf,
    `SMUGGLE CONTAINS LEVEL ${announcement.smuggle.beneficiaryLevel} ${announcement.smuggle.beneficiaryName}`,
    6.35,
  ).slice(0, 2) : [];
  return {
    kind: "announcement",
    announcement,
    titleLines,
    detailLines,
    lineCount,
    smuggleLines,
    height: 0.14 + lineCount * 0.13 + smuggleLines.length * 0.13 +
      (smuggleLines.length ? 0.08 : 0) + (announcement.needsAttention ? 0.16 : 0) + 0.09,
  };
}

function smuggledIntoLayout(pdf, relationship) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const lines = wrap(
    pdf,
    `SMUGGLED INTO LEVEL ${relationship.hostCampaignLevel} ${relationship.hostCampaignName} - ${relationship.hostPlayType} - ${formatBriefDate(relationship.scheduledDate)}`,
    6.35,
  ).slice(0, 3);
  return {
    kind: "smuggled-into",
    relationship,
    lines,
    height: 0.19 + lines.length * 0.13 + 0.09,
  };
}

function noteLayouts(pdf, notes) {
  if (!notes) return [];
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const lines = wrap(pdf, notes, 6.45);
  const chunks = [];
  for (let index = 0; index < lines.length; index += 8) {
    const chunk = lines.slice(index, index + 8);
    chunks.push({
      kind: "notes",
      lines: chunk,
      continued: index > 0,
      height: 0.23 + chunk.length * 0.13 + 0.1,
    });
  }
  return chunks;
}

function drawEntrySegment(pdf, entry, items, y, continued = false) {
  const header = entryHeaderLayout(pdf, entry, continued);
  const itemHeight = items.reduce((sum, item) => sum + item.height, 0);
  const height = header.height + itemHeight + 0.08;
  const accent = entry.kind === "content" ? CONTENT_COLOR : LEVEL_COLORS[entry.level] || LEVEL_COLORS[5];

  pdf.setDrawColor(222, 222, 227);
  pdf.setFillColor(250, 250, 251);
  pdf.roundedRect(PDF_LAYOUT.left, y, PDF_LAYOUT.width, height, 0.08, 0.08, "FD");
  pdf.setFillColor(...accent);
  pdf.roundedRect(PDF_LAYOUT.left, y, 0.08, height, 0.04, 0.04, "F");
  pdf.setFillColor(244, 244, 246);
  pdf.rect(0.7, y, 7.18, header.height, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30, 30, 34);
  pdf.text(header.nameLines, 0.84, y + 0.21, {lineHeightFactor: 1.02});
  pdf.setFontSize(7.5);
  pdf.setTextColor(...accent);
  pdf.text(entry.kind === "content" ? "CONTENT" : `LEVEL ${entry.level}`, 7.62, y + 0.2, {align: "right"});
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 108);
  const scheduleY = y + 0.21 + header.nameLines.length * 0.16 + 0.03;
  pdf.text(header.scheduleLines, 0.84, scheduleY, {lineHeightFactor: 1});
  pdf.setDrawColor(226, 226, 230);
  pdf.line(0.7, y + header.height, PDF_LAYOUT.right, y + header.height);

  let rowY = y + header.height;
  items.forEach((item, index) => {
    if (item.kind === "announcement") {
      if (index % 2 === 1) {
        pdf.setFillColor(247, 247, 249);
        pdf.rect(0.7, rowY, 7.18, item.height, "F");
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(42, 42, 48);
      pdf.text(item.titleLines, 0.84, rowY + 0.18, {lineHeightFactor: 1});
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 108);
      pdf.text(item.detailLines, 7.62, rowY + 0.18, {align: "right", lineHeightFactor: 1});
      if (item.smuggleLines.length) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.4);
        pdf.setTextColor(126, 92, 196);
        pdf.text(item.smuggleLines, 0.84, rowY + 0.21 + item.lineCount * 0.13, {lineHeightFactor: 1});
      }
      if (item.announcement.needsAttention) {
        const attentionY = rowY + item.height - 0.12;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.2);
        pdf.setTextColor(203, 55, 45);
        pdf.text("NEEDS ATTENTION", 0.84, attentionY);
        const reason = safeText(item.announcement.conflictReason, 180);
        if (reason) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(125, 75, 70);
          pdf.text(wrap(pdf, reason, 4.7).slice(0, 1), 2.0, attentionY);
        }
      }
    } else if (item.kind === "smuggled-into") {
      pdf.setFillColor(246, 242, 253);
      pdf.rect(0.7, rowY, 7.18, item.height, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.6);
      pdf.setTextColor(126, 92, 196);
      pdf.text(item.lines, 0.84, rowY + 0.19, {lineHeightFactor: 1});
    } else {
      pdf.setFillColor(246, 246, 248);
      pdf.rect(0.7, rowY, 7.18, item.height, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.3);
      pdf.setTextColor(95, 95, 103);
      pdf.text(item.continued ? "NOTES (CONTINUED)" : "NOTES", 0.84, rowY + 0.16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(72, 72, 78);
      pdf.text(item.lines, 0.84, rowY + 0.34, {lineHeightFactor: 1});
    }
    rowY += item.height;
    pdf.setDrawColor(230, 230, 233);
    pdf.line(0.84, rowY, 7.72, rowY);
  });
  return height;
}

function drawEntry(pdf, brief, entry, startY) {
  let y = startY;
  let continued = false;
  const items = [
    ...entry.smuggledInto.map((relationship) => smuggledIntoLayout(pdf, relationship)),
    ...entry.announcements.map((announcement) => announcementLayout(pdf, announcement)),
    ...noteLayouts(pdf, entry.notes),
  ];
  const freshPageHeight = PDF_LAYOUT.contentBottom - PDF_LAYOUT.contentTop;
  const fullHeader = entryHeaderLayout(pdf, entry, false);
  const fullHeight = fullHeader.height + items.reduce((sum, item) => sum + item.height, 0) + 0.08;

  if (fullHeight <= freshPageHeight && y + fullHeight > PDF_LAYOUT.contentBottom) {
    y = addPage(pdf, brief);
  }

  if (!items.length) {
    return y + drawEntrySegment(pdf, entry, [], y, false) + 0.18;
  }

  let remaining = [...items];
  while (remaining.length) {
    const header = entryHeaderLayout(pdf, entry, continued);
    let available = PDF_LAYOUT.contentBottom - y - header.height - 0.08;
    if (available < remaining[0].height) {
      y = addPage(pdf, brief);
      continued = true;
      available = PDF_LAYOUT.contentBottom - y - entryHeaderLayout(pdf, entry, true).height - 0.08;
    }
    const segment = [];
    let used = 0;
    while (remaining.length && used + remaining[0].height <= available) {
      const item = remaining.shift();
      segment.push(item);
      used += item.height;
    }
    if (!segment.length) {
      segment.push(remaining.shift());
    }
    y += drawEntrySegment(pdf, entry, segment, y, continued) + 0.18;
    if (remaining.length) {
      y = addPage(pdf, brief);
      continued = true;
    }
  }
  return y;
}

export function createPromotionBriefPdf(brief) {
  const pdf = new jsPDF({orientation: "portrait", unit: "in", format: "letter", compress: true});
  pdf.setLineWidth(0.008);
  let y = PDF_LAYOUT.contentTop;
  drawPageHeader(pdf, brief, 1);

  pdf.setFillColor(247, 247, 248);
  pdf.roundedRect(PDF_LAYOUT.left, y, PDF_LAYOUT.width, 0.72, 0.08, 0.08, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(28, 28, 32);
  pdf.text(String(brief.announcementCount), 0.88, y + 0.31);
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 108);
  pdf.text("PROMOTIONS", 0.88, y + 0.52);
  pdf.setFontSize(14);
  pdf.setTextColor(28, 28, 32);
  pdf.text(String(brief.entries.length), 2.46, y + 0.31);
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 108);
  pdf.text("CAMPAIGNS + CONTENT", 2.46, y + 0.52);
  pdf.setFontSize(14);
  pdf.setTextColor(brief.attentionCount ? 203 : 44, brief.attentionCount ? 55 : 138, brief.attentionCount ? 45 : 82);
  pdf.text(String(brief.attentionCount), 5.48, y + 0.31);
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 108);
  pdf.text("NEED ATTENTION", 5.48, y + 0.52);
  y += 0.9;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(95, 95, 103);
  pdf.text("INCLUDED PROMOTION TYPES", PDF_LAYOUT.left, y);
  y += 0.18;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(45, 45, 50);
  const typeLines = wrap(pdf, brief.announcementTypes.join("  |  ") || "None selected", 7.26);
  pdf.text(typeLines, PDF_LAYOUT.left, y, {lineHeightFactor: 1});
  y += typeLines.length * 0.15 + 0.3;
  pdf.setDrawColor(229, 229, 232);
  pdf.line(PDF_LAYOUT.left, y - 0.15, PDF_LAYOUT.right, y - 0.15);

  if (!brief.entries.length) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(60, 60, 66);
    pdf.text("No matching promotions", 0.62, y + 0.3);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(105, 105, 112);
    pdf.text("Adjust the date range or included promotion types and generate the brief again.", 0.62, y + 0.55);
  }

  brief.entries.forEach((entry) => {
    y = drawEntry(pdf, brief, entry, y);
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(225, 225, 229);
    pdf.line(0.62, 10.52, 7.88, 10.52);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(125, 125, 132);
    pdf.text("Generated by CrossPointe Central Promotion Planner", 0.62, 10.72);
    pdf.text(`${page} / ${pageCount}`, 7.88, 10.72, {align: "right"});
  }

  pdf.setProperties({
    title: brief.title,
    subject: "Promotion brief generated by CrossPointe Central",
    creator: "CrossPointe Central Promotion Planner",
  });
  return {
    pdf,
    filename: `${safeFilename(brief.title)}-${brief.startDate || "report"}.pdf`,
  };
}

export function downloadPromotionBriefPdf(brief) {
  const result = createPromotionBriefPdf(brief);
  result.pdf.save(result.filename);
  return {filename: result.filename, pages: result.pdf.getNumberOfPages()};
}

export function promotionBriefPdfAttachment(brief) {
  const result = createPromotionBriefPdf(brief);
  const dataUri = result.pdf.output("datauristring");
  return {
    filename: result.filename,
    contentType: "application/pdf",
    base64: String(dataUri).split(",").at(-1) || "",
    pages: result.pdf.getNumberOfPages(),
  };
}

export async function sendPromotionBriefEmail({user, recipients, subject, message, brief, fetchImpl = fetch}) {
  const token = await user?.getIdToken?.();
  if (!token) throw new Error("Sign in to Promotion Planner before sending a brief.");
  const attachment = promotionBriefPdfAttachment(brief);
  const response = await fetchImpl("/api/planner/send-brief", {
    method: "POST",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({recipients, subject, message, brief, attachment}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Central could not send the promotion brief.");
  return data;
}

export {formatBriefDate};
