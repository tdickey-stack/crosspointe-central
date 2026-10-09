import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../functions/index.js", import.meta.url), "utf8");
function mapper(name) {
  const start = source.indexOf(`function ${name}(`);
  const code = source.slice(start, source.indexOf("\n}", start) + 2);
  const context = vm.createContext({
    serializeAdminTimestampForJson_: (value) => value ? new Date(value.toMillis()).toISOString() : "",
    isTruthyValue_: Boolean, normalizeSortValue_: (value) => value || 50,
    getNormalizedCampaignOngoingValue_: () => true,
    normalizeCampaignActionType: () => "contact",
    normalizeCampaignDateValue_: (value) => value,
    CAMPAIGN_ACTION_CONTACT: "contact",
  });
  vm.runInContext(code, context);
  return context[name];
}

test("automatic recency uses first publication without exposing private contact metadata", () => {
  const created = {toMillis: () => Date.parse("2026-09-01T12:00:00Z")};
  const updated = {toMillis: () => Date.parse("2026-10-09T12:00:00Z")};
  for (const name of ["toCentralCampaignFromFirestoreDoc_", "toCentralServeNeedFromFirestoreDoc_"]) {
    const map = mapper(name);
    const data = {createdAt: created, updatedAt: updated, title: "Campaign", need: "Serve",
      contact_email: "private@example.test", publishedToPreviewByEmail: "editor@example.test", active: true};
    const result = map({id: "source", createTime: updated, data: () => data});
    assert.equal(result.published_at, "2026-09-01T12:00:00.000Z");
    assert.equal(result.contact_email, undefined);
    assert.equal(result.publishedToPreviewByEmail, undefined);
    delete data.createdAt;
    assert.equal(map({id: "source", createTime: created, data: () => data}).published_at,
      "2026-09-01T12:00:00.000Z");
  }
});
