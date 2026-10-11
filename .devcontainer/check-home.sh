#!/bin/bash
set -euo pipefail

# VS Code runs this on the Mac before opening the Dev Container.
# Existing home data must be present, and another container must not use it.
docker volume inspect openrig-docker_home >/dev/null
containers=$(docker ps --filter volume=openrig-docker_home \
    --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}')

if [[ -n "$containers" ]]; then
    while IFS=$'\t' read -r name project service; do
        if [[ "$project" != openrig-source-dev || "$service" != openrig ]]; then
            printf 'The retained home is currently used by %s.\n' "$name" >&2
            printf '%s\n' 'Stop that container before reopening this checkout. Keep its volumes.' >&2
            exit 1
        fi
    done <<< "$containers"
fi

printf '%s\n' 'Retained home is available for the OpenRig source Dev Container.'
