# Montte AI — Chat Refactor Plan

Plano de refactor completo do chat (Rubi/Montte AI). Zero bloat, server source-of-truth, types nativos `@tanstack/ai`, streaming end-to-end.

## Métricas alvo

- Chat LOC: 2300 → ~1100
- Round-trips por mensagem: 3 → 1
- Types redefinidos: 5 → 0
- Source-of-truth: client → server
- Total tasks: 15

---

## Princípios

1. **Server é source-of-truth.** Cliente envia `text` puro, NUNCA `UIMessage`. Server gera UUIDs + INSERT.
2. **Persistência incremental** (append-only). Sem delete+insert.
3. **Side-effects assíncronos via DBOS.** Título, futuros embeddings, etc.
4. **Tipos nativos `@tanstack/ai`.** `UIMessage`, `MessagePart`, `ToolCallPart` direto.
5. **Metadata enxuta** — só o que UI precisa e PostHog não cobre.
6. **Drizzle padrão** — `.defaultRandom()`, `.references()`, sem `pg_catalog.` boilerplate.

---

## F0 — Schema migration

### `core/database/src/schemas/messages.ts`

```ts
import { sql } from "drizzle-orm";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { index, integer, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import type { UIMessage } from "@tanstack/ai";
import { agentsSchema } from "@core/database/schemas/schemas";
import { threads } from "@core/database/schemas/threads";

export const messageRoleEnum = agentsSchema.enum("message_role", [
   "system",
   "user",
   "assistant",
]);

export const messageMetadataSchema = z.object({
   traceId: z.string().optional(),
   followUps: z.array(z.string()).max(3).optional(),
   pageContext: z
      .object({
         route: z.string().optional(),
         title: z.string().optional(),
         skillHint: z.string().optional(),
      })
      .optional(),
});
export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

export const messages = agentsSchema.table(
   "messages",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => threads.id, { onDelete: "cascade" }),
      role: messageRoleEnum("role").notNull(),
      parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
      metadata: jsonb("metadata").$type<MessageMetadata>(),
      version: integer("version").notNull().default(1),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (t) => [index("messages_thread_created_idx").on(t.threadId, t.createdAt)],
);

export const messageSchema = createSelectSchema(messages);
export const insertMessageSchema = createInsertSchema(messages);
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

### `core/database/src/schemas/agents.ts`

Adicionar:

```ts
export const reasoningEffortEnum = platformSchema.enum("reasoning_effort", [
   "low",
   "medium",
   "high",
]);

