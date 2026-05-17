# Spike MON-1078 — pg-boss com Bun, Drizzle e apps/worker

## Resultado

Adotar `pg-boss` para jobs simples e operacionais no Montte.

O spike validou o caminho esperado para manter `DBOS` em workflows duráveis/críticos e usar `pg-boss` apenas para jobs reexecutáveis do zero. O job migrado neste spike foi `agent-title`.

## Implementado

- Pacote isolado `@core/pg-boss`.
- `apps/web` só enfileira o job de título, sem consumidor.
- `apps/worker` sobe `pg-boss`, cria a fila `agent-title` e registra o handler.
- Enqueue do título acontece dentro da transação Drizzle que persiste a resposta do assistente, usando `fromDrizzle(tx, sql)`.
- Handler usa `better-result` internamente e só lança na borda do worker para o retry do `pg-boss`.
- Shutdown do worker chama `boss.stop({ graceful: true })` antes de encerrar DBOS, PostHog, Redis e OTEL.

## Decisão

Manter `pg-boss` como fila padrão para jobs simples do Montte.

Fallback para Graphile Worker só deve ser reaberto se aparecer incompatibilidade real no runtime Bun ou uso transacional com Drizzle.
