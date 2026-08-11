# Changelog

## main

### ✨ Features and improvements
- **`gesture.js` — the pose-editor algebra**, moved here from the
  maplibre-gl-photosphere 0.4.0 draft by design: editing belongs next to the
  data source that stores the correction; viewers only render. Self-contained
  (mirrors the viewer's pose conventions without depending on it):
  `composePoseGesture` ("grab the photo": view-space deltas compose as
  `M' = M·G⁻¹`, drift-free), `poseFromMatrix` (gimbal-safe exact Euler
  roundtrip), `panoPoseMatrix`, `poseTransform`, `mat3Multiply`,
  `axisRotationMatrix`. 12 tests ported with it (31 total).
- Pages demo: the MapMax app running verbatim on the published plugin API
  (data/auth/edit modules are re-export shims) — browse coverage, enter a
  360°, ⌖ Level with live preview, Connect to Panoramax, Save writes the
  pose PATCH to the picture's home instance.
- Releases now follow the maplibre-gl-js model via maplibre/reusable-workflows
  (version-bump PR → npm publish + tag + GitHub Release from this section).

### 🐞 Bug fixes
- _...Add new stuff here..._

## 0.1.0 — 2026-08-11

First release — the Panoramax data/auth/edit layer extracted from
[MapMax](https://github.com/clement-igonet/mapmax), where every piece shipped
and was validated in production (mapmax#98/#104/#107).

### Added
- **Catalog client**: `getPicture` / `searchNearby` / `getSequence` against
  the federated meta-catalog (or any instance via `apiBase`);
  `normalizeItem()` flattening STAC features (authoritative-360° type
  detection, prev/next links, home-instance resolution, exif capture pose);
  `addPanoramaxLayers()` + `onPictureClick()` MapLibre coverage layers;
  `tilesFromStac()` / `fetchTilesConfig()` → maplibre-gl-photosphere
  progressive-HD `tiles` configs (the meta-catalog strips tiled-asset fields
  from `/search` — `fetchTilesConfig` recovers them with one item fetch).
- **Edit write-back**: `posePatchRequest()` (pose pitch/roll/yaw, API
  v2.14.0, plus optional corrected absolute lat/lon, v2.8.0, in the same
  PATCH), `buildPosePatch`/`clampPose` domain clamping, `homeApiBase()` (the
  `via` link — the read-only meta-catalog answers 405 to PATCH),
  `readPoseFromExif()`, `offsetLngLat()` metric offsets.
- **Sign-in**: the browser token claim flow as pure builders —
  `tokenGenerateRequest` (bodyless POST: a CORS simple request),
  `parseGeneratedToken` (`rel`/`ref` claim-link spellings), `whoAmIRequest`
  polling probe, `claimPollDelays` (~3 min budget; keep the pending JWT and
  re-check later — claims can outlive the poll).
- Containerized vitest suite (19 tests) + demo preview services (RULES.md).