// dentro de agentSettings:
reasoningEffort: reasoningEffortEnum("reasoning_effort").notNull().default("low"),
```

Rodar:

```bash
bun run db:push
```

### Decisões

- **Drop `position`** — `now()` por tx + 2 txs distintas (user vs assistant pós-stream) = ordering natural por `createdAt`. Concurrent send race via `pg_advisory_xact_lock(hashtext(threadId))` no `requireThread` middleware.
- **`version int default 1`** — escape hatch p/ futura migration de `UIMessage["parts"]` shape se `@tanstack/ai` versionar.
- **`metadata` zod-typed** — single source via `z.infer`. Validado runtime antes de INSERT.
- **UUIDs** — `defaultRandom()` (v4) idiomático Drizzle, alinhado com resto do projeto.

---

## F1 — Server (5 tasks)

### F1a — DBOS workflow `generate-thread-title`

**Arquivos novos:**

- `modules/agents/src/workflows/generate-title.ts`
- `modules/agents/src/workflows/setup.ts`

**Workflow:**

1. Step `runTransaction` — load 4 últimas msgs do thread.
2. Step — `chat({ adapter: flashModel, stream: false, ...prompt pt-BR título 6 palavras })`.
3. Step `runTransaction` — `UPDATE threads SET title WHERE id AND title IS NULL`.
4. Step — publish SSE `agent.thread.title-updated`.

**Setup:**

- `await DrizzleDataSource.initializeDBOSSchema(...)` para `agentsDataSource`.
- Init context store.
- Queue `workflow:agent-title` concurrency 5.
- Side-effect import dos arquivos workflow.

**Wire:**

- `apps/worker/src/index.ts`: chamar `setupAgentsWorkflows(deps)` antes de `DBOS.launch()`.

**WorkflowID determinístico:** `agents:title:${threadId}` — idempotente.

### F1b — `chat.ts` refactor (server source-of-truth)

**Input:**

```ts
{
  threadId: z.string().uuid(),
  text: z.string().min(1).max(50000),
  pageContext: pageContextSchema.optional(),
}
```

**NÃO aceita `UIMessage` do client.** Server gera UUID + parts.

**Handler:**

```typescript
export const send = protectedProcedure
   .input(sendInputSchema)
   .use(requireThread, (input) => input.threadId) // + advisory lock
   .output(eventIterator(z.custom<StreamChunk>()))
   .handler(async function* ({ context, input, signal }) {
      // 1. INSERT user msg em tx
      const userMsg = await context.db.transaction(async (tx) => {
         const [row] = await tx
            .insert(messages)
            .values({
               threadId: input.threadId,
               role: "user",
               parts: [{ type: "text", content: input.text }],
               metadata: input.pageContext
                  ? { pageContext: input.pageContext }
                  : undefined,
            })
            .returning();
         return row;
      });

      // 2. Load histórico
      const history = await context.db
         .select()
         .from(messages)
         .where(eq(messages.threadId, input.threadId))
         .orderBy(asc(messages.createdAt));

      // 3. Load settings
      const settings = await context.db.query.agentSettings.findFirst({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
      });

      // 4. Build args + stream
      const args = await buildAgentChatArgs({
         /* ... */
         messages: history,
         reasoningEffort: settings?.reasoningEffort ?? "low",
         abortSignal: signal,
      });

      let traceId: string | undefined;
      const assistantParts: UIMessage["parts"] = [];

      for await (const chunk of chat(args)) {
         if (chunk.type === "RUN_STARTED" && "runId" in chunk) {
            traceId = chunk.runId as string;
         }
         // accumulate parts in assistantParts based on chunk type
         yield chunk;
      }

      // 5. Generate follow-ups (F1d)
      const followUps = await generateFollowUps(history, assistantParts);

      // 6. INSERT assistant msg em tx
      await context.db.transaction(async (tx) => {
         await tx.insert(messages).values({
            threadId: input.threadId,
            role: "assistant",
            parts: assistantParts,
            metadata: messageMetadataSchema.parse({ traceId, followUps }),
         });
         await tx
            .update(threads)
            .set({ lastMessageAt: dayjs().toDate() })
            .where(eq(threads.id, input.threadId));
      });

      // 7. Enqueue title workflow
      const thread = context.thread; // do middleware
      if (thread.title === null) {
         await context.workflowClient.enqueue(generateThreadTitleWorkflow, {
            workflowID: `agents:title:${input.threadId}`,
            queueName: "workflow:agent-title",
            input: {
               threadId: input.threadId,
               teamId: context.teamId,
               organizationId: context.organizationId,
            },
         });
      }

      // 8. Publish SSE
      await sse.publish("team", context.teamId, {
         type: "agent.message.persisted",
         threadId: input.threadId,
      });
   });
```

**Limpeza em `threads.ts`:**

- Deletar `syncMessages` procedure.
- Deletar `updateTitle` procedure.
- Deletar `uiMessageSchema` + `syncMessagesInputSchema`.
- `getById` continua retornando `{ thread, messages }` — server source-of-truth.

### F1c — `agent.regenerate` + `agent.editAndResend`

**Arquivo novo:** `modules/agents/src/router/agent.ts`.

**Procedures:**

- `agent.regenerate({ threadId })` — tx delete últimas msgs do bloco assistant final + reusa fluxo F1b.
- `agent.editAndResend({ messageId, text })` — tx trunca msgs com `createdAt >= target.createdAt` + INSERT novo user + reusa fluxo F1b.

Streaming via `eventIterator`. Server-only — client chama via `useMutation`.

### F1d — Follow-ups middleware

**Helper:** `generateFollowUps(history, assistantParts): Promise<string[]>` em `core/ai` ou inline em `agent.ts`.

```typescript
const result = await chat({
   adapter: flashModel,
   stream: false,
   outputSchema: z.array(z.string()).max(3),
   messages: [
      {
         role: "user",
         content: [
            {
               type: "text",
               content: `Baseado nestas mensagens, sugira até 3 perguntas curtas em pt-BR que o usuário poderia fazer em seguida. ${JSON.stringify({ history: history.slice(-2), assistantParts })}`,
            },
         ],
      },
   ],
});
```

Resultado popula `metadata.followUps` no INSERT do assistant (F1b).

### F1e — `threads.search` server-side

**Procedure:** `threads.search({ query, limit })` — ParadeDB BM25 em `threads.title` (skill `paradedb-skill`).

Mata anti-pattern de busca em-memória limitada a 50.

Sidebar consome quando `query.length > 0`.

---

## F2 — Client (6 tasks)

### F2a — `chat-store.tsx` ~80 LOC

```typescript
import { useChat, stream as aiStream, type UIMessage } from "@tanstack/ai-react";
import { createStore, useStore } from "@tanstack/react-store";
import { createPersistedStore } from "@/lib/store";
import { client, orpc } from "@/integrations/orpc/client";

