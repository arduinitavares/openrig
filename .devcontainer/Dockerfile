FROM node:22-bookworm-slim

ARG CODEX_VERSION=0.162.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bash ca-certificates git gosu python3 make g++ tmux procps \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "@openai/codex@${CODEX_VERSION}" \
    && git config --system --add safe.directory /workspace/repos/openrig

RUN ln -s /home/node/.local/bin/omp /usr/local/bin/omp

COPY --chmod=755 entrypoint.sh /usr/local/bin/openrig-dev-entrypoint
COPY --chmod=755 run-checkout.sh /usr/local/bin/rig
COPY --chmod=755 run-checkout.sh /usr/local/bin/openrig-tui

WORKDIR /workspace/repos/openrig
ENTRYPOINT ["/usr/local/bin/openrig-dev-entrypoint"]
CMD ["sleep", "infinity"]
