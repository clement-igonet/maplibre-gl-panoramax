import { describe, expect, test } from 'vitest';
import { ageColorExpression, applyCoverageTheme, coverageFilter, setCoverageFilter } from '../src/coverage.js';
import { PICTURES_LAYER, SEQUENCES_LAYER } from '../src/client.js';

// A minimal map double recording setFilter/setPaintProperty calls.
const fakeMap = (layers = [SEQUENCES_LAYER, PICTURES_LAYER]) => {
    const calls = { filters: {}, paints: {} };
    return {
        calls,
        getLayer: (id) => (layers.includes(id) ? { id } : undefined),
        setFilter: (id, f) => { calls.filters[id] = f; },
        setPaintProperty: (id, prop, v) => { (calls.paints[id] ||= {})[prop] = v; },
    };
};

describe('coverageFilter', () => {
    test('empty criteria constrain nothing', () => {
        expect(coverageFilter()).toEqual({ pictures: null, sequences: null });
        expect(coverageFilter({})).toEqual({ pictures: null, sequences: null });
    });

    test('type filters both layers identically', () => {
        const f = coverageFilter({ type: 'equirectangular' });
        expect(f.pictures).toEqual(['all', ['==', ['get', 'type'], 'equirectangular']]);
        expect(f.sequences).toEqual(f.pictures);
    });

    test('date range: sequences compare `date`, pictures slice `ts`', () => {
        const f = coverageFilter({ from: '2024-01-01', to: '2024-12-31' });
        expect(f.sequences).toEqual(['all',
            ['>=', ['get', 'date'], '2024-01-01'],
            ['<=', ['get', 'date'], '2024-12-31']]);
        expect(f.pictures).toEqual(['all',
            ['>=', ['slice', ['get', 'ts'], 0, 10], '2024-01-01'],
            ['<=', ['slice', ['get', 'ts'], 0, 10], '2024-12-31']]);
    });

    test('collection: sequences match id, pictures match membership', () => {
        const f = coverageFilter({ collection: 'abc-123' });
        expect(f.sequences).toEqual(['all', ['==', ['get', 'id'], 'abc-123']]);
        expect(f.pictures).toEqual(['all', ['in', 'abc-123', ['get', 'sequences']]]);
    });

    test('criteria combine under a single all()', () => {
        const f = coverageFilter({ type: 'flat', user: 'u-1', model: 'GoPro Max', from: '2025-01-01' });
        expect(f.sequences[0]).toBe('all');
        expect(f.sequences).toHaveLength(5);
        expect(f.sequences).toContainEqual(['==', ['get', 'account_id'], 'u-1']);
        expect(f.sequences).toContainEqual(['==', ['get', 'model'], 'GoPro Max']);
    });
});

describe('setCoverageFilter', () => {
    test('applies per-layer filters and returns them', () => {
        const map = fakeMap();
        const f = setCoverageFilter(map, { type: 'flat' });
        expect(map.calls.filters[SEQUENCES_LAYER]).toEqual(f.sequences);
        expect(map.calls.filters[PICTURES_LAYER]).toEqual(f.pictures);
    });

    test('clears filters with empty criteria and skips missing layers', () => {
        const map = fakeMap([SEQUENCES_LAYER]);
        setCoverageFilter(map, {});
        expect(map.calls.filters).toEqual({ [SEQUENCES_LAYER]: null });
    });
});

describe('themes', () => {
    test('age ramp steps on the capture year of the right property', () => {
        const seq = ageColorExpression('sequences', { now: 2026 });
        expect(seq[0]).toBe('step');
        expect(seq[1]).toEqual(['to-number', ['slice', ['get', 'date'], 0, 4]]);
        expect(seq).toContain(2026);
        const pic = ageColorExpression('pictures');
        expect(pic[1]).toEqual(['to-number', ['slice', ['slice', ['get', 'ts'], 0, 10], 0, 4]]);
    });

    test('applyCoverageTheme age → default roundtrip restores stock paints', () => {
        const map = fakeMap();
        applyCoverageTheme(map, 'age');
        expect(map.calls.paints[SEQUENCES_LAYER]['line-color'][0]).toBe('step');
        applyCoverageTheme(map, 'default');
        expect(map.calls.paints[SEQUENCES_LAYER]['line-color']).toBe('#ff6f00');
        expect(map.calls.paints[PICTURES_LAYER]['circle-color'][0]).toBe('case');
    });
});
