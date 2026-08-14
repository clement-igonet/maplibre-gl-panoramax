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

# preview the demo on 127.0.0.1:17500 (1PESI scheme: product digit 7 —
# platform RULES.md §3):
ssh panoramax 'cd ~/projects/maplibre-gl-panoramax && podman compose up -d web'

# confinia environments — 1PESI ports (17000 www · 17300 staging · 17400
# sandbox; 17210/17220 reserved for green web/api), static file-servers over
# this tree, `restart: unless-stopped`, under the lingering panoramax user.
# (legacy 85xx decommissioned 2026-08-14 after the edge flip):
ssh panoramax 'cd ~/projects/maplibre-gl-panoramax && podman compose up -d www staging sandbox'

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
- **Bootstrap exception (0.1.0 only)**: trusted publishers and staged
  publishing both require an existing package, so the very first publish is
  an INTERACTIVE `npm publish` from the test container (`podman run -it …`),
  approved with the maintainer's own 2FA in the browser when npm prints the
  auth URL. No bypass-2FA tokens (deprecated: GitHub changelog 2026-07-08);
  a plain granular token covers auth, `NODE_OPTIONS=--dns-result-order=ipv4first`
  covers the VM's IPv6 egress vs IPv4 token allowlists. Then add the trusted
  publisher on npmjs.com (repo `clement-igonet/maplibre-gl-panoramax`,
  workflow `release.yml`), revoke the token, and never publish manually again.

## Conventions

- **After every finished task, suggest the next steps to focus on** — the
  concrete actions in priority order (merges/saves waiting on the user
  included), plus the next GitHub issue/PR picked from the open ones across
  maplibre-gl-photosphere, maplibre-gl-panoramax and mapmax, with why.
- **Always hyperlink issue/PR references** — every mention of an issue or PR
  links to it (e.g. [mapmax#110](https://github.com/clement-igonet/mapmax/issues/110)),
  so one click gets there.
- **Don't prompt when the only answers are yes / "yes, allow script
  execution" / no** — the default is yes, and yes on executing scripts.
  Prompt only when the choice offers answers beyond those (a real decision
  between alternatives).

- Features are additive; keep the existing API intact (see CHANGELOG.md).
- `src/` ships as-is (no build step): plain ES modules, no TypeScript syntax.
- This package knows the **Panoramax API**, never any UI: request builders and
  parsers stay pure (callers own fetch, tabs and storage), so everything is
  unit-testable offline. Viewer concerns belong to maplibre-gl-photosphere.
