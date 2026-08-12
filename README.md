# maplibre-gl-panoramax

[Panoramax](https://panoramax.fr) for [MapLibre GL JS](https://maplibre.org):
browse the federated street-level imagery catalog and **write corrections
back** — from the browser, front-end only.

Pairs with [maplibre-gl-photosphere](https://github.com/clement-igonet/maplibre-gl-photosphere)
for immersive 360° viewing and pose editing: this package knows the Panoramax
**API**, that one knows the **rendering** — together they are a complete
street-view stack on open data. Proven in production by
[MapMax](https://github.com/clement-igonet/mapmax).

```sh
npm install maplibre-gl-panoramax
```

## What's inside

**Catalog client** (`client.js`) — reads default to the federated meta-catalog
(`api.panoramax.xyz`); every function takes an `apiBase` override for
single-instance deployments:

```js
import {addPanoramaxLayers, onPictureClick, getPicture, getSequence, searchNearby} from 'maplibre-gl-panoramax';

addPanoramaxLayers(map);                  // coverage: sequence lines + clickable dots
onPictureClick(map, async (id) => {
  const pic = await getPicture(id);       // normalized: type, heading, assets,
  // pic.homeApi                          //   the OWNING instance (for edits),
  // pic.tiles                            //   tiled-HD config for progressive viewers
});
```

`normalizeItem()` flattens a STAC feature into `{id, lon, lat, heading, type,
sequenceId, assets, homeApi, exifPose, tiles, …}` — `type` is `equirectangular`
only on authoritative 360° metadata (a 2:1 ratio alone is a flat wide frame).
`tilesFromStac()` / `fetchTilesConfig()` produce the `tiles` option of
maplibre-gl-photosphere's progressive HD refinement (note: the meta-catalog
strips tiled-asset fields from `/search`; `fetchTilesConfig` recovers them).

**Edit write-back** (`edit.js`) — the Panoramax API can PATCH a picture's
pose (pitch/roll/yaw, v2.14.0) and position (lat/lon, v2.8.0) on its **home
instance** (the read-only meta-catalog answers 405 — `homeApi` handles that):

```js
import {posePatchRequest} from 'maplibre-gl-panoramax';

const req = posePatchRequest(pic.homeApi, pic.sequenceId, pic.id,
    {pitch: -2, roll: 1.5, yaw: 180},          // yaw = offset from the GPS direction
    token,
    {latitude, longitude});                    // optional corrected position
await fetch(req.url, req.init);                // fixed at the source, for every viewer
```

**Sign-in** (`auth.js`) — the browser token claim flow (generate → the user
signs in on the instance via OpenStreetMap → poll until claimed):

```js
import {tokenGenerateRequest, parseGeneratedToken, whoAmIRequest, claimPollDelays} from 'maplibre-gl-panoramax';

const gen = tokenGenerateRequest(pic.homeApi, 'My app');
const {jwt, claimUrl} = parseGeneratedToken(await (await fetch(gen.url, gen.init)).json());
window.open(claimUrl, '_blank');               // OSM sign-in happens there
for (const delay of claimPollDelays()) {       // 200 on users/me = connected
  await new Promise((r) => setTimeout(r, delay));
  const who = whoAmIRequest(pic.homeApi, jwt);
  if ((await fetch(who.url, who.init)).ok) break;
}
```

Everything is a pure request builder/parser — the caller owns `fetch`, tabs
and token storage (keep tokens in `sessionStorage`, per instance).

**Street-view navigation** (`nav.js`) — from a picture to the walkable set,
ready for [maplibre-gl-photosphere](https://github.com/clement-igonet/maplibre-gl-photosphere):

```js
import {getPicture, navigationSet, viewerTarget, fetchTilesConfig} from 'maplibre-gl-panoramax';

const pic = await getPicture(id);
photosphere.enter({...viewerTarget(pic), tiles: pic.tiles ?? await fetchTilesConfig(pic)});

const targets = await navigationSet(pic);        // one nearby search
photosphere.setNavArrows(targets.slice(0, 2).map((t) => ({bearing: t.bearingDeg, id: t.pic.id})));
photosphere.setNavPois(targets.map((t) => ({east: t.east, north: t.north, id: t.pic.id})));
// on groundPick(px, py) → id: photosphere.goTo(targets.find(...).target)
```

Each entry carries `relation` (`next`/`prev` from the sequence links —
always offered; `sequence`/`nearby` only within `maxDistanceM`), ground
offsets in metres, bearing, distance, and the ready `target`. Pure selection
(`navTargets`) and geometry (`offsetMeters`, `bearingBetween`) are exported
for offline use and testing.

## Tests

```sh
podman compose run --rm test    # vitest, containerized (see RULES.md)
```

## License

BSD-3-Clause. Imagery: served by Panoramax instances under their own licenses.
