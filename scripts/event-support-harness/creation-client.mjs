import { createReadOnlyPcoClient } from './pco-client.mjs';
import { reviewCreation } from './creation-plan.mjs';
import { hash } from './scope.mjs';

const ORIGIN = 'https://api.planningcenteronline.com';
const numericId = value => typeof value === 'string' && /^[1-9]\d*$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const internalErrors = new WeakSet();
const fail = (code, message) => {
  const error = Object.assign(new Error(message), { code });
  internalErrors.add(error);
  return error;
};
const check = (condition, code, message) => { if (!condition) throw fail(code, message); };

function safeJson(value) {
  const visit = node => {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return;
    if (typeof node === 'number' && Number.isFinite(node)) return;
    if (Array.isArray(node)) {
      check(Object.keys(node).length === node.length && Reflect.ownKeys(node).length === node.length + 1,
        'CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
      for (const item of node) visit(item);
      return;
    }
    check(record(node), 'CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
    const prototype = Object.getPrototypeOf(node);
    check(prototype === Object.prototype || prototype === null, 'CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
    for (const key of Reflect.ownKeys(node)) {
      check(typeof key === 'string', 'CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      check(descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value'), 'CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
      visit(descriptor.value);
    }
  };
  visit(value);
  return value;
}

const same = (left, right) => {
  try { return hash(safeJson(left)) === hash(safeJson(right)); }
  catch { return false; }
};
const occurrenceKey = operationKey => operationKey.split(':')[1];
const timeKind = operationKey => operationKey.split(':')[2];

function checkedWritePath(path) {
  check(typeof path === 'string' && path.startsWith('/') && !/[?%\\#\s]/.test(path) && !/(?:^|\/)\.{1,2}(?:\/|$)/.test(path),
    'CREATION_REQUEST_REJECTED', 'Creation request path is not permitted.');
  let url;
  try { url = new URL(path, ORIGIN); } catch { throw fail('CREATION_REQUEST_REJECTED', 'Creation request path is not permitted.'); }
  check(url.origin === ORIGIN && url.pathname === path && !url.username && !url.password && !url.search && !url.hash,
    'CREATION_REQUEST_REJECTED', 'Creation request path is not permitted.');
  return url;
}

function originalPlanIntent(review, key) {
  const operation = review.operations.find(item => item.key === `create-plan:${key}`);
  return {
    path: operation.path,
    type: operation.body.data.type,
    attributes: operation.body.data.attributes,
  };
}

function assertOwnedPlan(state, review, key) {
  const binding = state.bindings?.[key];
  const planId = binding?.planId;
  check(record(binding) && numericId(planId), 'CREATION_JOURNAL_MISMATCH', 'Creation journal does not own the target plan.');
  const intent = originalPlanIntent(review, key);
  const operation = state.operations?.[`create-plan:${key}`];
  check(operation?.status === 'complete' && operation.resourceId === planId && operation.intentHash === hash(intent) &&
    same({ path: operation.path, type: operation.type, attributes: operation.attributes }, intent),
  'CREATION_JOURNAL_MISMATCH', 'Creation journal does not own the target plan.');
  return { binding, planId };
}

function assertJournalShape(state) {
  check(record(state.operations) && record(state.bindings) && !state.reschedule,
    'CREATION_JOURNAL_MISMATCH', 'Creation journal is not valid for this phase.');
  check(Object.keys(state.bindings).every(key => ['A', 'B'].includes(key)),
    'CREATION_JOURNAL_MISMATCH', 'Creation journal bindings are outside the approved scope.');
  for (const binding of Object.values(state.bindings)) {
    check(record(binding) && Object.keys(binding).every(key => ['planId', 'arrival', 'event'].includes(key)) &&
      Object.values(binding).every(numericId),
    'CREATION_JOURNAL_MISMATCH', 'Creation journal bindings are outside the approved scope.');
  }
}

const replace = (value, placeholder, planId) => Array.isArray(value)
  ? value.map(item => replace(item, placeholder, planId))
  : record(value)
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item, placeholder, planId)]))
    : typeof value === 'string' ? value.replaceAll(placeholder, planId) : value;

function identifyOperation(review, state, method, path, body) {
  const base = `/services/v2/service_types/`;
  const planCreates = review.operations.filter(operation => operation.key.startsWith('create-plan:'));
  if (method === 'POST' && planCreates[0]?.path === path) {
    const matches = planCreates.filter(operation => same(operation.body, body));
    check(matches.length === 1, 'CREATION_REQUEST_REJECTED', 'Creation request is outside the approved manifest.');
    const key = occurrenceKey(matches[0].key);
    check(!state.bindings?.[key]?.planId, 'CREATION_DUPLICATE_WRITE', 'Creation request has already been bound to a plan.');
    return matches[0];
  }

  let operation;
  if (method === 'POST') {
    const matches = review.operations.filter(item => item.key.startsWith('create-time:') && same(item.body, body));
    check(matches.length === 1, 'CREATION_REQUEST_REJECTED', 'Creation request is outside the approved manifest.');
    operation = matches[0];
  } else if (method === 'PATCH') {
    check(record(body?.data) && body.data.type === 'Plan' && numericId(body.data.id), 'CREATION_REQUEST_REJECTED', 'Creation request is outside the approved manifest.');
    const matches = review.operations.filter(item => item.key.startsWith('disable-reminders:') && state.bindings?.[occurrenceKey(item.key)]?.planId === body.data.id);
    check(matches.length === 1, 'CREATION_REQUEST_REJECTED', 'Creation request is outside the approved manifest.');
    operation = matches[0];
  } else {
    throw fail('CREATION_METHOD_REJECTED', 'Only the approved creation POST and PATCH requests are permitted.');
  }

  const key = occurrenceKey(operation.key);
  const { binding, planId } = assertOwnedPlan(state, review, key);
  if (operation.key.startsWith('create-time:')) {
    check(!binding[timeKind(operation.key)], 'CREATION_DUPLICATE_WRITE', 'Creation request has already been bound to a plan time.');
  }
  const placeholder = `<${key}.planId>`;
  const expected = replace(operation, placeholder, planId);
  check(path.startsWith(base) && path === expected.path && same(body, expected.body),
    'CREATION_REQUEST_REJECTED', 'Creation request is outside the approved manifest.');
  return expected;
}

