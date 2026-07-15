import crypto from "node:crypto";

import {
  authenticateWayfinderAdminRequest,
  createWayfinderAccessError,
} from "./access.js";
import {
  WAYFINDER_EVALUATION_CASES,
  WAYFINDER_EVALUATION_CATEGORIES,
  WAYFINDER_EVALUATION_LIBRARY_VERSION,
} from "./evaluation-cases.js";

const RUNS_COLLECTION = "centralAssistantEvaluationRunsDraft";
const STATE_DOC = "centralAssistantEvaluationStateDraft/shuffleBag";
const RECENT_RUN_LIMIT = 10;

export function createWayfinderEvaluationHandler(dependencies) {
  const firestore = dependencies.firestore;
  return async (request, response) => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.status(405).json({error: "Method not allowed."});
      return;
    }
    try {
      const authResult = await authenticateWayfinderAdminRequest({
        request: request,
        admin: dependencies.admin,
        firestore: firestore,
        isAllowedAdminEmail: dependencies.isAllowedAdminEmail,
        getAdminUserDocPath: dependencies.getAdminUserDocPath,
      });
      const action = String(request.body && request.body.action || "list")
          .trim().toLowerCase();
      if (action === "list") {
        response.status(200).json({
          ok: true,
          libraryVersion: WAYFINDER_EVALUATION_LIBRARY_VERSION,
          librarySize: WAYFINDER_EVALUATION_CASES.length,
          runs: await listRuns_(firestore),
        });
        return;
      }
      let cases;
      let replayOf = "";
      if (action === "run") {
        cases = await drawCases_(firestore, dependencies.random || Math.random);
      } else if (action === "rerun") {
        replayOf = validateRunId_(request.body && request.body.runId);
        const previous = await firestore.collection(RUNS_COLLECTION)
            .doc(replayOf).get();
        if (!previous.exists) {
          throw createWayfinderAccessError(
              404, "That evaluation run was not found.");
        }
        const ids = Array.isArray(previous.data().caseIds) ?
          previous.data().caseIds : [];
        cases = ids.map(findCase_).filter(Boolean);
        if (cases.length !== WAYFINDER_EVALUATION_CATEGORIES.length) {
          throw createWayfinderAccessError(
              409, "That older evaluation set cannot be replayed.");
        }
      } else {
        throw createWayfinderAccessError(400, "Choose list, run, or rerun.");
      }

      const runId = crypto.randomUUID();
      const results = [];
      for (const testCase of cases) {
        const startedAt = Date.now();
        try {
          const answer = await dependencies.executeCase(testCase);
          results.push({
            ...scoreWayfinderEvaluation(testCase, answer),
            durationMs: Date.now() - startedAt,
          });
        } catch (error) {
          results.push({
            caseId: testCase.id,
            category: testCase.category,
            title: testCase.title,
            question: getFinalQuestion_(testCase),
            status: "fail",
            checks: [{
              status: "fail",
              message: "Wayfinder could not answer this test.",
            }],
            answer: "",
            mode: "error",
            error: String(error && error.message || "Evaluation failed."),
            durationMs: Date.now() - startedAt,
          });
        }
      }
      const summary = summarizeResults_(results);
      const now = dependencies.serverTimestamp();
      await firestore.collection(RUNS_COLLECTION).doc(runId).set({
        runId: runId,
        libraryVersion: WAYFINDER_EVALUATION_LIBRARY_VERSION,
        caseIds: cases.map((item) => item.id),
        replayOf: replayOf,
        results: results,
        summary: summary,
        createdAt: now,
        createdByUid: authResult.decodedToken.uid,
        createdByEmail: authResult.decodedToken.email || "",
      });
      response.status(200).json({
        ok: true,
        run: serializeRun_({
          runId: runId,
          libraryVersion: WAYFINDER_EVALUATION_LIBRARY_VERSION,
          caseIds: cases.map((item) => item.id),
          replayOf: replayOf,
          results: results,
          summary: summary,
          createdAt: new Date().toISOString(),
        }),
        runs: await listRuns_(firestore),
      });
    } catch (error) {
      const status = Number(error && error.statusCode) || 500;
      response.status(status).json({
        error: error && error.statusCode ? String(error.message) :
          "Wayfinder evaluations are unavailable right now.",
      });
    }
  };
}

export function selectWayfinderEvaluationCases(
    state = {}, random = Math.random) {
  const remaining = !state.libraryVersion ||
    state.libraryVersion === WAYFINDER_EVALUATION_LIBRARY_VERSION ?
    {...(state.remainingByCategory || {})} : {};
  const selected = [];
  WAYFINDER_EVALUATION_CATEGORIES.forEach((category) => {
    const allIds = WAYFINDER_EVALUATION_CASES
        .filter((item) => item.category === category)
        .map((item) => item.id);
    let bag = Array.isArray(remaining[category]) ?
      remaining[category].filter((id) => allIds.includes(id)) : [];
    if (!bag.length) bag = shuffle_(allIds, random);
    const id = bag.shift();
    remaining[category] = bag;
    selected.push(findCase_(id));
  });
  return {cases: selected.filter(Boolean), remainingByCategory: remaining};
}

