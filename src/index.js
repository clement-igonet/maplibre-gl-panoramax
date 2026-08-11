// maplibre-gl-panoramax — Panoramax for MapLibre GL JS.
//
// Three concerns, one package:
//   client.js  browse the federated catalog: STAC client, item normalization,
//              coverage map layers, tiled-HD configs for progressive viewers
//   edit.js    write corrections back: pose (pitch/roll/yaw) and position
//              PATCH builders, home-instance resolution, exif pose, geo offsets
//   auth.js    browser sign-in to an instance: token generate → claim → poll
//
// Pairs with maplibre-gl-photosphere for immersive viewing and pose editing:
// feed `normalizeItem()` pictures to its targets (imageUrl/bearing/tiles), and
// its `getPanoPose()` output to `posePatchRequest()` here.
export * from './client.js';
export * from './edit.js';
export * from './auth.js';
