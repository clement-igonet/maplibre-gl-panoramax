// Sequence graph & navigation targets (#1): turn normalized pictures into
// the ready-to-render street-view set a viewer consumes — a target to enter
// (maplibre-gl-photosphere's enter()/goTo() shape) plus, for each reachable
// neighbour, the ground offsets and bearing its arrows/dots need
// (setNavArrows / setNavPois / groundPick ids).
//
// Everything except navigationSet() is pure and offline-testable: geometry is
// the same equirectangular local approximation as edit.js (exact enough for
// street-distance hops), selection is deterministic. The caller owns what to
// render; this module only decides WHAT is reachable and WHERE it is.
import { META_API, searchNearby } from './client.js';

const M_PER_DEG_LAT = 111320;

// Ground offset in metres (east, north) from `from` to `to` — the shape
// maplibre-gl-photosphere's setNavPois expects.
export function offsetMeters(from, to) {
    const east = (to.lon - from.lon) * M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180);
    const north = (to.lat - from.lat) * M_PER_DEG_LAT;
    return { east, north };
}

export const distanceMeters = (from, to) => {
    const { east, north } = offsetMeters(from, to);
    return Math.hypot(east, north);
};

// World azimuth (deg, [0,360), north = 0, east = 90) from `from` toward `to`
// — the shape setNavArrows expects.
export function bearingBetween(from, to) {
    const { east, north } = offsetMeters(from, to);
    return ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
}

// A normalized picture as a maplibre-gl-photosphere enter()/goTo() target.
// panoPitch/panoRoll come from the camera exif when present (GoPro Max & co.
// write zeros — manual correctors exist for a reason); tiles may be null on
// /search results (the meta-catalog strips tiled-asset fields) — recover with
// fetchTilesConfig() before entering if HD refinement matters.
export function viewerTarget(pic) {
    return {
        id: pic.id,
        lngLat: [pic.lon, pic.lat],
        imageUrl: pic.assets?.sd || pic.assets?.hd || pic.assets?.thumb,
        bearing: pic.heading ?? 0,
        panoPitch: pic.exifPose?.pitch,
        panoRoll: pic.exifPose?.roll,
        // Flat captures render as a perspective window (photosphere ≥ 0.5,
        // its issue #3): pass the projection + metadata hfov; the viewer
        // derives vfov from the actual image aspect. normalizeItem's type is
        // authoritative-360-only, so flat wide frames stay flat.
        projection: pic.type === 'flat' ? 'flat' : undefined,
        hfov: pic.type === 'flat' ? pic.hfov : undefined,
        tiles: pic.type === 'flat' ? null : (pic.tiles || null),
    };
}

const RELATION_RANK = { next: 0, prev: 1, sequence: 2, nearby: 3 };

// The navigation set around `current`: each candidate scored, tagged and
// measured. Pure — candidates typically come from searchNearby() (which
// already includes same-sequence neighbours inside the radius).
//
//   relation: 'next' | 'prev' (the sequence links), 'sequence' (same
//   collection, not adjacent), 'nearby' (another sequence — an intersection).
//
// prev/next always survive the distance filter (Street View shows the way
// onward even when the next capture is far); everything else must be within
// maxDistanceM. One entry per picture id; sorted prev/next first, then by
// distance; capped at maxTargets (photosphere draws 6 arrows / 12 dots).
export function navTargets(current, candidates, { maxDistanceM = 25, maxTargets = 12 } = {}) {
    const byId = new Map();
    for (const pic of candidates || []) {
        if (!pic || pic.id === current.id || byId.has(pic.id)) continue;
        const relation
            = pic.id === current.nextId ? 'next'
                : pic.id === current.prevId ? 'prev'
                    : pic.sequenceId && pic.sequenceId === current.sequenceId ? 'sequence'
                        : 'nearby';
        const { east, north } = offsetMeters(current, pic);
        const distanceM = Math.hypot(east, north);
        if (relation !== 'next' && relation !== 'prev' && distanceM > maxDistanceM) continue;
        byId.set(pic.id, {
            relation,
            east,
            north,
            distanceM,
            bearingDeg: ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360,
            target: viewerTarget(pic),
            pic,
        });
    }
    return [...byId.values()]
        .sort((a, b) =>
            (RELATION_RANK[a.relation] <= 1 ? 0 : 1) - (RELATION_RANK[b.relation] <= 1 ? 0 : 1)
            || a.distanceM - b.distanceM
            || RELATION_RANK[a.relation] - RELATION_RANK[b.relation])
        .slice(0, maxTargets);
}

// One-request convenience: the navigation set for a picture, from a nearby
// search (same-sequence neighbours land in the radius too; a prev/next
// further than radiusM is simply not offered — bump radiusM if sequences
// are sparse).
export async function navigationSet(pic, { apiBase = META_API, radiusM = 30, maxDistanceM = 25, maxTargets = 12 } = {}) {
    const nearby = await searchNearby(pic.lon, pic.lat, radiusM, 50, apiBase);
    return navTargets(pic, nearby, { maxDistanceM, maxTargets });
}
