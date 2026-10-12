#!/bin/bash
set -euo pipefail

# VS Code runs this on the Mac before opening the Dev Container.
# Preserve existing data and reject another environment using this home.
workspace=${1:?Expected the Mac checkout path}
config_file="$workspace/.devcontainer/devcontainer.json"
docker volume inspect openrig-docker_home >/dev/null
containers=$(docker ps --filter volume=openrig-docker_home \
    --format '{{.Names}}\t{{.Label "devcontainer.local_folder"}}\t{{.Label "devcontainer.config_file"}}')

if [[ -n "$containers" ]]; then
    while IFS=$'\t' read -r name folder config; do
        if [[ "$folder" != "$workspace" || "$config" != "$config_file" ]]; then
            printf 'The retained home is currently used by %s.\n' "$name" >&2
            printf '%s\n' 'Stop that container before reopening this checkout. Keep its volumes.' >&2
            exit 1
        fi
    done <<< "$containers"
fi

printf '%s\n' 'Retained home is available for the OpenRig source Dev Container.'
