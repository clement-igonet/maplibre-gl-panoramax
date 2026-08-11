// DEMO SHIM — this app module is served straight from maplibre-gl-panoramax.
// The original MapMax implementation was extracted into the plugin (see the
// repo's CHANGELOG); the demo runs the real app on the published API, which is
// the point: what you see is what `npm install maplibre-gl-panoramax` gives.
export {
    SOURCE_ID,
    SEQUENCES_LAYER,
    PICTURES_LAYER,
    addPanoramaxLayers,
    onPictureClick,
    idFromHref,
    normalizeItem,
    getPicture,
    searchNearby,
    getSequence,
} from 'maplibre-gl-panoramax';
