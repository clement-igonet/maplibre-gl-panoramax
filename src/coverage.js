// Coverage layer filters & themes (#2): MapLibre filter/paint expressions
// over the properties the Panoramax vector tiles actually carry (decoded from
// api.panoramax.xyz/api/map tiles, 2026-08-12):
//
//   pictures:  id, ts ("YYYY-MM-DD hh:mm:ss…"), heading, account_id, type,
//              model, sequences (JSON-string id array), first_sequence,
//              h_pixel_density, gps_accuracy
//   sequences: id, account_id, model, type, date ("YYYY-MM-DD"),
//              h_pixel_density, gps_accuracy
//
// Everything here is pure expression building (offline-testable);
// setCoverageFilter/applyCoverageTheme only hand the results to the map.
import { PICTURES_LAYER, SEQUENCES_LAYER } from './client.js';

// Date of a feature as a comparable "YYYY-MM-DD" string, per layer: sequences
// carry `date` directly; pictures carry a timestamp — slice its date prefix.
const dateExpr = (layer) =>
    layer === 'pictures' ? ['slice', ['get', 'ts'], 0, 10] : ['get', 'date'];

/**
 * MapLibre filter expressions for a coverage criteria set.
 *
 * @param {object} [criteria]
 * @param {'equirectangular'|'flat'} [criteria.type] picture type
 * @param {string} [criteria.from] inclusive ISO date lower bound (YYYY-MM-DD)
 * @param {string} [criteria.to] inclusive ISO date upper bound (YYYY-MM-DD)
 * @param {string} [criteria.user] account id (the tiles carry ids, not names)
 * @param {string} [criteria.model] exact camera model string (e.g. "GoPro Max")
 * @param {string} [criteria.collection] sequence id — sequences match their id,
 *   pictures match membership (their `sequences` property is a JSON string,
 *   so substring `in` is exact enough for UUIDs)
 * @returns {{pictures: Array|null, sequences: Array|null}} one filter per
 *   layer, null when the criteria set constrains nothing
 */
export function coverageFilter({ type, from, to, user, model, collection } = {}) {
    const build = (layer) => {
        const parts = [];
        if (type) parts.push(['==', ['get', 'type'], type]);
        if (from) parts.push(['>=', dateExpr(layer), from]);
        if (to) parts.push(['<=', dateExpr(layer), to]);
        if (user) parts.push(['==', ['get', 'account_id'], user]);
        if (model) parts.push(['==', ['get', 'model'], model]);
        if (collection) {
            parts.push(layer === 'pictures'
                ? ['in', collection, ['get', 'sequences']]
                : ['==', ['get', 'id'], collection]);
        }
        return parts.length ? ['all', ...parts] : null;
    };
    return { pictures: build('pictures'), sequences: build('sequences') };
}

// Applies (or clears, with {}) a criteria set on both coverage layers.
// Returns the expressions it set, for inspection/tests.
export function setCoverageFilter(map, criteria = {}) {
    const f = coverageFilter(criteria);
    if (map.getLayer(SEQUENCES_LAYER)) map.setFilter(SEQUENCES_LAYER, f.sequences);
    if (map.getLayer(PICTURES_LAYER)) map.setFilter(PICTURES_LAYER, f.pictures);
    return f;
}

// Capture-year colour ramp (the web-viewer's age theme, reduced to steps):
// older = cooler/grey, recent = warm. Steps chosen so "this year vs last year
// vs older" reads at a glance; rebase yearly via the `now` option.
export function ageColorExpression(layer, { now = 2026 } = {}) {
    const year = ['to-number', ['slice', dateExpr(layer), 0, 4]];
    return ['step', year,
        '#9e9e9e', // before now-4: grey
        now - 4, '#7986cb',
        now - 2, '#ffb300',
        now, '#e53935', // this year: red-hot
    ];
}

const DEFAULT_PAINTS = {
    [SEQUENCES_LAYER]: { 'line-color': '#ff6f00' },
    [PICTURES_LAYER]: { 'circle-color': ['case', ['==', ['get', 'type'], 'equirectangular'], '#2962ff', '#ff6f00'] },
};

/**
 * Coverage theme: 'default' restores addPanoramaxLayers() colours, 'age'
 * colours both layers by capture year. Returns the paint values applied.
 */
export function applyCoverageTheme(map, theme = 'default', options = {}) {
    const paints = theme === 'age'
        ? {
            [SEQUENCES_LAYER]: { 'line-color': ageColorExpression('sequences', options) },
            [PICTURES_LAYER]: { 'circle-color': ageColorExpression('pictures', options) },
        }
        : DEFAULT_PAINTS;
    for (const [layer, props] of Object.entries(paints)) {
        if (!map.getLayer(layer)) continue;
        for (const [prop, value] of Object.entries(props)) {
            map.setPaintProperty(layer, prop, value);
        }
    }
    return paints;
}
