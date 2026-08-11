// Sign-in to a Panoramax instance from the browser, front-end only, via the
// API's token claim flow:
//   1. POST /auth/tokens/generate (no auth, no body — a CORS "simple request",
//      no preflight) returns a JWT plus a `claim` link;
//   2. the claim URL opens in a new tab where the instance runs its OAuth
//      (OpenStreetMap login) and binds the token to the user's account;
//   3. until then the JWT is unusable — poll GET /users/me with it:
//      401/403 = not claimed yet, 200 = connected (and identifies the account).
// Pure request builders/parsers; the caller owns fetch, tabs and storage.

export function tokenGenerateRequest(apiBase, description = 'maplibre-gl-panoramax') {
    if (!apiBase) throw new Error('tokenGenerateRequest: apiBase is required');
    return {
        url: `${apiBase}/auth/tokens/generate?description=${encodeURIComponent(description)}`,
        init: { method: 'POST' },
    };
}

// The generate response: { jwt_token, links: [{ href, rel|ref }] }. The
// OpenAPI schema names the link-relation key `ref` while the docs say `rel` —
// accept both. null when the response has no usable jwt + claim link.
export function parseGeneratedToken(data) {
    const jwt = typeof data?.jwt_token === 'string' && data.jwt_token ? data.jwt_token : null;
    const claim = (data?.links || []).find(
        (l) => l && (l.rel === 'claim' || l.ref === 'claim') && typeof l.href === 'string'
    );
    return jwt && claim ? { jwt, claimUrl: claim.href } : null;
}

export function whoAmIRequest(apiBase, jwt) {
    if (!apiBase || !jwt) throw new Error('whoAmIRequest: apiBase and jwt are required');
    return {
        url: `${apiBase}/users/me`,
        init: { headers: { Authorization: `Bearer ${jwt}` } },
    };
}

// Poll cadence while the user signs in over in the claim tab: quick at first
// (most sign-ins take seconds), then relaxed — ~3 minutes total. A claim can
// also complete AFTER the poll gives up: keep the pending JWT and re-check it
// at your next natural opportunity (panel open, save click, …).
export function claimPollDelays() {
    const delays = [];
    for (let i = 0; i < 10; i++) delays.push(2000);
    for (let i = 0; i < 32; i++) delays.push(5000);
    return delays; // ≈ 180 s total
}
