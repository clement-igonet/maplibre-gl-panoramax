// maplibre-gl-panoramax — Panoramax for MapLibre GL JS.
//
// Three concerns, one package:
//   client.js  browse the federated catalog: STAC client, item normalization,
//              coverage map layers, tiled-HD configs for progressive viewers
//   edit.js    write corrections back: pose (pitch/roll/yaw) and position
//              PATCH builders, home-instance resolution, exif pose, geo offsets
//   auth.js    browser sign-in to an instance: token generate → claim → poll
//   gesture.js the pose-EDITOR algebra: compose "grab the photo" drags onto a
//              capture pose, re-extract yaw/pitch/roll for the PATCH
//   nav.js     the street-view graph: pictures → viewer targets + the
//              reachable-neighbour set (offsets/bearings for ground arrows)
//   coverage.js coverage-map filters (type/date/user/model/collection) and
//              themes (age colouring) as pure MapLibre expressions
//   federation.js the instances directory: list every federated instance,
//              resolve a picture's home instance (name, auth) for sign-in UIs
//
// Editing lives in THIS package by design (corrections belong to the data
// source); viewers such as maplibre-gl-photosphere render the results. Feed
// `normalizeItem()` pictures to viewer targets (imageUrl/bearing/tiles),
// `composePoseGesture()` results to the viewer's `setPanoPose()` live, and
// the final pose to `posePatchRequest()` here for the write-back.
export * from './client.js';
export * from './edit.js';
export * from './auth.js';
export * from './gesture.js';
export * from './nav.js';
export * from './coverage.js';
export * from './federation.js';
