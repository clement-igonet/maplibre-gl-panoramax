// Panoramax catalog client + MapLibre layers.
//
// Reads default to the federated meta-catalog (api.panoramax.xyz), which
// aggregates every instance; each normalized picture carries `homeApi` — the
// owning instance — because edits (PATCH) and sign-in must target it, never
// the read-only catalog. All functions take an optional apiBase override for
// single-instance deployments.
import { homeApiBase, readPoseFromExif } from './edit.js';

export const META_API = 'https://api.panoramax.xyz/api';

export const SOURCE_ID = 'panoramax';
export const SEQUENCES_LAYER = 'panoramax-sequences';
export const PICTURES_LAYER = 'panoramax-pictures';

// --- Map layers -------------------------------------------------------------
// Coverage as vector tiles: sequence lines from z0, clickable picture dots
// from z17 (a whole city of dots at once is tens of MB — lines carry the
// overview cheaply).

export function addPanoramaxLayers(map, { apiBase = META_API, picturesMinZoom = 17 } = {}) {
    if (map.getSource(SOURCE_ID)) return;
    map.addSource(SOURCE_ID, {
        type: 'vector',
        tiles: [`${apiBase}/map/{z}/{x}/{y}.mvt`],
        minzoom: 0,
        maxzoom: 15,
        attribution: '© <a href="https://panoramax.fr">Panoramax</a> contributors',
    });
    map.addLayer({
        id: SEQUENCES_LAYER,
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'sequences',
        paint: {
            'line-color': '#ff6f00',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3],
            'line-opacity': 0.75,
        },
    });
    map.addLayer({
        id: PICTURES_LAYER,
        type: 'circle',
        source: SOURCE_ID,
        'source-layer': 'pictures',
        minzoom: picturesMinZoom,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 17, 4, 22, 8],
            'circle-color': ['case', ['==', ['get', 'type'], 'equirectangular'], '#2962ff', '#ff6f00'],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.2,
            'circle-opacity': 0.9,
        },
    });
    for (const layer of [PICTURES_LAYER, SEQUENCES_LAYER]) {
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
}

export function onPictureClick(map, handler) {
    map.on('click', PICTURES_LAYER, (e) => {
        const f = e.features && e.features[0];
        if (f) handler(f.properties.id, f);
    });
}

// --- STAC API ---------------------------------------------------------------

async function stac(path, apiBase) {
    const res = await fetch(`${apiBase}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Panoramax API ${res.status} on ${path}`);
    return res.json();
}

export const idFromHref = (href) => {
    const m = href && href.match(/\/items\/([0-9a-f-]+)/i);
    return m ? m[1] : null;
};

// Tiled HD derivate (STAC tiled-assets) → a maplibre-gl-photosphere `tiles`
// config for progressive refinement. NOTE: the meta-catalog includes these
// fields on /collections/:id/items but STRIPS them from /search — pictures
// from a search need fetchTilesConfig() before entering a viewer.
export function tilesFromStac(f) {
    const matrix = f?.properties?.['tiles:tile_matrix_sets']?.geovisio?.tileMatrix?.[0];
    const template = (f?.asset_templates?.tiles_webp || f?.asset_templates?.tiles)?.href;
    if (!matrix || !template) return null;
    return {
        width: Math.round(matrix.matrixWidth * matrix.tileWidth),
        cols: matrix.matrixWidth,
        rows: matrix.matrixHeight,
        url: (col, row) => template.replace(/\{TileCol\}/g, col).replace(/\{TileRow\}/g, row),
    };
}

// One small item fetch to recover the tiles config a /search result lacks.
export async function fetchTilesConfig(pic, apiBase = META_API) {
    if (!pic?.sequenceId || !pic?.id) return null;
    const f = await stac(`/collections/${encodeURIComponent(pic.sequenceId)}/items/${encodeURIComponent(pic.id)}`, apiBase);
    return tilesFromStac(f);
}

// STAC feature → a flat picture object. A full photosphere is claimed ONLY on
// authoritative 360° metadata (GPano equirectangular tag, ~360° field of view,
// or the STAC `pano` flag) — a 2:1 sensor ratio alone also matches flat
// wide-camera frames, so it deliberately does NOT count.
export function normalizeItem(f) {
    const p = f.properties || {};
    const links = f.links || [];
    const io = p['pers:interior_orientation'] || {};
    const gpano = p.exif && p.exif['Xmp.GPano.ProjectionType'];
    const fov = io.field_of_view;
    const type =
        gpano === 'equirectangular' ? 'equirectangular'
            : (typeof fov === 'number' && fov >= 355) || p['pano'] === true ? 'equirectangular'
                : 'flat';
    return {
        id: f.id,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        heading: p['view:azimuth'] ?? 0,
        // True when the camera wrote a magnetometer heading — then view:azimuth
        // is the real image-centre direction. Absent, it is track-derived and a
        // backward mount reads 180° off.
        hasCompass: !!(p.exif && p.exif['Exif.GPSInfo.GPSImgDirection']),
        hfov: io.field_of_view || (type === 'equirectangular' ? 360 : 70),
        type,
        sequenceId: f.collection,
        rankInSequence: p['geovisio:rank_in_collection'],
        nextId: idFromHref((links.find((l) => l.rel === 'next') || {}).href),
        prevId: idFromHref((links.find((l) => l.rel === 'prev') || {}).href),
        assets: {
            hd: f.assets?.hd?.href,
            sd: f.assets?.sd?.href,
            thumb: f.assets?.thumb?.href || p['geovisio:thumbnail'],
        },
        producer: p['geovisio:producer'],
        license: p.license,
        datetime: p.datetime,
        // Where edits/sign-in must go (the read-only meta-catalog PATCHes 405).
        homeApi: homeApiBase(links, (links.find((l) => l.rel === 'self') || {}).href),
        exifPose: readPoseFromExif(p.exif),
        tiles: tilesFromStac(f),
    };
}

export async function getPicture(id, apiBase = META_API) {
    const data = await stac(`/search?ids=${encodeURIComponent(id)}`, apiBase);
    const f = data.features && data.features[0];
    if (!f) throw new Error(`Picture ${id} not found`);
    return normalizeItem(f);
}

// Pictures within `radiusM` metres around lon/lat (bbox approximation).
export async function searchNearby(lon, lat, radiusM = 30, limit = 50, apiBase = META_API) {
    const dLat = radiusM / 111320;
    const dLon = dLat / Math.cos((lat * Math.PI) / 180);
    const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
    const data = await stac(`/search?bbox=${bbox}&limit=${limit}`, apiBase);
    return (data.features || []).map(normalizeItem);
}

// A whole street in capture order: a Panoramax collection is a sequence.
export async function getSequence(collectionId, limit = 200, apiBase = META_API) {
    const data = await stac(`/collections/${encodeURIComponent(collectionId)}/items?limit=${limit}`, apiBase);
    return (data.features || [])
        .map(normalizeItem)
        .sort((a, b) => (a.rankInSequence ?? 0) - (b.rankInSequence ?? 0));
}
