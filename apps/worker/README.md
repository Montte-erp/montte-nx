# @montte/worker

Processo worker standalone responsável por executar workflows DBOS em background.

## Responsabilidades

- Consome filas Redis (`workflow:categorize`, `workflow:derive-keywords`) via BLPOP
- Executa workflows DBOS (categorização de transações, derivação de keywords de categorias)
- Roda o cron de backfill de keywords (`0 3 * * *`)
- Envia logs e telemetria para PostHog via OTel

## Separação do processo web

O worker roda como um serviço Railway separado. A aplicação web nunca importa DBOS — ela apenas faz `rpush` nas filas Redis. O worker consome essas filas e inicia os workflows.

```
web  →  redis.rpush("workflow:categorize", payload)
worker  →  redis.blpop("workflow:categorize")  →  DBOS.startWorkflow(...)
```

## Desenvolvimento local

```bash
bun run dev
```

Carrega `.env` de `apps/web/.env.local` automaticamente via `--env-file`.

## Produção (Railway)

**Build command:** `bun install && cd apps/worker && bun run build`

**Start command:** `cd apps/worker && bun run start`

## Scripts

```bash
bun run dev        # dev com .env de apps/web
bun run build      # bundle para dist/
bun run start      # inicia dist/index.js com .env de apps/web
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
