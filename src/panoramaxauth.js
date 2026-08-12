// DEMO SHIM — the token claim flow comes from maplibre-gl-panoramax; only the
// storage policy (which keys, sessionStorage) stays app-side, by design: the
// plugin builds requests, the app owns tokens.
export {
    tokenGenerateRequest,
    parseGeneratedToken,
    whoAmIRequest,
    claimPollDelays,
} from 'maplibre-gl-panoramax';

// Session-only token storage, one per instance (never persisted to disk).
export const TOKEN_KEY = (apiBase) => `mapmax:panoramax-token:${apiBase}`;

// A generated-but-unclaimed JWT survives the poll window here, so a sign-in
// finished after the poll gave up is adopted at the next natural occasion.
export const PENDING_TOKEN_KEY = (apiBase) => `mapmax:panoramax-pending:${apiBase}`;
