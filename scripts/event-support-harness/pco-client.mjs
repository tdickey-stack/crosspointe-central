/** Deliberately read-only: no runtime switch can enable a live mutation. */
const ORIGIN = 'https://api.planningcenteronline.com';
const RESOURCES = [
  /^\/services\/v2\/service_types(?:\/\d+)?$/,
  /^\/services\/v2\/service_types\/\d+\/plans(?:\/\d+(?:\/(?:plan_times|team_members|needed_positions))?)?$/,
  /^\/services\/v2\/service_types\/\d+\/teams(?:\/\d+)?$/,
  /^\/services\/v2\/service_types\/\d+\/plan_times\/\d+$/,
  /^\/services\/v2\/teams\/\d+(?:\/(?:team_positions|team_leaders))?$/,
  /^\/services\/v2\/people\/\d+$/,
  /^\/services\/v2\/people\/\d+\/plan_people\/\d+(?:\/(?:plan_person_times|declined_plan_times))?$/,
  /^\/calendar\/v2\/(?:event_instances|events)\/\d+$/,
];
const internalErrors = new WeakSet();
const fail = (code, message) => { const error = Object.assign(new Error(message), { code }); internalErrors.add(error); return error; };
const paginationKey = key => key === 'offset' || key === 'per_page';
function checkedUrl(path) {
  if (typeof path !== 'string' || /[%\\#\s]/.test(path.split('?')[0]) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)) throw fail('UNSAFE_PCO_URL', 'PCO resource URL is not permitted.');
  let url;
  try { url = new URL(path, ORIGIN); } catch { throw fail('UNSAFE_PCO_URL', 'PCO resource URL is not permitted.'); }
  if (url.origin !== ORIGIN || url.username || url.password || url.hash || !RESOURCES.some(re => re.test(url.pathname))) throw fail('UNSAFE_PCO_URL', 'PCO resource URL is not permitted.');
  const keys = new Set();
  for (const [key, value] of url.searchParams) {
    if (keys.has(key) || !/^(?:include|per_page|offset|filter|order|where\[(?:id|title)\]|fields\[[A-Za-z][A-Za-z0-9]*\])$/.test(key) || value.length > 2000 || /[\x00-\x1f\x7f]/.test(value)) throw fail('UNSAFE_PCO_QUERY', 'PCO query is not permitted.');
    if (paginationKey(key) && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || (key === 'per_page' && (Number(value) < 1 || Number(value) > 100)))) throw fail('UNSAFE_PCO_QUERY', 'PCO pagination query is invalid.');
    keys.add(key);
  }
  return url;
}
function fixedQuery(url) { return JSON.stringify([...url.searchParams].filter(([key]) => !paginationKey(key)).sort(([a], [b]) => a.localeCompare(b))); }
function retryDelay(response, attempt) {
  const value = response?.headers?.get?.('retry-after');
  const parsed = value && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 1000 : value ? Date.parse(value) - Date.now() : NaN;
  return Math.min(2000, Math.max(0, Number.isFinite(parsed) ? parsed : 100 * 2 ** attempt));
}
export function createReadOnlyPcoClient({ appId, secret, fetchImpl = globalThis.fetch, maxPages = 20, timeoutMs = 10000, sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (typeof appId !== 'string' || !appId || typeof secret !== 'string' || !secret || typeof fetchImpl !== 'function' || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 1000 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw fail('INVALID_PCO_CONFIGURATION', 'PCO read client configuration is invalid.');
  const authorization = `Basic ${Buffer.from(`${appId}:${secret}`).toString('base64')}`;
  async function request(method, path, body) {
    // This check precedes URL parsing, credential use, and every fetch.
    if (method !== 'GET') throw fail('LIVE_WRITES_DISABLED', 'Live PCO writes and invitations are disabled.');
    if (body !== undefined) throw fail('INVALID_PCO_REQUEST', 'GET request bodies are not permitted.');
    const url = checkedUrl(path);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetchImpl(url.href, {
          method: 'GET', redirect: 'manual', signal: controller.signal,
          headers: { Authorization: authorization, Accept: 'application/vnd.api+json', 'X-PCO-API-Version': url.pathname.startsWith('/services/') ? '2018-11-01' : '2022-07-07' },
        });
        if (response.redirected || (response.status >= 300 && response.status < 400) || (response.url && response.url !== url.href)) throw fail('PCO_REDIRECT_REJECTED', 'PCO redirects are not permitted.');
        if (response.ok) {
          let payload;
          try { payload = await response.json(); } catch (error) { if (error instanceof SyntaxError) throw fail('MALFORMED_PCO_RESPONSE', 'PCO returned malformed JSON.'); throw error; }
          if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !payload.data || typeof payload.data !== 'object' || payload.errors !== undefined || (payload.included !== undefined && !Array.isArray(payload.included))) throw fail('MALFORMED_PCO_RESPONSE', 'PCO returned malformed resource data.');
          return payload;
        }
        if (!(response.status === 429 || response.status >= 500 && response.status <= 599)) throw fail('PCO_READ_FAILED', 'PCO read request failed.');
      } catch (error) {
        if (internalErrors.has(error)) throw error;
        // Never expose fetch error text: it can contain credentials or response bodies.
        if (attempt === 2) throw fail('PCO_READ_FAILED', 'PCO read request failed after bounded retries.');
      } finally { clearTimeout(timer); }
      if (attempt === 2) throw fail('PCO_READ_FAILED', 'PCO read request failed after bounded retries.');
      try { await sleepImpl(retryDelay(response, attempt)); } catch { throw fail('PCO_READ_FAILED', 'PCO retry wait failed.'); }
    }
  }
  async function collection(path) {
    const initial = checkedUrl(path);
    let next = initial;
    let total;
    const visited = new Set();
    const data = [];
    const included = new Map();
    const seenData = new Set();
    while (next) {
      if (visited.size >= maxPages) throw fail('PCO_PAGE_LIMIT', 'PCO pagination exceeded its page limit.');
      if (visited.has(next.href)) throw fail('PCO_PAGINATION_LOOP', 'PCO pagination repeated a page.');
      visited.add(next.href);
      const page = await request('GET', next.href);
      if ((page.meta !== undefined && (!page.meta || typeof page.meta !== 'object' || Array.isArray(page.meta))) || !Array.isArray(page.data) || (page.links !== undefined && (!page.links || typeof page.links !== 'object' || Array.isArray(page.links)))) throw fail('MALFORMED_PCO_RESPONSE', 'PCO collection data is malformed.');
      const count = page.meta?.total_count;
      if (count !== undefined && (!Number.isSafeInteger(count) || count < 0) || visited.size > 1 && count !== total) throw fail('PCO_COUNT_MISMATCH', 'PCO collection count changed or is invalid.');
      total = count;
      for (const item of page.data) {
        if (!item || typeof item !== 'object' || typeof item.type !== 'string' || typeof item.id !== 'string' || !/^\d+$/.test(item.id)) throw fail('MALFORMED_PCO_RESPONSE', 'PCO collection resource is malformed.');
        const key = `${item.type}:${item.id}`;
        if (seenData.has(key)) throw fail('PCO_DUPLICATE_RESOURCE', 'PCO pagination repeated a resource.');
        seenData.add(key);
        data.push(item);
      }
      for (const item of page.included ?? []) {
        if (!item || typeof item !== 'object' || typeof item.type !== 'string' || typeof item.id !== 'string' || !/^\d+$/.test(item.id)) throw fail('MALFORMED_PCO_RESPONSE', 'PCO included resource is malformed.');
        const key = `${item.type}:${item.id}`;
        if (included.has(key) && JSON.stringify(included.get(key)) !== JSON.stringify(item)) throw fail('PCO_INCONSISTENT_RESOURCE', 'PCO included resource changed during pagination.');
        included.set(key, item);
      }
      const link = page.links?.next;
      if (link !== undefined && link !== null && (typeof link !== 'string' || !link)) throw fail('MALFORMED_PCO_RESPONSE', 'PCO next-page link is malformed.');
      if (link && !page.data.length) throw fail('PCO_INCOMPLETE_COLLECTION', 'PCO pagination returned an empty intermediate page.');
      next = link ? checkedUrl(link) : null;
      if (next && (next.pathname !== initial.pathname || fixedQuery(next) !== fixedQuery(initial))) throw fail('UNSAFE_PCO_PAGINATION', 'PCO next-page link changed the resource or query.');
      if (total !== undefined && (data.length > total || next && data.length >= total || !next && data.length !== total)) throw fail('PCO_COUNT_MISMATCH', 'PCO collection is incomplete or inconsistent.');
    }
    return { data, included: [...included.values()], complete: true };
  }
  return Object.freeze({ mode: 'live-read-only', request, get: path => request('GET', path), collection });
}