const chatStore = createStore<{
   activeThreadId: string | null;
   panelOpen: boolean;
}>({ activeThreadId: null, panelOpen: false });

const scopeStore = createPersistedStore<{ id: AgentScopeId }>(
   "montte:chat:scope",
   { id: "auto" },
);

const agentConnection = aiStream(async function* (messages, { signal }) {
   const { activeThreadId } = chatStore.state;
   if (!activeThreadId) return;
   const lastUser = messages.findLast((m) => m.role === "user");
   const text = lastUser?.parts.flatMap((p) =>
      p.type === "text" ? [p.content] : [],
   ).join("") ?? "";
   yield* await client.agent.send({
      threadId: activeThreadId,
      text,
      pageContext: chatStore.state.pageContext,
   }, { signal });
});

export function ChatSessionProvider({ children }) {
   const activeThreadId = useStore(chatStore, (s) => s.activeThreadId);
   return (
      <SessionInner activeThreadId={activeThreadId} key={activeThreadId ?? "new"}>
         {children}
      </SessionInner>
   );
}

// SessionInner usa useSuspenseQuery threads.getById quando activeThreadId !== null,
// passa initialMessages p/ useChat. Sem syncMessages, sem traceIdsRef.
```

**Drop:**

- `syncMessages`, `traceIdsRef`, `pendingTraceIdRef`
- Helpers `pendingApprovalIds`, `lastUserText` (inline com `findLast`)
- `regenerate`/`editAndResend` locais → `useMutation(orpc.agent.*.mutationOptions())`
- `setPageContext` se sem callsite real
- `scopeOpen` global (Popover gerencia interno)

**`traceId`:** lê de `message.metadata?.traceId`.

### F2b — `message-item.tsx` refactor

- Importar `MessagePart`, `ToolCallPart` de `@tanstack/ai-react`. Drop `Extract<>`.
- Drop `groupParts` + `Group` discriminated union — render parts in-order, agrupar tool-calls consecutivas inline com pequeno reduce.
- **Bloco "Fontes"** se message contém tool-call `web_search` com output — grid 2-col de cards (favicon/host, title, snippet).
- **Chips de follow-up** se `isLast && message.metadata?.followUps?.length` — onClick `session.sendMessage(text)`.
- `traceId` de `message.metadata?.traceId`.

### F2c — Composer (mantém `useForm`)

**Expand toggle (não auto-resize):**

```tsx
const [expanded, setExpanded] = useState(false);

<div className="relative w-full rounded-xl border bg-background">
   <Button
      aria-label={expanded ? "Recolher" : "Expandir"}
      className="absolute right-2 top-2 size-7 text-muted-foreground"
      onClick={() => setExpanded((v) => !v)}
      size="icon"
      type="button"
      variant="ghost"
   >
      {expanded ? (
         <Minimize2 className="size-4" />
      ) : (
         <Maximize2 className="size-4" />
      )}
   </Button>
   <form.Field name="message">
      {(field) => (
         <Textarea
            className={cn(
               "resize-none border-0 bg-transparent px-4 py-2 pr-10 text-base shadow-none focus-visible:ring-0",
               expanded ? "min-h-[320px]" : "min-h-[80px]",
            )}
            // ...
         />
      )}
   </form.Field>
   {/* footer: ScopePicker + EffortPicker + send/stop */}
