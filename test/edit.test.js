import {describe, expect, test} from 'vitest';
import {
    apiBaseFromSelfHref,
    buildPosePatch,
    clampPose,
    homeApiBase,
    normalizeYaw,
    offsetLngLat,
    posePatchRequest,
    readPoseFromExif,
} from '../src/edit.js';

describe('buildPosePatch', () => {
    test('only the components explicitly set', () => {
        expect(buildPosePatch({pitch: 5.5})).toEqual({pitch: 5.5});
        expect(buildPosePatch({pitch: -3, roll: 2, yaw: 180})).toEqual({pitch: -3, roll: 2, yaw: 180});
        expect(buildPosePatch({roll: 0})).toEqual({roll: 0}); // 0 is a real correction
    });

    test('nothing to send → null', () => {
        expect(buildPosePatch({})).toBeNull();
        expect(buildPosePatch({pitch: NaN, yaw: 'x'})).toBeNull();
        expect(buildPosePatch(undefined)).toBeNull();
    });

    test('clamps to the API domains — pitch/roll ±90, yaw [0,360)', () => {
        expect(clampPose({pitch: 120, roll: -95})).toEqual({pitch: 90, roll: -90, yaw: undefined});
        expect(clampPose({yaw: -90}).yaw).toBe(270);
        expect(normalizeYaw(-180)).toBe(180);
        expect(normalizeYaw(725)).toBe(5);
    });
});

describe('posePatchRequest', () => {
    test('URL, method, bearer auth and JSON body', () => {
        const req = posePatchRequest('https://panoramax.openstreetmap.fr/api', 'seq-1', 'pic-1', {pitch: -4, yaw: 180}, 'tok123');
        expect(req.url).toBe('https://panoramax.openstreetmap.fr/api/collections/seq-1/items/pic-1');
        expect(req.init.method).toBe('PATCH');
        expect(req.init.headers.Authorization).toBe('Bearer tok123');
        expect(JSON.parse(req.init.body)).toEqual({pitch: -4, yaw: 180});
    });

    test('corrected position rides in the same PATCH', () => {
        const req = posePatchRequest('https://x/api', 'c', 'i', {pitch: 1}, 't', {latitude: 48.85, longitude: 2.35});
        expect(JSON.parse(req.init.body)).toEqual({pitch: 1, latitude: 48.85, longitude: 2.35});
        const posOnly = posePatchRequest('https://x/api', 'c', 'i', {}, 't', {latitude: 1, longitude: 2});
        expect(JSON.parse(posOnly.init.body)).toEqual({latitude: 1, longitude: 2});
        expect(posePatchRequest('https://x/api', 'c', 'i', {}, 't', {latitude: 1})).toBeNull(); // half a position never sends
    });

    test('token required; ids URL-encoded; empty pose → null', () => {
        expect(() => posePatchRequest('https://x/api', 'c', 'i', {pitch: 1}, '')).toThrow();
        expect(posePatchRequest('https://x/api', 'a/b', 'c d', {roll: 1}, 't').url).toBe('https://x/api/collections/a%2Fb/items/c%20d');
        expect(posePatchRequest('https://x/api', 'c', 'i', {}, 't')).toBeNull();
    });
});

describe('home instance resolution', () => {
    test('prefers the via link (the owning instance)', () => {
        const links = [
            {rel: 'self', href: 'https://api.panoramax.xyz/api/collections/c1/items/i1'},
            {rel: 'via', href: 'https://panoramax.openstreetmap.fr'},
        ];
        expect(homeApiBase(links, links[0].href)).toBe('https://panoramax.openstreetmap.fr/api');
    });

    test('no via link → derived from the self href; null on garbage', () => {
        expect(homeApiBase([], 'https://panoramax.ign.fr/api/collections/c1/items/i1')).toBe('https://panoramax.ign.fr/api');
        expect(apiBaseFromSelfHref('not a url')).toBeNull();
    });
});

describe('readPoseFromExif', () => {
    test('GPano pose fields, string or number', () => {
        expect(readPoseFromExif({'Xmp.GPano.PosePitchDegrees': '2.5', 'Xmp.GPano.PoseRollDegrees': -1})).toEqual({pitch: 2.5, roll: -1});
        expect(readPoseFromExif(undefined)).toEqual({pitch: undefined, roll: undefined});
    });
});

describe('offsetLngLat', () => {
    test('metres east/north to lon/lat at latitude', () => {
        const [lon, lat] = offsetLngLat(2.35, 48.85, 10, -5);
        expect(lat).toBeCloseTo(48.85 - 5 / 111320, 12);
        expect(lon).toBeCloseTo(2.35 + 10 / (111320 * Math.cos((48.85 * Math.PI) / 180)), 12);
        expect(offsetLngLat(2.35, 48.85, 0, 0)).toEqual([2.35, 48.85]);
    });
});
