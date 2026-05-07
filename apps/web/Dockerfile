# syntax=docker/dockerfile:1.7
# Build context: monorepo root. Run from repo root:
#   docker build -f apps/web/Dockerfile -t montte/web .

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
COPY scripts ./scripts
COPY apps/web ./apps/web
RUN bun run web:build

FROM base AS runner
RUN useradd --system --create-home --uid 1001 montte
WORKDIR /app

COPY --from=builder --chown=montte:montte /repo/apps/web/.output ./apps/web/.output
COPY --from=builder --chown=montte:montte /repo/node_modules ./node_modules
COPY --from=builder --chown=montte:montte /repo/package.json ./package.json

USER montte
ENV PORT=3000 \
    HOST=0.0.0.0
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD bun -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/web/.output/server/index.mjs"]
