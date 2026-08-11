// DEMO SHIM — pose clamping, PATCH building and home-instance resolution come
// from maplibre-gl-panoramax; only the local-persistence key stays app-side
// (the plugin never touches storage).
export {
    normalizeYaw,
    clampPose,
    buildPosePatch,
    posePatchRequest,
    apiBaseFromSelfHref,
    homeApiBase,
    readPoseFromExif,
    offsetLngLat,
    // Pose algebra (gesture.js) — the vendored photosphere plugin imports
    // panoPoseMatrix from here, like it did from MapMax's pose.js.
    panoPoseMatrix,
    poseTransform,
    poseFromMatrix,
    composePoseGesture,
} from 'maplibre-gl-panoramax';

// Corrections persist per sequence in this browser even without a token.
export const POSE_STORE_KEY = (seqOrPicId) => `mapmax:pose:${seqOrPicId}`;
