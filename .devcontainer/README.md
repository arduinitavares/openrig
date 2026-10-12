# OpenRig source Dev Container

This Dockerfile-based Dev Container runs this Git checkout. The image provides
Node 22, tmux, native build tools, Git and Codex 0.162.1. VS Code runs `npm ci`
and `npm run build` inside Linux after creating the container. OpenRig and its
agents are started deliberately from a terminal.

## Where the files live

| Files | Mac storage | Container |
| --- | --- | --- |
| Source, specs, skills and this configuration | `/Users/aaat/projects/openrig` | `/workspace/repos/openrig` |
| Linux dependencies | `openrig-source-dev_node_modules` Docker volume | `/workspace/repos/openrig/node_modules` |
| UI dependencies | `openrig-source-dev_ui_node_modules` Docker volume | `/workspace/repos/openrig/packages/ui/node_modules` |
| Codex login, OpenRig state and default agent workspace | Existing `openrig-docker_home` Docker volume | `/home/node` |

Edits to shared source files appear on both sides. Linux dependencies stay in
Linux volumes; run installation inside the container. Compiled `dist` files
appear in the checkout and are ignored by the repository's Git rules.
The old `openrig-docker_workspace` volume remains retained and unmounted.

`rig` executes `packages/cli/dist/bin-wrapper.js` from this checkout. Its daemon
resolver prefers `packages/daemon/dist`; `openrig-tui` executes
`packages/tui/dist/main.js`. Editing TypeScript requires rebuilding. An already
running daemon must be stopped and restarted to use a new daemon build.

The default agent workspace remains `/home/node/.openrig/workspace`. The source
mount does not automatically change a seat's working directory. Select the
intended directory explicitly when setting up project work.

## Open and return

Open `/Users/aaat/projects/openrig` in VS Code on the Mac and choose
**Dev Containers: Reopen in Container**. This configuration builds directly
from `Dockerfile`; it does not invoke Compose or require access grants for a
Compose Bake helper directory. No Mac home, host credentials or Docker socket
is mounted.

The host preflight requires the existing home volume and rejects running
containers using it unless both Dev Container labels identify this checkout
and this configuration. This prevents the usual accidental overlap with the
old environment; it is a preflight check, not a global concurrency lock.

After setup, `rig --version` checks the checkout build. `codex login status`
checks retained authentication without printing credentials. Back up retained
OpenRig state before starting a newer daemon that may migrate it. Then open
`rig` and resume the existing operator when appropriate.

Closing VS Code stops this container (`shutdownAction: stopContainer`) and
retains the named volumes. Reopen the same Mac folder to return. Do not launch
the old Docker project while this environment uses its home volume.

## Keep customizations while updating

Commit configuration and source changes on `devcontainer` before updating.
Fetch upstream releases, read the selected release notes, and **merge the
chosen release tag into this branch**. A merge retains your commits and surfaces
conflicts for review. Avoid resetting the branch to a tag or copying a fresh
checkout over your files. Updates are deliberate rather than automatic.

After a merge, rerun `bash .devcontainer/setup.sh` inside the container to install
the updated lockfile and rebuild. Use **Rebuild Container** when the Dockerfile
or mount configuration changes. Rebuild retains the named volumes. If a new
lockfile adds another workspace with nested dependencies, add its Linux
dependency volume before installation.

OpenRig's release is selected by Git. Codex is separately pinned by the
`CODEX_VERSION` build argument in `devcontainer.json`; changing it requires an
image rebuild.

The old Docker image and `/Users/aaat/projects/openrig-docker/compose.yaml` remain
available to recreate the previous environment after this one stops. This is
not a database rollback: a newer daemon may migrate retained state. Keep a
state backup before that handover. Do not remove or prune the retained volumes.

## References

- [OpenRig contribution guide](https://github.com/mvschwarz/openrig/blob/v0.6.9/CONTRIBUTING.md)
- [Dockerfile-based Dev Containers](https://containers.dev/guide/dockerfile)
- [Dev Container configuration reference](https://containers.dev/implementors/json_reference)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Linux dependency volumes on macOS](https://code.visualstudio.com/remote/advancedcontainers/improve-performance)
