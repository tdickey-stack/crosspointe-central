/* Under construction. This isn't being used right now. It's just being built out.
* When I finish building it out I will export everything from here and delete all
* function definitions in index.js.
*
* RULES:
*
*
*
* Any functions that reference the firestore object or that reference other functions
* that reference the firestore object should not be in this helpers file so you
* don't have to initialize firestore in multiple locations.
*
* A campaign function should never be imported from helpers.js. It should always
* be declared and defined here and exported from here. Other helpers functions
* it relies upon from helpers.js can be imported from there.
*
*
*
* When you finish moving all non-firestore campaign functions into this file,
* then double check each one to make sure you don't have it declared and defined
* in either functions/helpers/helpers.js or functions/index.js. If it is declared
* and defined in those files as well, then delete it from there and import it
* into index.js.
*
* left off on all campaign-functions from helpers.js being moved to this module and currently bringing over normalizeCampaignsChangeSet_ from index.js
*/

// Campaign functions in index.js that can eventually appear in their own files similar to campaigns/contact.js...
// getFirestoreCampaignsOverride_
// shareCampaignInterest
// queueCampaignInterestNotification_
// buildCampaignContactEmailHtml_
// markCampaignInterestNotificationFailed_
// getFirestoreCampaignsOverride_
// toCentralCampaignFromFirestoreDoc_
// getVisibleCampaignItems_
// normalizeCampaignPublicItem_
// getNormalizedCampaignOngoingValue_
// isCampaignVisible_
// getSubmittedCampaignsChangeSet_
// normalizeCampaignsPayloadItems_
// publishPreviewCampaignsPayload_
// resolveCampaignsApprovalPayload_
// getCurrentCampaignsBaselineItems_
// normalizeCampaignsComparisonItems_
// normalizeCampaignsChangeSet_
// normalizeCampaignComparisonItem_
// summarizeCampaignsChangeSet_
// computeCampaignsChangeSet_
// applyCampaignsChangeSet_
// buildCampaignsChangeRequestSummary_
// summarizeCampaignsSubmittedChangeSet_
// createCampaignsComparisonHash_
// buildPublishedCampaignPayload_

import {
    isActive_,
    isTruthyValue_,
    normalizeSortValue_,
    trimFirestoreStringValue_
} from './helpers'

const CENTRAL_CAMPAIGNS_COLLECTION_PATH = "centralContent/campaigns/items";
const CENTRAL_CAMPAIGNS_META_DOC_PATH = "centralContent/campaigns/meta/state";

function toCentralCampaignFromFirestoreDoc_(snapshot) {
  const data = snapshot && typeof snapshot.data === "function" ?
    snapshot.data() || {} :
    {};
  const ongoing = getNormalizedCampaignOngoingValue_(data);

  return {
    id: String(snapshot && snapshot.id || "").trim(),
    active: isTruthyValue_(data.active) ? "TRUE" : "FALSE",
    title: String(data.title || "").trim(),
    description: String(data.description || "").trim(),
    button_text: String(data.button_text || "").trim(),
    button_url: String(data.button_url || "").trim(),
    ongoing: ongoing ? "TRUE" : "FALSE",
    start_date: ongoing ? "" : normalizeCampaignDateValue_(data.start_date),
    end_date: ongoing ? "" : normalizeCampaignDateValue_(data.end_date),
    sort: normalizeSortValue_(data.sort, 50),
    source: "Firestore",
  };
}

function getNormalizedCampaignOngoingValue_(item) {
  const source = item || {};
  const hasOngoingValue = Object.prototype.hasOwnProperty.call(source, "ongoing");
  const startDate = normalizeCampaignDateValue_(source.start_date);
  const endDate = normalizeCampaignDateValue_(source.end_date);

  if (hasOngoingValue) {
    return isTruthyValue_(source.ongoing);
  }

  return !startDate && !endDate;
}

function getVisibleCampaignItems_(items) {
  const todayKey = dateKey_(new Date(), PCO_TIMEZONE);

  return (Array.isArray(items) ? items : [])
      .map((item) => normalizeCampaignPublicItem_(item))
      .filter((item) => item.title)
      .filter((item) => isCampaignVisible_(item, todayKey))
      .sort(sortBySort_);
}

