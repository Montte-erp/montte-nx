# AI: Auto-derivar Palavras-chave de Categorias

**Ticket:** MON-199  
**Data:** 2026-04-11

---

## Objetivo

Usar um LLM leve para derivar `keywords` automaticamente em categorias financeiras ao criar/editar, e fazer backfill das categorias existentes. Keywords são internas — usadas para categorização automática de transações, não exibidas diretamente ao usuário.

---

## Arquitetura Geral

```
apps/web oRPC (create/update)
  → salva categoria no DB
  → fire-and-forget: POST apps/server /internal/jobs/derive-keywords

apps/server DBOS Workflow
  → enforceCreditBudget("ai.keyword_derived")
  → LLM step: openrouter/liquid/lfm2-8b-a1b
  → saveStep: UPDATE categories SET keywords = [...]
  → publishStep: jobPublisher.publish("job.notification", notification)

apps/web oRPC SSE (notifications.subscribe)
  → subscribe Redis channel "notifications:{teamId}"
  → yield JobNotification para o frontend

Frontend (useJobNotifications em _dashboard.tsx)
  → toast + queryClient.invalidateQueries por tipo
```

---

## Canal de Comunicação — `@orpc/experimental-publisher` + IORedisPublisher

Usa `@orpc/experimental-publisher` com `IORedisPublisher` — adequado para sistemas distribuídos. Ambos `apps/web` e `apps/server` compartilham `@core/redis`.

**Contrato `JobNotification`:**
```typescript
// packages/events/src/notifications.ts
export const jobNotificationSchema = z.object({
  jobId: z.string(),
  type: z.string(), // "ai.keyword_derived" | "cron.keywords_backfill" | ...
  status: z.enum(["completed", "failed"]),
  payload: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  teamId: z.string().uuid(),
  timestamp: z.string(),
});
export type JobNotification = z.infer<typeof jobNotificationSchema>;
```

**Publisher singleton** (`apps/web/src/integrations/orpc/publisher.ts`):
```typescript
import { IORedisPublisher } from "@orpc/experimental-publisher";
import { redis } from "@core/redis/connection";
import type { JobNotification } from "@packages/events/notifications";

export const jobPublisher = new IORedisPublisher<{
  "job.notification": JobNotification;
}>(redis);
```

**oRPC SSE procedure** (`apps/web/src/integrations/orpc/router/notifications.ts`):
```typescript
import { eventIterator } from "@orpc/server";
import { jobNotificationSchema } from "@packages/events/notifications";
import { jobPublisher } from "../publisher";

export const subscribe = protectedProcedure
  .output(eventIterator(jobNotificationSchema))
  .handler(async function* ({ context, signal }) {
    const iterator = jobPublisher.subscribe("job.notification", {
      filter: (event) => event.teamId === context.teamId,
      signal,
    });
    try {
      for await (const event of iterator) {
        yield event;
      }
    } finally {
      await iterator.return?.();
    }
  });
```

**Publish no DBOS workflow** (`apps/server`):
```typescript
// mesmo publisher instanciado com a mesma conexão redis
await jobPublisher.publish("job.notification", notification);
```

**Vantagens sobre Redis pub/sub manual:**
- Resume automático via `lastEventId` + Client Retry Plugin — reconecta sem perder notificações
- Filtragem por `teamId` no servidor — sem vazamento entre teams
- `finally` block para cleanup automático na desconexão do cliente
- `eventIterator(schema)` valida eventos com Zod antes de enviar

---

## DBOS Workflow — Derivação por Categoria

**Arquivo:** `apps/server/src/workflows/derive-keywords.workflow.ts`

- Usa `neverthrow` (`ok`, `err`, `ResultAsync`) em todos os steps
- Erros via `AppError` / `propagateError` de `@core/logging/errors`
- Modelo: `openrouter/liquid/lfm2-8b-a1b` (ultra-leve, free tier)
- `enforceCreditBudget("ai.keyword_derived")` antes do step de inferência

**Steps:**
1. `deriveStep` — chama LLM, retorna `Result<string[], AppError>`
2. `saveStep` — `UPDATE categories SET keywords = [...]`
3. `publishStep` — `jobPublisher.publish("job.notification", notification)`

**Disparo no `apps/web`** (fire-and-forget após `createCategory`/`updateCategory`):
```typescript
void ResultAsync.fromPromise(
  fetch(`${env.SERVER_URL}/internal/jobs/derive-keywords`, {
    method: "POST",
    body: JSON.stringify({ categoryId, teamId, name, description }),
  }),
  (e) => AppError.internal(`Failed to enqueue job: ${e}`)
);
```

---

