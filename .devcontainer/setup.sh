#!/bin/bash
set -euo pipefail
cd /workspace/repos/openrig

# Install and compile against THIS Linux checkout, not an npm OpenRig copy.
npm ci
npm run build

for entry in packages/cli/dist/bin-wrapper.js packages/daemon/dist/index.js packages/tui/dist/main.js; do
    test -f "$entry"
done

rig --version
printf '%s\n' 'Checkout build is ready. Run rig in this terminal when you want to open OpenRig.'
