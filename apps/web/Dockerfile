FROM oven/bun:1.3.9-alpine AS builder

WORKDIR /app

ENV NITRO_PRESET=node-server

COPY . .

RUN bun install --frozen-lockfile
RUN bun run --filter=web build

FROM node:22.12.0-alpine3.20 AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN addgroup -S nodejs && adduser -S app -G nodejs

COPY --from=builder --chown=app:nodejs /app/apps/web/.output /app/apps/web/.output

USER app

EXPOSE 3000

CMD ["node", "apps/web/.output/server/index.mjs"]
