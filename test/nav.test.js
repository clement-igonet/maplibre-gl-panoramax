import { describe, expect, test } from 'vitest';
import { bearingBetween, distanceMeters, navTargets, offsetMeters, viewerTarget } from '../src/nav.js';
import { offsetLngLat } from '../src/edit.js';

// A picture at lon/lat with the fields navTargets touches.
const pic = (id, lon, lat, extra = {}) => ({
    id, lon, lat,
    heading: 0,
    sequenceId: 'seq-A',
    assets: { sd: `https://x/${id}/sd.jpg` },
    ...extra,
});

// ~9°E 45°N: cos(lat) ≈ 0.707 keeps east/north asymmetry visible.
const HERE = pic('here', 9, 45, { nextId: 'n', prevId: 'p' });

const at = (id, eastM, northM, extra = {}) => {
    const [lon, lat] = offsetLngLat(HERE.lon, HERE.lat, eastM, northM);
    return pic(id, lon, lat, extra);
};

describe('geometry', () => {
    test('offsetMeters roundtrips edit.js offsetLngLat', () => {
        const p = at('x', 12.5, -7.25);
        const { east, north } = offsetMeters(HERE, p);
        expect(east).toBeCloseTo(12.5, 6);
        expect(north).toBeCloseTo(-7.25, 6);
        expect(distanceMeters(HERE, p)).toBeCloseTo(Math.hypot(12.5, 7.25), 6);
    });

    test('bearings: north 0, east 90, south 180, west 270', () => {
        expect(bearingBetween(HERE, at('n', 0, 10))).toBeCloseTo(0, 5);
        expect(bearingBetween(HERE, at('e', 10, 0))).toBeCloseTo(90, 5);
        expect(bearingBetween(HERE, at('s', 0, -10))).toBeCloseTo(180, 5);
        expect(bearingBetween(HERE, at('w', -10, 0))).toBeCloseTo(270, 5);
    });
});

describe('viewerTarget', () => {
    test('maps a normalized picture to the photosphere target shape', () => {
        const t = viewerTarget(pic('t', 2, 48, {
            heading: 143,
            exifPose: { pitch: -2, roll: 1.5 },
            tiles: { width: 5640, cols: 8, rows: 4, url: () => null },
        }));
        expect(t).toMatchObject({ id: 't', lngLat: [2, 48], bearing: 143, panoPitch: -2, panoRoll: 1.5 });
        expect(t.imageUrl).toContain('/t/sd.jpg');
        expect(t.tiles.cols).toBe(8);
    });

    test('falls back sd → hd → thumb and null tiles', () => {
        const t = viewerTarget(pic('u', 2, 48, { assets: { hd: 'https://x/hd.jpg' } }));
        expect(t.imageUrl).toBe('https://x/hd.jpg');
        expect(t.tiles).toBeNull();
    });
});

describe('navTargets', () => {
    test('prev/next are tagged and always kept, even beyond the radius', () => {
        const targets = navTargets(HERE, [
            at('n', 0, 60), // next, 60 m — far beyond maxDistanceM
            at('p', 0, -60), // prev, far too
            at('far', 40, 0), // same sequence, too far → dropped
        ]);
        expect(targets.map((t) => t.relation).sort()).toEqual(['next', 'prev']);
    });

    test('nearby (other sequences) within radius are included and tagged', () => {
        const targets = navTargets(HERE, [
            at('n', 0, 5),
            at('cross', 8, 8, { sequenceId: 'seq-B' }),
            at('farcross', 40, 40, { sequenceId: 'seq-B' }),
        ]);
        const rel = Object.fromEntries(targets.map((t) => [t.pic.id, t.relation]));
        expect(rel).toEqual({ n: 'next', cross: 'nearby' });
    });

    test('sorting: prev/next first, then by distance; self and dupes dropped', () => {
        const targets = navTargets(HERE, [
            HERE, // self — dropped
            at('close', 3, 0, { sequenceId: 'seq-B' }),
            at('closer', 1, 0, { sequenceId: 'seq-B' }),
            at('closer', 1, 0, { sequenceId: 'seq-B' }), // dupe id — dropped
            at('n', 0, 20),
        ]);
        expect(targets.map((t) => t.pic.id)).toEqual(['n', 'closer', 'close']);
    });

    test('caps at maxTargets after prioritizing', () => {
        const crowd = Array.from({ length: 20 }, (_, i) =>
            at(`c${i}`, 2 + i, 0, { sequenceId: 'seq-B' }));
        const targets = navTargets(HERE, [...crowd, at('n', 0, 24)], { maxTargets: 6 });
        expect(targets).toHaveLength(6);
        expect(targets[0].pic.id).toBe('n'); // sequence link outranks closer strangers
    });

    test('ground offsets and bearing match the geometry helpers', () => {
        const [t] = navTargets(HERE, [at('n', 6, 8)]);
        expect(t.east).toBeCloseTo(6, 6);
        expect(t.north).toBeCloseTo(8, 6);
        expect(t.bearingDeg).toBeCloseTo(bearingBetween(HERE, at('n', 6, 8)), 6);
        expect(t.distanceM).toBeCloseTo(10, 6);
    });
});

describe('flat pictures glue (#3)', () => {
    test('flat pictures carry projection + hfov, no tiles', () => {
        const t = viewerTarget(pic('f', 2, 48, {type: 'flat', hfov: 62, tiles: {cols: 8}}));
        expect(t.projection).toBe('flat');
        expect(t.hfov).toBe(62);
        expect(t.tiles).toBeNull();
    });

    test('360 pictures stay untouched (no projection field, tiles kept)', () => {
        const t = viewerTarget(pic('e', 2, 48, {type: 'equirectangular', hfov: 360, tiles: {cols: 8}}));
        expect(t.projection).toBeUndefined();
        expect(t.hfov).toBeUndefined();
        expect(t.tiles).toEqual({cols: 8});
    });
});