## DBOS Cron — Backfill de Categorias Existentes

**Arquivo:** `apps/server/src/workflows/backfill-keywords.cron.ts`

- Roda diariamente
- Busca teams com `categories WHERE keywords IS NULL`
- Para cada team: `enforceCreditBudget` → derive → save
- Se FORBIDDEN (free tier esgotado): skip team, retoma no mês seguinte
- Ao final do batch por team: publica **uma** notificação consolidada

**Notificação consolidada (toast):**
```
"Palavras-chave configuradas para [N] categorias."
```

---

## Billing

### `ai.keyword_derived`
**Preço:** R$0,01 por execução  
**Free tier:** 100/mês  
**Aplica-se ao backfill:** sim

### `notifications.delivered`
**Preço:** R$0,001 por notificação entregue (toast visível ao usuário)  
**Free tier:** 1.000/mês  
**Cobrado quando:** notificação chega ao cliente via SSE e gera toast — não por conexão aberta

Registrar em:
- `packages/events/src/ai.ts` — `AI_PRICING`, schema, `emitAiKeywordDerived`
- `packages/events/src/notifications.ts` — `NOTIFICATION_PRICING`, schema, `emitNotificationDelivered`
- `@core/stripe/constants` — free tiers: `ai.keyword_derived: 100`, `notifications.delivered: 1000`

---

## Frontend — `useJobNotifications`

**Arquivo:** `apps/web/src/features/notifications/use-job-notifications.ts`

- Chamado uma única vez em `_dashboard.tsx`
- Dispatch por `notification.type`:
  - `ai.keyword_derived` → `invalidateQueries(categories.getAll)` + toast + `emitNotificationDelivered`
  - `cron.keywords_backfill` → `invalidateQueries(categories.getAll)` + toast consolidado + `emitNotificationDelivered`
- `emitNotificationDelivered` é chamado no cliente após exibir o toast — só cobra quando o usuário realmente vê

---

## UX Copy

| Situação | Copy |
|---|---|
| Toast sucesso (por categoria) | "Palavras-chave geradas para [Nome da Categoria]." |
| Toast sucesso (backfill batch) | "Palavras-chave configuradas para [N] categorias." |
| Toast erro | "Não foi possível gerar palavras-chave." |
| Subtexto erro | "Tente novamente ou adicione manualmente nas configurações da categoria." |
| Indicador de processamento (inline) | "Gerando palavras-chave..." |
| Estado vazio — pendente | "A Rubi vai sugerir palavras-chave automaticamente para melhorar a categorização das suas transações." |
| Estado vazio — falhou | "Não foi possível gerar sugestões automaticamente. Você pode adicionar palavras-chave manualmente." |

**Regras de tom:**
- Nunca expor modelo LLM ou termos técnicos ao usuário final
- Preferir "automaticamente" a "IA" no copy público
- "Rubi" pode aparecer em mensagens informativas, não em erros

---

## Plano de Implementação

### 1. Billing — `packages/events/src/ai.ts`
- Adicionar `"ai.keyword_derived": "0.010000"` em `AI_PRICING`
- Adicionar `aiKeywordDerivedEventSchema` e `emitAiKeywordDerived`
- Registrar free tier em `@core/stripe/constants`

### 2. Publisher — `packages/events/src/notifications.ts` + `apps/web/src/integrations/orpc/publisher.ts`
- Definir `jobNotificationSchema` e `JobNotification` em `packages/events`
- Instanciar `IORedisPublisher` singleton em `apps/web` e `apps/server`
- Instalar `@orpc/experimental-publisher` em ambos os apps

### 3. SSE — `apps/web/src/integrations/orpc/router/notifications.ts`
- Criar procedure `subscribe` com `eventIterator(jobNotificationSchema)` + filtro por `teamId`
- Registrar no router index

### 4. Hook — `apps/web/src/features/notifications/use-job-notifications.ts`
- Criar `useJobNotifications()`
- Plugar em `_dashboard.tsx`

### 5. Workflow — `apps/server/src/workflows/derive-keywords.workflow.ts`
- Implementar `DeriveKeywordsWorkflow` com DBOS + neverthrow
- Endpoint interno `POST /internal/jobs/derive-keywords`

### 6. Disparo — `apps/web/src/integrations/orpc/router/categories.ts`
- Fire-and-forget após `create` e `update`

### 7. Cron — `apps/server/src/workflows/backfill-keywords.cron.ts`
- DBOS cron diário para backfill com `enforceCreditBudget`

### 8. UI — indicador de processamento
- Badge "Gerando palavras-chave..." nas categorias sem keywords
- Empty states nos dois estados (pendente / falhou)
