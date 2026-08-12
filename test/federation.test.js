import { describe, expect, test } from 'vitest';
import { instanceForPicture, instancesRequest, parseInstances } from '../src/federation.js';

const RAW = {
    instances: [
        {
            id: 'b', name: 'osm-fr', url: 'https://panoramax.openstreetmap.fr/',
            configuration: { auth: { enabled: true } },
            last_succesful_harvest: '2026-08-12T06:00:00Z',
            extent: { temporal: { interval: [['2022-01-01T00:00:00Z', '2026-08-01T00:00:00Z']] } },
        },
        { id: 'a', name: 'bikespace', url: 'https://panoramax.bikespaceproject.ca' },
        { id: 'x', url: 'https://nameless.example' }, // dropped: no name
        { id: 'y', name: 'urlless' }, // dropped: no url
    ],
};

describe('parseInstances', () => {
    test('normalizes, derives apiBase, drops incomplete, sorts by name', () => {
        const list = parseInstances(RAW);
        expect(list.map((i) => i.name)).toEqual(['bikespace', 'osm-fr']);
        const osm = list[1];
        expect(osm.url).toBe('https://panoramax.openstreetmap.fr'); // slash stripped
        expect(osm.apiBase).toBe('https://panoramax.openstreetmap.fr/api');
        expect(osm.authEnabled).toBe(true);
        expect(osm.lastHarvest).toBe('2026-08-12T06:00:00Z');
        expect(osm.temporal).toEqual(['2022-01-01T00:00:00Z', '2026-08-01T00:00:00Z']);
        expect(list[0].authEnabled).toBe(false);
    });

    test('empty/missing payloads parse to []', () => {
        expect(parseInstances(undefined)).toEqual([]);
        expect(parseInstances({})).toEqual([]);
    });
});

describe('instanceForPicture', () => {
    const instances = parseInstances(RAW);

    test('matches a picture homeApi to its instance, slash/suffix tolerant', () => {
        for (const home of [
            'https://panoramax.openstreetmap.fr/api',
            'https://panoramax.openstreetmap.fr/api/',
            'https://panoramax.openstreetmap.fr',
        ]) {
            expect(instanceForPicture({ homeApi: home }, instances)?.name).toBe('osm-fr');
        }
    });

    test('unknown or missing home → null', () => {
        expect(instanceForPicture({ homeApi: 'https://elsewhere.example/api' }, instances)).toBeNull();
        expect(instanceForPicture({}, instances)).toBeNull();
    });
});

describe('instancesRequest', () => {
    test('builds the directory request against any apiBase', () => {
        expect(instancesRequest().url).toBe('https://api.panoramax.xyz/api/instances');
        expect(instancesRequest('https://x/api').url).toBe('https://x/api/instances');
    });
});
