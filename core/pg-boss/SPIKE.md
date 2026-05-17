# Spike MON-1078 — pg-boss com Bun, Drizzle e apps/worker

## Resultado

Adotar `pg-boss` para jobs simples e operacionais no Montte.

O spike validou o caminho esperado para manter `DBOS` em workflows duráveis/críticos e usar `pg-boss` apenas para jobs reexecutáveis do zero. O job migrado neste spike foi `agent-title`.

## Implementado

- Pacote isolado `@core/pg-boss`.
- `apps/web` só enfileira o job de título, sem consumidor.
- `apps/worker` sobe `pg-boss`, cria a fila `agent-title` e registra o handler.
- Enqueue do título acontece dentro da transação Drizzle que persiste a resposta do assistente, usando `fromDrizzle(tx, sql)`.
- Handler lança erro normalmente; `pg-boss` aplica retry pela configuração da fila.
- Shutdown do worker chama `boss.stop({ graceful: true })` antes de encerrar DBOS, PostHog, Redis e OTEL.

## Dashboard

O dashboard oficial foi avaliado como viável para desenvolvimento local, sem integração em produção.

Com `.env.local` configurado:

```bash
bun --filter=@core/pg-boss dashboard:dev
```

O pacote usa o binário `pg-boss-dashboard` de `@pg-boss/dashboard` e lê `DATABASE_URL` via `dotenv`.

## Smoke

```bash
bun --filter=@core/pg-boss smoke
```

O smoke cobre:

- criação e conclusão de job com Bun;
- retry após erro lançado pelo handler;
- enqueue dentro de transação Drizzle com `fromDrizzleTransaction(tx)`;
- shutdown graceful do `pg-boss`.

## Decisão

Manter `pg-boss` como fila padrão para jobs simples do Montte.

Fallback para Graphile Worker só deve ser reaberto se aparecer incompatibilidade real no runtime Bun, operação do dashboard, ou uso transacional com Drizzle.
