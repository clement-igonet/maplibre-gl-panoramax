import {describe, expect, test} from 'vitest';
import {idFromHref, normalizeItem, tilesFromStac} from '../src/client.js';

// A trimmed meta-catalog item, as /collections/:id/items returns it (the
// /search serializer strips asset_templates + tiles:tile_matrix_sets).
const stacItem = {
    id: 'pic-1',
    collection: 'seq-1',
    geometry: {coordinates: [2.35, 48.85]},
    properties: {
        'view:azimuth': 208,
        'geovisio:rank_in_collection': 3,
        'geovisio:producer': 'someone',
        'pers:interior_orientation': {field_of_view: 360},
        exif: {
            'Xmp.GPano.ProjectionType': 'equirectangular',
            'Xmp.GPano.PosePitchDegrees': '1.5',
        },
        'tiles:tile_matrix_sets': {
            geovisio: {tileMatrix: [{matrixWidth: 8, matrixHeight: 4, tileWidth: 720, tileHeight: 720}]},
        },
    },
    asset_templates: {tiles: {href: 'https://cdn.example/{TileCol}/{TileRow}.jpg'}},
    assets: {sd: {href: 'sd.jpg'}, hd: {href: 'hd.jpg'}},
    links: [
        {rel: 'self', href: 'https://api.panoramax.xyz/api/collections/seq-1/items/pic-1'},
        {rel: 'via', href: 'https://panoramax.openstreetmap.fr'},
        {rel: 'next', href: 'https://api.panoramax.xyz/api/collections/seq-1/items/aaaaaaaa-0000-0000-0000-000000000002'},
    ],
};

describe('normalizeItem', () => {
    test('flattens the STAC feature: type, home instance, pose, tiles', () => {
        const pic = normalizeItem(stacItem);
        expect(pic).toMatchObject({
            id: 'pic-1',
            lon: 2.35,
            lat: 48.85,
            heading: 208,
            type: 'equirectangular',
            sequenceId: 'seq-1',
            rankInSequence: 3,
            homeApi: 'https://panoramax.openstreetmap.fr/api',
        });
        expect(pic.exifPose.pitch).toBe(1.5);
        expect(pic.nextId).toBe('aaaaaaaa-0000-0000-0000-000000000002');
        expect(pic.tiles).toMatchObject({width: 5760, cols: 8, rows: 4});
        expect(pic.tiles.url(2, 1)).toBe('https://cdn.example/2/1.jpg');
    });

    test('a 2:1 flat frame is NOT claimed as a photosphere', () => {
        const flat = normalizeItem({
            ...stacItem,
            properties: {...stacItem.properties, exif: {}, 'pers:interior_orientation': {field_of_view: 70}},
        });
        expect(flat.type).toBe('flat');
        expect(flat.hfov).toBe(70);
    });
});

describe('tilesFromStac', () => {
    test('null without the matrix or the template', () => {
        expect(tilesFromStac({properties: {}})).toBeNull();
        expect(tilesFromStac({...stacItem, asset_templates: {}})).toBeNull();
    });

    test('prefers the webp template when both exist', () => {
        const t = tilesFromStac({
            ...stacItem,
            asset_templates: {
                tiles: {href: 'https://cdn.example/{TileCol}/{TileRow}.jpg'},
                tiles_webp: {href: 'https://cdn.example/{TileCol}/{TileRow}.webp'},
            },
        });
        expect(t.url(0, 0)).toBe('https://cdn.example/0/0.webp');
    });
});

describe('idFromHref', () => {
    test('extracts item ids, null otherwise', () => {
        expect(idFromHref('https://x/api/collections/c/items/0098117e-f71f-458d-93f3-21487146e320')).toBe('0098117e-f71f-458d-93f3-21487146e320');
        expect(idFromHref('https://x/api/collections/c')).toBeNull();
        expect(idFromHref(undefined)).toBeNull();
    });
});
