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
- **npm** publishes via trusted publishing when a `v*` tag is pushed
  (`.github/workflows/release.yml`); the workflow runs the vitest suite first.
  Pushing a tag IS the release action — do it deliberately.

## Conventions

- Features are additive; keep the existing API intact (see CHANGELOG.md).
- `src/` ships as-is (no build step): plain ES modules, no TypeScript syntax.
- This package knows the **Panoramax API**, never any UI: request builders and
  parsers stay pure (callers own fetch, tabs and storage), so everything is
  unit-testable offline. Viewer concerns belong to maplibre-gl-photosphere.
