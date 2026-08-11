# RULES — how work is executed on this repository

## Execution environment

- **All build/test/tooling commands run on the remote VM, reached with
  `ssh panoramax`** (host `cka-ovh-dedicated-01`). The local workstation is for
  editing and git only — it deliberately has no node/npm toolchain.
- **Use containers, not direct commands.** Never invoke `node`, `npm`, `npx`,
  `python`, … straight on a host. The remote VM is **podman-ready** (podman ≥ 5
  with the compose provider; `docker compose` syntax works identically).
- **Rely on `docker-compose.yml` as the reference setup.** Every runnable
  concern (tests, demo preview) is a compose service.

The repo's home on the VM is `~/projects/maplibre-gl-panoramax`
(its own per-product VM account, per the platform user split).

```sh
# sync the working tree to the VM, then run the suite there:
rsync -ac --delete --exclude node_modules --exclude .git \
    ./ panoramax:projects/maplibre-gl-panoramax/
ssh panoramax 'cd ~/projects/maplibre-gl-panoramax && podman compose run --rm test'

# preview the demo — NO HOST PORT yet: the 85xx band (8504 = dev preview) is
# reserved in confinia/platform PR #5; until it merges the web service stays
# compose-network-only. Preview via the smoke service below, or the live
# Pages URL after a push.
ssh panoramax 'cd ~/projects/maplibre-gl-panoramax && podman compose up -d web'

# browser smoke of the demo — REQUIRED after touching docs/ or src/ exports:
# a static server 200s every asset while one missing export kills the whole
# ES-module graph; only a real browser sees that. Also run it against the live
# site after a deploy (TARGET_URL=https://clement-igonet.github.io/maplibre-gl-panoramax/docs/).
ssh panoramax 'cd ~/projects/maplibre-gl-panoramax && podman compose run --rm smoke'
```

## Deployment

- **GitHub Pages** serves the demo from the `main` branch root: every push to
  `main` deploys it.
- **Releases are driven the maplibre-gl-js way**, through
  [maplibre/reusable-workflows](https://github.com/maplibre/reusable-workflows):
  1. Land changes on `main` with notes under the `## main` section of
     CHANGELOG.md.
  2. Run the **"Create bump version PR"** workflow (choose major/minor/patch);
     it bumps package.json and renames `## main` → `## X.Y.Z` in a PR.
  3. Merge the PR: `release.yml` detects the version change and does the rest —
     vitest gate, **npm publish** (trusted publishing/OIDC, no tokens), the
     `vX.Y.Z` **tag**, provenance attestation, and the **GitHub Release** whose
     notes are the `## X.Y.Z` changelog section.
- **Never push tags manually** — the workflow creates them. Keep changelog
  version headers exactly `## X.Y.Z` (release-notes extraction matches them).
- **Bootstrap exception (0.1.0 only)**: npm trusted publishers can only be
  configured on packages that already exist — publish the first version from
  the test container with a granular npm token
  (`podman compose run --rm -e NODE_AUTH_TOKEN test sh -c 'npm ci && npm publish --access public'`
  with an `.npmrc` line `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`),
  then add the trusted publisher on npmjs.com (repo
  `clement-igonet/maplibre-gl-panoramax`, workflow `release.yml`).

## Conventions

- **After every finished action, suggest the next GitHub issue/PR to work
  on** — pick from the open issues/PRs across maplibre-gl-photosphere,
  maplibre-gl-panoramax and mapmax, and say why it is next.

- Features are additive; keep the existing API intact (see CHANGELOG.md).
- `src/` ships as-is (no build step): plain ES modules, no TypeScript syntax.
- This package knows the **Panoramax API**, never any UI: request builders and
  parsers stay pure (callers own fetch, tabs and storage), so everything is
  unit-testable offline. Viewer concerns belong to maplibre-gl-photosphere.
