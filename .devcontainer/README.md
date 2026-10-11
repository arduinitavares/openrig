# OpenRig source Dev Container

This environment runs the source checkout on your `devcontainer` branch. It
does not install a second OpenRig package from npm. The image provides Node 22,
tmux, native build tools, Git and Codex 0.162.1. VS Code runs `npm ci` and
`npm run build` inside Linux after creating the container. OpenRig and its
agents are started deliberately from a terminal, not during container creation.

## Where the files live

| Files | Mac | Container |
| --- | --- | --- |
| Source, specs, skills and this configuration | `/Users/aaat/projects/openrig` | `/workspace/repos/openrig` |
| Linux dependencies | Docker volumes belonging to `openrig-source-dev` | `node_modules` and `packages/ui/node_modules` under the checkout |
| Codex login, OpenRig state and default agent workspace | Existing `openrig-docker_home` Docker volume | `/home/node` |

Edits to shared source files appear on both sides. Linux dependencies stay in
Linux volumes; do not run `npm ci` on the Mac for this environment. Compiled
`dist` files appear in the checkout and are ignored by the repository's Git rules.

`rig` executes `packages/cli/dist/bin-wrapper.js` from the checkout. Its daemon
resolver prefers `packages/daemon/dist`; `openrig-tui` executes
`packages/tui/dist/main.js`. Editing TypeScript requires rebuilding. An already
running daemon must be stopped and restarted before it uses a new daemon build.

The default agent workspace remains `/home/node/.openrig/workspace`. The source
mount does not automatically change a seat's working directory. We will select
the intended directory explicitly when setting up project work.

## First opening

These are separate checkpoints in the guided setup:

1. Review and commit `.devcontainer` on your `devcontainer` branch. These files
   have been prepared but have not been committed for you.
2. The old container was stopped and removed at your request; its two named
   volumes were retained. A host preflight refuses to open this environment
   while another container uses `openrig-docker_home`.
3. Open `/Users/aaat/projects/openrig` in VS Code on your Mac. Choose
   **Dev Containers: Reopen in Container**. Allow the image build and Linux setup
   to finish, then inspect the setup output and run `rig --version`.
4. Check `codex login status` and retained OpenRig files without printing secrets.
   Back up retained OpenRig state before starting a newer daemon that may migrate
   it. Then open `rig` and resume the existing operator when appropriate.

Do not use the old Docker project's Compose file to launch this source
environment. This configuration belongs to the `openrig-source-dev` project.
No Mac home directory, host credentials or Docker socket is mounted.

## Keep customizations while updating

Commit your configuration and any source changes on `devcontainer` before an
update. Fetch upstream releases, read the selected release notes, and **merge
the chosen release tag into this branch**. A merge retains your commits and
surfaces conflicts for review. Avoid resetting the branch to a tag or copying a
fresh checkout over your files. Updates are deliberate, rather than automatic.

After a merge, rerun `bash .devcontainer/setup.sh` inside the container to install
the updated lockfile and rebuild the checkout. Use **Rebuild Container** if the
Dockerfile or mount configuration changed. Rebuild uses the retained named
volumes; do not remove them to upgrade. If a new lockfile adds another workspace
with nested dependencies, add its Linux dependency volume before installation.

The chosen OpenRig release is determined by Git, not a version string in the
Dockerfile. Codex is separately pinned in `compose.yaml`. Changing its version is
a separate decision and requires an image rebuild.

## Stop and return

Closing VS Code stops this Compose environment (`shutdownAction: stopCompose`)
and retains its volumes. To return, reopen the same Mac folder in its Dev
Container. Do not start the old container while this one is running.

The old Docker image and `/Users/aaat/projects/openrig-docker/compose.yaml` remain
available to recreate the previous environment with its retained volumes after
this environment is stopped. This is not a database rollback: starting a newer
daemon may update retained state. Keep a state backup before that handover.
The former `/workspace` files remain in `openrig-docker_workspace`; that volume
is retained but is not mounted by this configuration. Never use
`docker compose down --volumes` or volume pruning for this setup.

## References

- [OpenRig contribution guide](https://github.com/mvschwarz/openrig/blob/v0.6.9/CONTRIBUTING.md)
- [Dev Containers with Docker Compose](https://containers.dev/guide/dockerfile)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Linux dependency volumes on macOS](https://code.visualstudio.com/remote/advancedcontainers/improve-performance)