function assertJournalIntent(state, operation, body) {
  const stored = state.operations?.[operation.key];
  check(stored?.status === 'intent', 'CREATION_DUPLICATE_WRITE', 'Creation operation is not in the single-use intent state.');
  if (operation.key.startsWith('disable-reminders:')) {
    const planId = body.data.id;
    const action = {
      key: 'disable-reminders',
      method: 'PATCH',
      path: operation.path,
      type: 'Plan',
      id: planId,
      before: { reminders_disabled: false },
      after: { reminders_disabled: true },
      body,
    };
    check(stored.intentHash === hash(action) && same(stored.action, action),
      'CREATION_JOURNAL_MISMATCH', 'Creation journal intent does not match the approved request.');
    return;
  }
  const intent = {
    path: operation.path,
    type: body.data.type,
    attributes: body.data.attributes,
  };
  check(stored.intentHash === hash(intent) && same({ path: stored.path, type: stored.type, attributes: stored.attributes }, intent),
    'CREATION_JOURNAL_MISMATCH', 'Creation journal intent does not match the approved request.');
}

function validResponse(payload, operation, body) {
  const data = payload?.data;
  return record(payload) && record(data) && data.type === body.data.type && numericId(data.id) && record(data.attributes) &&
    (operation.method !== 'PATCH' || data.id === body.data.id) && payload.errors === undefined;
}

/**
 * A write client constrained to the reviewed eight-operation creation manifest.
 * GET behavior is the unchanged bounded read-only transport.
 */
export function createCreationPcoClient({
  scope,
  approvalHash,
  journal,
  appId,
  secret,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
  ...readOptions
} = {}) {
  const review = reviewCreation(scope);
  check(review.blockers.length === 0, 'CREATION_BLOCKED', 'Creation review has unresolved blockers.');
  check(typeof approvalHash === 'string' && approvalHash === review.approvalHash,
    'CREATION_APPROVAL_REQUIRED', 'Creation requires the exact reviewed approval hash.');
  check(journal && typeof journal.inspect === 'function', 'INVALID_CREATION_CONFIGURATION', 'Creation journal is required.');

  // Constructing the authenticated read transport happens only after offline
  // scope review and explicit hash approval have succeeded.
  const reader = createReadOnlyPcoClient({ appId, secret, fetchImpl, timeoutMs, ...readOptions });
  const authorization = `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}`;
  const dispatched = new Set();

  async function request(method, path, body) {
    if (method === 'GET') return reader.request(method, path, body);
    check(method === 'POST' || method === 'PATCH', 'CREATION_METHOD_REJECTED', 'Only the approved creation POST and PATCH requests are permitted.');
    const url = checkedWritePath(path);
    let requestBody;
    try { safeJson(body); requestBody = structuredClone(body); }
    catch (error) {
      if (internalErrors.has(error)) throw error;
      throw fail('CREATION_REQUEST_REJECTED', 'Creation request body is not permitted.');
    }

    let state;
    try { state = await journal.inspect(); }
    catch { throw fail('CREATION_JOURNAL_INVALID', 'Creation journal could not be inspected safely.'); }
    check(record(state) && state.scopeHash === review.scopeHash, 'CREATION_SCOPE_MISMATCH', 'Creation journal scope does not match the approved scope.');
    assertJournalShape(state);
    const operation = identifyOperation(review, state, method, path, requestBody);
    assertJournalIntent(state, operation, requestBody);
    check(!dispatched.has(operation.key), 'CREATION_DUPLICATE_WRITE', 'Creation operation has already been dispatched by this client.');
    dispatched.add(operation.key);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.href, {
        method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Authorization: authorization,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'X-PCO-API-Version': '2018-11-01',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response || response.redirected || response.status < 200 || response.status >= 300 ||
          response.status >= 300 && response.status < 400 || response.url && response.url !== url.href) {
        throw fail('PCO_WRITE_OUTCOME_UNKNOWN', 'PCO write outcome is uncertain; inspect the journal and remote state before continuing.');
      }
      let payload;
      try { payload = await response.json(); } catch { throw fail('PCO_WRITE_OUTCOME_UNKNOWN', 'PCO write outcome is uncertain; inspect the journal and remote state before continuing.'); }
      check(validResponse(payload, operation, requestBody), 'PCO_WRITE_OUTCOME_UNKNOWN', 'PCO write outcome is uncertain; inspect the journal and remote state before continuing.');
      return payload;
    } catch {
      throw fail('PCO_WRITE_OUTCOME_UNKNOWN', 'PCO write outcome is uncertain; inspect the journal and remote state before continuing.');
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({
    mode: 'live-creation',
    request,
    get: path => request('GET', path),
    collection: reader.collection,
  });
}
