# syntax=docker/dockerfile:1.7
# Build context: monorepo root. Run from repo root:
#   docker build -f apps/worker/Dockerfile -t montte/worker .

ARG BUN_VERSION=1.3.12

FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /repo
ENV CI=1 \
    NODE_ENV=production \
    HUSKY=0 \
    LEFTHOOK=0

FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY patches ./patches
COPY tooling ./tooling
COPY core ./core
COPY packages ./packages
COPY modules ./modules
COPY apps/landing/package.json ./apps/landing/
COPY apps/web/package.json ./apps/web/
COPY apps/web-e2e/package.json ./apps/web-e2e/
COPY apps/worker/package.json ./apps/worker/
RUN bun install --frozen-lockfile

FROM deps AS builder
COPY nx.json tsconfig.json ./
COPY apps/worker ./apps/worker
RUN bun run worker:build

FROM base AS runner
RUN useradd --system --create-home --uid 1001 montte
WORKDIR /app

COPY --from=builder --chown=montte:montte /repo/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=montte:montte /repo/node_modules ./node_modules
COPY --from=builder --chown=montte:montte /repo/package.json ./package.json
COPY --from=builder --chown=montte:montte /repo/apps/worker/package.json ./apps/worker/package.json

USER montte

CMD ["bun", "run", "apps/worker/dist/index.js"]
