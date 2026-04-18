# @montte/worker

Processo worker standalone responsável por executar workflows DBOS em background.

## Responsabilidades

- Processa filas DBOS nativas (`workflow:categorize`, `workflow:derive-keywords`) — sem loop de consumo, DBOS gerencia automaticamente
- Executa workflows de categorização de transações e derivação de keywords
- Roda o cron de backfill de keywords (`0 3 * * *`)
- Envia logs e telemetria para PostHog via OTel

## Separação do processo web

O worker roda como um serviço Railway separado. A aplicação web enfileira jobs via `DBOSClient` (PostgreSQL-backed, durável):

```
web  →  DBOSClient.enqueue("workflow:categorize", payload)
worker  →  DBOS processa a fila automaticamente  →  workflow executa
```

Ao contrário de Redis BLPOP, jobs sobrevivem a restarts do worker.

## Desenvolvimento local

```bash
bun run dev
```

Carrega `.env` de `apps/web/.env.local` automaticamente via `--env-file`.

## Produção (Railway)

**Build command:** `bun install && cd apps/worker && bun run build`

**Start command:** `bun apps/worker/dist/index.js`

## Scripts

```bash
bun run dev        # dev com .env de apps/web
bun run build      # bundle para dist/
bun run typecheck
```

## Variáveis de ambiente

Schema validado em `core/environment/src/worker.ts`. No Railway, use reference variables do serviço web.

```
DATABASE_URL
REDIS_URL
POSTHOG_KEY
POSTHOG_HOST
STRIPE_SECRET_KEY
LOG_LEVEL          (opcional, default: "info")
OPENROUTER_API_KEY (opcional)
```