export function scoreWayfinderEvaluation(testCase, answer = {}) {
  const expected = testCase.expected || {};
  const checks = [];
  const sourceIds = (Array.isArray(answer.sourceCards) ?
    answer.sourceCards : [])
      .map((card) => String(card && card.id || ""));
  const links = (Array.isArray(answer.sourceCards) ? answer.sourceCards : [])
      .flatMap((card) => Array.isArray(card.links) ? card.links : [])
      .map((link) => String(link && link.url || ""));
  const text = String(answer.answer || "");
  const normalized = text.toLowerCase();

  if (Array.isArray(expected.allowModes)) {
    addCheck_(checks, expected.allowModes.includes(String(answer.mode || "")),
        "Used an expected answer mode.", "Used an unexpected answer mode.");
  }
  if (Array.isArray(expected.sourceIds) && expected.sourceIds.length) {
    addCheck_(checks, expected.sourceIds.some((id) => sourceIds.includes(id)),
        "Used an expected approved source.",
        "Did not use an expected approved source.");
  }
  if (Array.isArray(expected.sourceIdPrefixes) &&
      expected.sourceIdPrefixes.length) {
    addCheck_(checks, expected.sourceIdPrefixes.some((prefix) =>
      sourceIds.some((id) => id.startsWith(prefix))),
    "Used the expected kind of approved source.",
    "Did not use the expected kind of approved source.");
  }
  if (Array.isArray(expected.requiredAny) && expected.requiredAny.length) {
    addCheck_(checks, expected.requiredAny.some((term) =>
      normalized.includes(String(term).toLowerCase())),
    "Included an expected key detail.", "Missed an expected key detail.");
  }
  (expected.requiredAll || []).forEach((term) => {
    addCheck_(checks, normalized.includes(String(term).toLowerCase()),
        "Included a required detail.", "Missed a required detail.");
  });
  (expected.requiredLinks || []).forEach((link) => {
    addCheck_(checks, links.some((url) => url.includes(link)),
        "Included the expected link.", "Did not include the expected link.");
  });
  (expected.forbidden || []).forEach((term) => {
    addCheck_(checks, !normalized.includes(String(term).toLowerCase()),
        "Avoided prohibited wording.", "Used prohibited or unhelpful wording.");
  });
  if (Number(expected.maxWords) > 0) {
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    checks.push({
      status: count <= Number(expected.maxWords) ? "pass" : "warning",
      message: count <= Number(expected.maxWords) ?
        "Stayed concise (" + count + " words)." :
        "May be too long (" + count + " words).",
    });
  }
  if (Array.isArray(expected.expectedPostures) &&
      expected.expectedPostures.length && answer.modelUsed === true) {
    checks.push({
      status: expected.expectedPostures.includes(answer.communicationPosture) ?
        "pass" : "warning",
      message: expected.expectedPostures.includes(answer.communicationPosture) ?
        "Used an appropriate communication posture." :
        "Communication posture may need review.",
    });
  }
  const status = checks.some((check) => check.status === "fail") ? "fail" :
    checks.some((check) => check.status === "warning") ? "warning" : "pass";
  return {
    caseId: testCase.id,
    category: testCase.category,
    title: testCase.title,
    question: getFinalQuestion_(testCase),
    conversation: testCase.conversation,
    status: status,
    checks: checks,
    answer: text,
    mode: String(answer.mode || ""),
    modelUsed: answer.modelUsed === true,
    communicationPosture: String(answer.communicationPosture || "universal"),
    sourceIds: sourceIds,
    links: links,
  };
}

async function drawCases_(firestore, random) {
  let selected = [];
  await firestore.runTransaction(async (transaction) => {
    const ref = firestore.doc(STATE_DOC);
    const snapshot = await transaction.get(ref);
    const draw = selectWayfinderEvaluationCases(
        snapshot.exists ? snapshot.data() : {}, random);
    selected = draw.cases;
    transaction.set(ref, {
      libraryVersion: WAYFINDER_EVALUATION_LIBRARY_VERSION,
      remainingByCategory: draw.remainingByCategory,
      lastCaseIds: selected.map((item) => item.id),
      updatedAt: new Date(),
    }, {merge: true});
  });
  return selected;
}

async function listRuns_(firestore) {
  const snapshot = await firestore.collection(RUNS_COLLECTION)
      .orderBy("createdAt", "desc").limit(RECENT_RUN_LIMIT).get();
  return snapshot.docs.map((doc) => serializeRun_({
    runId: doc.id,
    ...(doc.data() || {}),
  }));
}

function serializeRun_(run) {
  return {
    runId: String(run.runId || ""),
    libraryVersion: String(run.libraryVersion || ""),
    caseIds: Array.isArray(run.caseIds) ? run.caseIds : [],
    replayOf: String(run.replayOf || ""),
    summary: run.summary || {pass: 0, warning: 0, fail: 0, total: 0},
    results: Array.isArray(run.results) ? run.results : [],
    createdAt: toIsoString_(run.createdAt),
  };
}

function summarizeResults_(results) {
  return results.reduce((summary, result) => {
    summary[result.status] += 1;
    summary.total += 1;
    return summary;
  }, {pass: 0, warning: 0, fail: 0, total: 0});
}

function addCheck_(checks, passed, passMessage, failMessage) {
  checks.push({status: passed ? "pass" : "fail",
    message: passed ? passMessage : failMessage});
}

function findCase_(id) {
  return WAYFINDER_EVALUATION_CASES.find((item) => item.id === id);
}

function getFinalQuestion_(testCase) {
  const messages = Array.isArray(testCase.conversation) ?
    testCase.conversation : [];
  return String(messages[messages.length - 1] &&
    messages[messages.length - 1].content || "");
}

function validateRunId_(value) {
  const id = String(value || "").trim();
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    throw createWayfinderAccessError(400, "Choose a valid evaluation run.");
  }
  return id;
}

function shuffle_(values, random) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function toIsoString_(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
