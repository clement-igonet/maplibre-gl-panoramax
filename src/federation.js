// Federation helpers (#4): the meta-catalog knows every Panoramax instance
// (GET /instances — id, name, url, temporal extent, harvest status, auth
// configuration). These helpers let an app offer instance selection and
// resolve a picture's home instance to a full record (name, auth) — e.g. to
// label the "Connect to Panoramax" button with where the user will sign in.
//
// House style: pure request builders/parsers + thin async conveniences; the
// caller owns fetch and any caching.
import { META_API } from './client.js';

export function instancesRequest(apiBase = META_API) {
    return { url: `${apiBase}/instances`, init: { headers: { Accept: 'application/json' } } };
}

const stripSlash = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '') : u);

// Normalize one raw instance entry. `apiBase` is the url + /api — the value
// client.js/edit.js/auth.js functions take (and what normalizeItem() puts in
// a picture's homeApi).
function normalizeInstance(raw) {
    const url = stripSlash(raw?.url);
    if (!raw?.name || !url) return null;
    return {
        id: raw.id,
        name: raw.name,
        url,
        apiBase: `${url}/api`,
        authEnabled: !!raw.configuration?.auth?.enabled,
        lastHarvest: raw.last_succesful_harvest || raw.last_harvest || null,
        temporal: raw.extent?.temporal?.interval?.[0] || null,
    };
}

// The GET /instances payload → normalized records, name-sorted; entries
// without a name/url are dropped.
export function parseInstances(data) {
    return (data?.instances || [])
        .map(normalizeInstance)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
}

// The instance a picture belongs to: match its homeApi (from normalizeItem)
// against the directory, tolerant of trailing slashes and a present/absent
// /api suffix. null when unknown (e.g. an instance not yet harvested).
export function instanceForPicture(pic, instances) {
    const home = stripSlash(pic?.homeApi);
    if (!home) return null;
    const homeUrl = home.replace(/\/api$/, '');
    return (instances || []).find((i) => i.apiBase === home || i.url === homeUrl) || null;
}

// Async convenience: fetch + parse the directory.
export async function getInstances(apiBase = META_API) {
    const req = instancesRequest(apiBase);
    const res = await fetch(req.url, req.init);
    if (!res.ok) throw new Error(`Panoramax API ${res.status} on /instances`);
    return parseInstances(await res.json());
}