function isCampaignVisible_(item, todayKey) {
  if (!isActive_(item)) {
    return false;
  }

  if (getNormalizedCampaignOngoingValue_(item)) {
    return true;
  }

  const startDate = normalizeCampaignDateValue_(item && item.start_date);
  const endDate = normalizeCampaignDateValue_(item && item.end_date);

  if (!startDate && !endDate) {
    return true;
  }

  if (startDate && todayKey < startDate) {
    return false;
  }

  if (endDate && todayKey > endDate) {
    return false;
  }

  return true;
}

function areCampaignsComparisonItemsEqual_(currentItem, proposedItem) {
  return String(currentItem && currentItem.title || "") ===
    String(proposedItem && proposedItem.title || "") &&
    String(currentItem && currentItem.description || "") ===
      String(proposedItem && proposedItem.description || "") &&
    String(currentItem && currentItem.button_text || "") ===
      String(proposedItem && proposedItem.button_text || "") &&
    String(currentItem && currentItem.button_url || "") ===
      String(proposedItem && proposedItem.button_url || "") &&
    Boolean(currentItem && currentItem.ongoing) ===
      Boolean(proposedItem && proposedItem.ongoing) &&
    String(currentItem && currentItem.start_date || "") ===
      String(proposedItem && proposedItem.start_date || "") &&
    String(currentItem && currentItem.end_date || "") ===
      String(proposedItem && proposedItem.end_date || "") &&
    Number(currentItem && currentItem.sort || 50) ===
      Number(proposedItem && proposedItem.sort || 50) &&
    Boolean(currentItem && currentItem.active) ===
      Boolean(proposedItem && proposedItem.active);
}

function getCampaignConflictLabel_(proposedItem, currentItem, fallbackId) {
  return trimFirestoreStringValue_(
      proposedItem && proposedItem.title ||
      currentItem && currentItem.title ||
      fallbackId ||
      "this campaign",
  ) || "this campaign";
}

function mapCampaignsComparisonItemsById_(items) {
  const itemsById = new Map();

  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || !item.id) {
      return;
    }

    itemsById.set(item.id, item);
  });

  return itemsById;
}

function normalizeCampaignDateValue_(value) {
  const trimmed = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function normalizeCampaignPublishDocId_(value, index) {
  const candidate = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return candidate || "campaign-" + String(index + 1);
}

function sortCampaignsComparisonItems_(a, b) {
  const sortDelta = Number(a && a.sort || 999) - Number(b && b.sort || 999);
  if (sortDelta !== 0) {
    return sortDelta;
  }

  return String(a && a.id || "").localeCompare(String(b && b.id || ""));
}

function isCampaignVisible_(item, todayKey) {
  if (!isActive_(item)) {
    return false;
  }

  if (getNormalizedCampaignOngoingValue_(item)) {
    return true;
  }

  const startDate = normalizeCampaignDateValue_(item && item.start_date);
  const endDate = normalizeCampaignDateValue_(item && item.end_date);

  if (!startDate && !endDate) {
    return true;
  }

  if (startDate && todayKey < startDate) {
    return false;
  }

  if (endDate && todayKey > endDate) {
    return false;
  }

  return true;
}

function computeCampaignsChangeSet_(baselineItems, proposedItems) {
  const baselineById = mapCampaignsComparisonItemsById_(baselineItems);
  const proposedById = mapCampaignsComparisonItemsById_(proposedItems);
  const upsertItems = [];
  const removeIds = [];

  proposedById.forEach((item, id) => {
    const baselineItem = baselineById.get(id) || null;

    if (!baselineItem || !areCampaignsComparisonItemsEqual_(baselineItem, item)) {
      upsertItems.push(item);
    }
  });

  baselineById.forEach((item, id) => {
    if (!proposedById.has(id)) {
      removeIds.push(id);
    }
  });

  return {
    upsertItems: upsertItems.sort(sortCampaignsComparisonItems_),
    removeIds: removeIds.sort(),
  };
}



export {
    areCampaignsComparisonItemsEqual_,
    computeCampaignsChangeSet_,
    getCampaignConflictLabel_,
    getNormalizedCampaignOngoingValue_,
    getVisibleCampaignItems_,
    isCampaignVisible_,
    mapCampaignsComparisonItemsById_,
    normalizeCampaignDateValue_,
    normalizeCampaignPublishDocId_,
    sortCampaignsComparisonItems_,
    toCentralCampaignFromFirestoreDoc_
}