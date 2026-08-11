# RULES — how work is executed on this repository

## Execution environment

- **All build/test/tooling commands run on the remote VM, reached with
  `ssh maplibre`** (host `cka-ovh-dedicated-01`). The local workstation is for
  editing and git only — it deliberately has no node/npm toolchain.
- **Use containers, not direct commands.** Never invoke `node`, `npm`, `npx`,
  `python`, … straight on a host. The remote VM is **podman-ready** (podman ≥ 5
  with the compose provider; `docker compose` syntax works identically).
- **Rely on `docker-compose.yml` as the reference setup.** Every runnable
  concern (tests, demo preview) is a compose service.

The repo's home on the VM is `~/projects/maplibre-gl-js/maplibre-gl-panoramax`
(next to the maplibre-gl-js and maplibre-gl-photosphere checkouts).

```sh
# sync the working tree to the VM, then run the suite there:
rsync -ac --delete --exclude node_modules --exclude .git \
    ./ maplibre:projects/maplibre-gl-js/maplibre-gl-panoramax/
ssh maplibre 'cd ~/projects/maplibre-gl-js/maplibre-gl-panoramax && podman compose run --rm test'

# preview the GitHub Pages demo (serves the repo root, as Pages does):
ssh maplibre 'cd ~/projects/maplibre-gl-js/maplibre-gl-panoramax && WEB_PORT=8093 podman compose up -d web'
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

- Features are additive; keep the existing API intact (see CHANGELOG.md).
- `src/` ships as-is (no build step): plain ES modules, no TypeScript syntax.
- This package knows the **Panoramax API**, never any UI: request builders and
  parsers stay pure (callers own fetch, tabs and storage), so everything is
  unit-testable offline. Viewer concerns belong to maplibre-gl-photosphere.
