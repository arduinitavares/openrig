#!/bin/sh
set -eu

# Only the two Linux dependency volumes need ownership initialization.
# Do not recursively change the Mac bind mount or retained home.
for directory in \
    /workspace/repos/openrig/node_modules \
    /workspace/repos/openrig/packages/ui/node_modules
do
    chown node:node "$directory"
done

exec gosu node "$@"