</div>;
```

**EffortPicker** (item 13):

- Popover next ao ScopePicker
- Opções: low / medium / high
- Mutation `orpc.agentSettings.update({ reasoningEffort })`

Server (F1b) lê `agentSettings.reasoningEffort` e passa em `modelOptions.reasoning.effort`.

### F2d — Keyboard shortcuts

**Lib:** `tinykeys` (catalog ui).

**Bindings globais (registrar em `panel.tsx` ou root layout):**

- `Cmd+J` toggle `panelOpen` no chatStore
- `Cmd+Shift+J` resetChat + open
- `Esc` durante stream → `session.stop()`
- `↑` em composer vazio → `form.setFieldValue("message", lastUserText)`

**Discovery UI:** botão `?` no panel header → Sheet listando atalhos.

### F2e — Approval batch via `useSelectionToolbar`

**Drop banner sticky** `panel.tsx:83-105`.

**Hook novo `useApprovalSelectionBar`** em `chat-store.tsx`:

```typescript
function useApprovalSelectionBar() {
   const session = useChatSession();
   const ids = session.pendingApprovalIds;

   const toolbar = useSelectionToolbar(({ selectedIndices, clear }) => (
      <>
         <SelectionActionButton onClick={async () => {
            for (const i of selectedIndices) await session.rejectTool(ids[i]!);
            clear();
         }}>Negar</SelectionActionButton>
         <SelectionActionButton onClick={async () => {
            for (const i of selectedIndices) await session.approveTool(ids[i]!);
            clear();
         }}>Aprovar ({selectedIndices.size})</SelectionActionButton>
      </>
   ));

   useIsomorphicLayoutEffect(() => {
      if (ids.length >= 2) {
         toolbar.replace(new Set(ids.map((_, i) => i)));
      }
   }, [ids.length]);

   return toolbar;
}
```

`ToolGroup` em `message-item.tsx` recebe toolbar + globalIdx → checkbox por approval card.

**Atalhos** quando `selectedIndices.size > 0`:

- `A` aprova selecionados
- `R` rejeita
- `Esc` limpa

`SelectionActionBar` global já está em `__root.tsx`.

### F2f — Panel/list/empty cleanup

- `panel.tsx`: skeleton (header + 2 message stubs) em vez de `fallback={null}`.
- ScopePicker open interno (drop `scopeOpen` do store).
- Sidebar consome `threads.search` quando `query.length > 0`.
- Imports nova API session.

### F2g — Message footer feedback (thumbs + copy)

`message-footer.tsx` já usa `useThumbSurvey` + `useClipboard`. Adicionar feedback visível:

**Copy:**

- Toast `toast.success("Copiado")` no `onClick` após `copy(text)` resolver. Mantém ícone `Check` 1.5s (já existe).

**Thumbs up/down:**

- State visual já existe (`response === "up"|"down"` muda cor).
- Toast no `respond`:
   - `up` → `toast.success("Obrigado pelo feedback")`
   - `down` → `toast("Feedback registrado", { description: "Vamos melhorar." })`
- Disable buttons após responder (idempotência visual): `disabled={response !== undefined}`.
- Ler `traceId` de `message.metadata?.traceId` (não mais via `useChatSession().traceIdFor`).

Props mudam para `{ messageId, text, traceId }` — passados direto pelo `MessageItem`.

---

## F3 — SSE client subscriptions

**`useQuery + experimental_liveOptions`** em:

- `threads.list` — consome `agent.thread.title-updated` + `agent.thread.created`
- `threads.getById` — consome `agent.message.persisted` (thread atual)

**Drop** invalidates manuais do `onFinish` (já removidos em F2a).

---

## F4 — Final checks

```bash
bun run typecheck
bun run check
bun run check-boundaries
```

**Smoke E2E manual:**

1. Nova thread → send → stream renderiza → DB persist (verificar via `db:studio`)
2. Title workflow async (verificar SSE update na sidebar)
3. Follow-ups chips aparecem após resposta
4. Reasoning toggle muda effort no próximo turno
5. Web search citation renderiza bloco "Fontes"
6. Atalhos funcionam (`Cmd+J`, `Esc`, `↑`)
7. Approval batch via SelectionToolbar
8. SSE live update em segunda aba

---

## Ordem de execução

```
F0 (bloqueia)
  ├── F1a (paralelo)
  └── F1b ─→ F1c ─→ F1d ─→ F1e
              │
              └─→ F2a ─→ F2b ─→ F2c ─→ F2d ─→ F2e ─→ F2f
                    │
                    └─→ F3 ─→ F4
```

---

## Sources / Research

- [TanStack AI Streaming](https://tanstack.com/ai/latest/docs/chat/streaming)
- [TanStack AI Client API](https://tanstack.com/ai/latest/docs/api/ai-client)
- [TanStack AI UIMessage Reference](https://tanstack.com/ai/latest/docs/reference/interfaces/UIMessage)
- [Vercel AI SDK Persistence (referência cruzada)](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [krasovsky22/tanstack-ai-assistant — schema real](https://github.com/krasovsky22/tanstack-ai-assistant/blob/master/src/db/schema.ts)
- [Durable Streams + TanStack AI](https://durablestreams.com/tanstack-ai)

---

## Garantias chave

- ✅ Server source-of-truth
- ✅ Zero trust client message ID
- ✅ Persistência incremental (sem delete+insert)
- ✅ DBOS p/ side-effects assíncronos
- ✅ TanStack AI types nativos
- ✅ Streaming end-to-end
- ✅ `useForm` no composer mantido
- ✅ Drizzle tx em todas writes
- ✅ UUID via `pg_catalog.gen_random_uuid()` (convenção projeto)
- ✅ Metadata zod-typed (`MessageMetadata`)
- ✅ Sem `position` column (bloat eliminado)
- ✅ Reusa `Textarea` packages/ui (sem dep externa)
- ✅ Reusa `useSelectionToolbar` existente
