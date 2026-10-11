#!/bin/sh
set -eu

case "$(basename "$0")" in
    openrig-tui) entry=/workspace/repos/openrig/packages/tui/dist/main.js ;;
    *) entry=/workspace/repos/openrig/packages/cli/dist/bin-wrapper.js ;;
esac

if [ ! -f "$entry" ]; then
    printf '%s\n' "The checkout is not built. In /workspace/repos/openrig, run bash .devcontainer/setup.sh." >&2
    exit 1
fi

exec node "$entry" "$@"
