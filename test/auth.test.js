import {describe, expect, test} from 'vitest';
import {claimPollDelays, parseGeneratedToken, tokenGenerateRequest, whoAmIRequest} from '../src/auth.js';

describe('token claim flow builders', () => {
    test('generate: bodyless POST (a CORS simple request, no preflight)', () => {
        const req = tokenGenerateRequest('https://panoramax.openstreetmap.fr/api', 'my app');
        expect(req.url).toBe('https://panoramax.openstreetmap.fr/api/auth/tokens/generate?description=my%20app');
        expect(req.init).toEqual({method: 'POST'}); // no Content-Type → no preflight
        expect(() => tokenGenerateRequest('')).toThrow();
    });

    test('parseGeneratedToken: jwt + claim link (rel or ref spelling)', () => {
        expect(parseGeneratedToken({jwt_token: 'eyJx', links: [{rel: 'claim', href: 'https://x/claim'}]}))
            .toEqual({jwt: 'eyJx', claimUrl: 'https://x/claim'});
        expect(parseGeneratedToken({jwt_token: 'eyJy', links: [{ref: 'claim', href: 'https://y/claim'}]}))
            .toEqual({jwt: 'eyJy', claimUrl: 'https://y/claim'});
        expect(parseGeneratedToken({links: [{rel: 'claim', href: 'https://x'}]})).toBeNull();
        expect(parseGeneratedToken({jwt_token: 'eyJ', links: [{rel: 'self', href: 'https://x'}]})).toBeNull();
        expect(parseGeneratedToken(undefined)).toBeNull();
    });

    test('whoAmI: bearer-authenticated users/me probe', () => {
        const req = whoAmIRequest('https://x/api', 'eyJz');
        expect(req.url).toBe('https://x/api/users/me');
        expect(req.init.headers.Authorization).toBe('Bearer eyJz');
        expect(() => whoAmIRequest('https://x/api', '')).toThrow();
    });

    test('claimPollDelays: quick first, relaxed after, ~3 min total', () => {
        const d = claimPollDelays();
        expect(d[0]).toBe(2000);
        expect(d[d.length - 1]).toBe(5000);
        expect(d.reduce((a, b) => a + b, 0)).toBe(180000);
    });
});
