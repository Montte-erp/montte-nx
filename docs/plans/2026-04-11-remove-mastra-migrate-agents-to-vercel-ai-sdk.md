# Remove Mastra + @assistant-ui — Migrate to TanStack AI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all `@mastra/*` and `@assistant-ui/*` packages with TanStack AI (`@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`). Full end-to-end chat powered by TanStack AI's `chat()` + `useChat()` with a custom UI layer.

**Architecture:**
- **Backend:** TanStack Start `/api/chat` route calls `chat()` from `@tanstack/ai` with OpenRouter adapter + middleware for auth, persistence, observability. Returns `toServerSentEventsResponse()`.
- **Frontend:** `useChat({ connection: fetchServerSentEvents('/api/chat', body) })` from `@tanstack/ai-react` drives all message state. Thread CRUD (list, create, delete) via existing oRPC procedures.
- **UI:** Custom React components replacing all `@assistant-ui/react` primitives. `thread.tsx` rewritten from scratch. Tool components get a local `RubiToolProps` type replacing `ToolCallMessagePartComponent`.
- **Persistence:** New Drizzle tables `platform.chat_threads` + `platform.chat_messages`. Chat repository with `appendMessages`, `getThreadMessages`, `updateThreadTitle`.
- **Markdown:** `@assistant-ui/react-streamdown` is dropped. Use `react-markdown` + `remark-gfm` (already in packages/ui) with syntax highlighting via `lowlight` (already in packages/ui).

**Tech Stack:** `@tanstack/ai`, `@tanstack/ai-react`, `@tanstack/ai-openrouter`, Drizzle ORM, oRPC, TanStack Query, TanStack Store

---

## What gets deleted

| File / Package | Replaced by |
|---|---|
| `core/agents/src/mastra/` (entire dir) | `core/agents/src/agent.ts` using `@tanstack/ai` |
| `@mastra/*` packages | `@tanstack/ai`, `@tanstack/ai-openrouter` |
| `@assistant-ui/react` | Custom components + `useChat` |
| `@assistant-ui/react-ai-sdk` | `@tanstack/ai-react` |
| `@assistant-ui/react-markdown` | `react-markdown` + `lowlight` (already installed) |
| `@ai-sdk/react` (catalog:assistant-ui) | `@tanstack/ai-react` |
| `apps/web/src/features/rubi-chat/hooks/use-rubi-runtime.ts` | `use-rubi-chat.ts` |
| `packages/ui/src/components/assistant-ui/attachment.tsx` | Simple file input with `react-dropzone` |
| `packages/ui/src/components/assistant-ui/model-selector.tsx` | Same file, `useAui` removed |
| `packages/ui/src/components/assistant-ui/markdown-text.tsx` | Rewritten with `react-markdown` |
| `packages/ui/src/components/assistant-ui/tool-fallback.tsx` | Inline in thread.tsx |

---

## Context You Must Know

- **`core/agents`** currently: `mastra/index.ts`, `mastra/agents/rubi-agent.ts`, `mastra/workspace-instance.ts`, `models.ts`, `utils.ts`
- **TanStack AI `chat()`** takes `{ adapter, messages, systemPrompts, tools, middleware, conversationId }` and returns an async iterable of AG-UI stream chunks
- **`toServerSentEventsResponse(stream)`** converts to SSE HTTP response
- **`useChat({ connection })`** manages `messages: UIMessage[]`, `sendMessage`, `isLoading`, `stop`
- **`UIMessage.parts`** is `Array<{ type: 'text', content: string } | { type: 'thinking', content: string } | { type: 'tool-call', toolCallId, toolName, args, argsText, status, result }>` 
- **Tool call status** in TanStack AI: `awaiting-input` | `input-streaming` | `input-complete` | `completed`
- **`fetchServerSentEvents(url, options | () => options)`** — `options.body` is merged into the POST body alongside `messages`
- **Thread list** is managed manually via `useSuspenseQuery(orpc.chat.listThreads)` + `useMutation` — no library abstraction
- **No branch picker** — TanStack AI has no multi-branch support. Drop `BranchPickerPrimitive` entirely.
- **`makeAssistantToolUI`** (write-content-tool.tsx) — global tool UI registration. Replaced by a `TOOL_UI_REGISTRY` map in `thread.tsx`.
- **`chatContextStore`** (`model`, `thinkingBudget`, `contextId`, etc.) is independent of @assistant-ui — keep as-is.
- **`model-selector.tsx`** uses `useAui().modelContext().register()` to tell the AI SDK transport which model to use. In TanStack AI, model comes from `chatContextStore` and is passed in `fetchServerSentEvents` body. Remove the `useAui` call.

---

## Task 1: DB schema — chat_threads + chat_messages

**Files:**
- Create: `core/database/src/schemas/chat.ts`
- Modify: `core/database/src/schema.ts`

**Step 1: Read `core/database/src/schemas/bank-accounts.ts`** to understand the platform schema pattern.

**Step 2: Create `core/database/src/schemas/chat.ts`**

```typescript
import { index, jsonb, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";

export const chatThreads = platformSchema.table(
   "chat_threads",
   {
      id: uuid("id").primaryKey().defaultRandom(),
      resourceId: varchar("resource_id", { length: 255 }).notNull(),
      title: text("title"),
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (t) => [index("chat_threads_resource_id_idx").on(t.resourceId)],
);

export const chatMessages = platformSchema.table(
   "chat_messages",
   {
      id: uuid("id").primaryKey().defaultRandom(),
      threadId: uuid("thread_id")
         .notNull()
         .references(() => chatThreads.id, { onDelete: "cascade" }),
      role: varchar("role", { length: 20 }).notNull(),
      parts: jsonb("parts").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   },
   (t) => [index("chat_messages_thread_id_idx").on(t.threadId)],
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
```

**Step 3: Add to `core/database/src/schema.ts`**

```typescript
export * from "@core/database/schemas/chat";
```

**Step 4: Push schema**

```bash
bun run db:push
```

**Step 5: Commit**

```bash
git add core/database/src/schemas/chat.ts core/database/src/schema.ts
git commit -m "feat(database): add chat_threads and chat_messages tables"
```

---

## Task 2: Chat repository

**Files:**
- Create: `core/database/src/repositories/chat-repository.ts`

**Step 1: Read `core/database/src/repositories/agent-settings-repository.ts`** for the `AppError` + `propagateError` pattern.

**Step 2: Create `core/database/src/repositories/chat-repository.ts`**

```typescript
import { desc, eq, sql } from "drizzle-orm";
import { AppError, propagateError } from "@core/logging/errors";
import type { DatabaseInstance } from "@core/database/client";
import { chatMessages, chatThreads } from "@core/database/schemas/chat";
import type { ChatThread } from "@core/database/schemas/chat";

export type StoredMessage = {
   id: string;
   role: string;
   parts: unknown;
   createdAt: Date;
};

export async function listThreads(
   db: DatabaseInstance,
   resourceId: string,
   page: number,
   perPage: number,
): Promise<{ threads: ChatThread[]; total: number; hasMore: boolean }> {
   try {
      const [rows, countResult] = await Promise.all([
         db
            .select()
            .from(chatThreads)
            .where(eq(chatThreads.resourceId, resourceId))
            .orderBy(desc(chatThreads.updatedAt))
            .limit(perPage)
            .offset(page * perPage),
         db
            .select({ count: sql<string>`count(*)` })
            .from(chatThreads)
            .where(eq(chatThreads.resourceId, resourceId)),
      ]);
      const total = Number(countResult[0]?.count ?? 0);
      return {
         threads: rows,
         total,
         hasMore: page * perPage + rows.length < total,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list threads");
   }
}

export async function createThread(
   db: DatabaseInstance,
   resourceId: string,
   title?: string,
   metadata?: Record<string, unknown>,
): Promise<ChatThread> {
   try {
      const [row] = await db
         .insert(chatThreads)
         .values({ resourceId, title, metadata })
         .returning();
      if (!row) throw AppError.database("Failed to create thread");
      return row;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create thread");
   }
}

export async function getThreadById(
   db: DatabaseInstance,
   threadId: string,
): Promise<ChatThread | null> {
   try {
      const [row] = await db
         .select()
         .from(chatThreads)
         .where(eq(chatThreads.id, threadId))
         .limit(1);
      return row ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get thread");
   }
}

export async function deleteThread(
   db: DatabaseInstance,
   threadId: string,
): Promise<void> {
   try {
      await db.delete(chatThreads).where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete thread");
   }
}

export async function updateThreadTitle(
   db: DatabaseInstance,
   threadId: string,
   title: string,
): Promise<void> {
   try {
      await db
         .update(chatThreads)
         .set({ title, updatedAt: new Date() })
         .where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update thread title");
   }
}

export async function getThreadMessages(
   db: DatabaseInstance,
   threadId: string,
): Promise<StoredMessage[]> {
   try {
      const rows = await db
         .select()
         .from(chatMessages)
         .where(eq(chatMessages.threadId, threadId))
         .orderBy(chatMessages.createdAt);
      return rows.map((r) => ({
         id: r.id,
         role: r.role,
         parts: r.parts,
         createdAt: r.createdAt,
      }));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get messages");
   }
}

export async function appendMessages(
   db: DatabaseInstance,
   threadId: string,
   messages: Array<{ id: string; role: string; parts: unknown }>,
): Promise<void> {
   if (messages.length === 0) return;
   try {
      await db.insert(chatMessages).values(
         messages.map((m) => ({
            id: m.id,
            threadId,
            role: m.role,
            parts: m.parts,
         })),
      );
      await db
         .update(chatThreads)
         .set({ updatedAt: new Date() })
         .where(eq(chatThreads.id, threadId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to append messages");
   }
}
```

**Step 3: Commit**

```bash
git add core/database/src/repositories/chat-repository.ts
git commit -m "feat(database): add chat repository"
```

---

## Task 3: Install TanStack AI packages + update catalogs

**Files:**
- Modify: root `package.json` (add `tanstack-ai` catalog)
- Modify: `apps/web/package.json`
- Modify: `core/agents/package.json`

**Step 1: Check latest TanStack AI versions**

```bash
npm info @tanstack/ai version
npm info @tanstack/ai-react version
npm info @tanstack/ai-openrouter version
```

**Step 2: Add `tanstack-ai` catalog to root `package.json`**

Inside `"workspaces": { "catalogs": { ... } }`, add:

```json
"tanstack-ai": {
   "@tanstack/ai": "^0.x.0",
   "@tanstack/ai-react": "^0.x.0",
   "@tanstack/ai-openrouter": "^0.x.0"
}
```

**Step 3: Update `apps/web/package.json`**

In dependencies, add:
```json
"@tanstack/ai": "catalog:tanstack-ai",
"@tanstack/ai-react": "catalog:tanstack-ai"
```

Remove from dependencies:
```json
"@ai-sdk/react": "catalog:assistant-ui",
"@assistant-ui/react-ai-sdk": "catalog:assistant-ui"
```

**Step 4: Update `core/agents/package.json`**

Remove all `@mastra/*`, add TanStack AI + posthog:

```json
{
   "name": "@core/agents",
   "version": "0.26.0",
   "private": true,
   "license": "Apache-2.0",
   "files": ["dist"],
   "type": "module",
   "exports": {
      ".": {
         "types": "./dist/agent.d.ts",
         "default": "./dist/agent.js"
      },
      "./models": {
         "types": "./dist/models.d.ts",
         "default": "./dist/models.js"
      },
      "./utils": {
         "types": "./dist/utils.d.ts",
         "default": "./dist/utils.js"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/database": "workspace:*",
      "@core/environment": "workspace:*",
      "@core/logging": "workspace:*",
      "@core/utils": "workspace:*",
      "@tanstack/ai": "catalog:tanstack-ai",
      "@tanstack/ai-openrouter": "catalog:tanstack-ai",
      "zod": "catalog:validation"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 5: Update `packages/ui/package.json`**

Remove from dependencies:
```json
"@ai-sdk/react",
"@assistant-ui/react",
"@assistant-ui/react-markdown"
```

**Step 6: Install**

```bash
bun install
```

**Step 7: Commit**

```bash
git add package.json apps/web/package.json core/agents/package.json packages/ui/package.json
git commit -m "chore: add TanStack AI catalog, remove @mastra/* and @assistant-ui/* from deps"
```

---

## Task 4: Rewrite core/agents — chat() + openRouterText()

**Files:**
- Delete: `core/agents/src/mastra/index.ts`, `core/agents/src/mastra/agents/rubi-agent.ts`, `core/agents/src/mastra/workspace-instance.ts`
- Create: `core/agents/src/agent.ts`
- Modify: `core/agents/src/utils.ts` (remove `MastraLLMUsage`)

**Step 1: Create `core/agents/src/agent.ts`**

```typescript
import { chat, type ChatMiddleware } from "@tanstack/ai";
import { openRouterText } from "@tanstack/ai-openrouter";
import type { DatabaseInstance } from "@core/database/client";
import * as chatRepo from "@core/database/repositories/chat-repository";
import { env } from "@core/environment/web";
import {
   AVAILABLE_MODELS,
   DEFAULT_CONTENT_MODEL_ID,
   type ModelId,
} from "@core/agents/models";
import { buildLanguageInstruction } from "@core/agents/utils";

export type ChatRubiOptions = {
   db: DatabaseInstance;
   userId: string;
   teamId: string;
   organizationId: string;
   threadId: string;
   messages: unknown[];
   modelId?: string;
   language?: string;
   thinkingBudget?: number;
};

function buildSystemPrompt(language: string): string {
   const languageInstruction = buildLanguageInstruction(language ?? "pt-BR");
   return `${languageInstruction}

# RUBI — ASSISTENTE MONTTE

Você é a Rubi, assistente de IA da Montte — um ERP financeiro para pequenas e médias empresas.
Seu nome é inspirado no beijaflor gravatinha vermelha, mascote da Montte.

## SUAS CAPACIDADES

Você pode ajudar os usuários com:
- Dúvidas sobre finanças, contabilidade e gestão empresarial
- Orientações sobre funcionalidades da plataforma (transações, contas, categorias, metas, etc.)
- Análise e interpretação de dados financeiros
- Sugestões de organização financeira e orçamento

## COMPORTAMENTO

- Seja direto e objetivo nas respostas
- Use linguagem acessível, evitando jargões desnecessários
- Quando não souber algo específico do contexto do usuário, pergunte
- Nunca invente dados financeiros — trabalhe apenas com informações fornecidas`;
}

function createPersistenceMiddleware(
   db: DatabaseInstance,
   threadId: string,
   userMessages: unknown[],
   language: string,
): ChatMiddleware {
   return {
      name: "montte-persistence",
      onStart: async () => {
         // Save user messages before streaming
         const lastUser = [...userMessages].reverse().find(
            (m) => (m as { role: string }).role === "user",
         ) as { role: string; parts: unknown; id?: string } | undefined;
         if (lastUser) {
            await chatRepo.appendMessages(db, threadId, [
               {
                  id: crypto.randomUUID(),
                  role: "user",
                  parts: lastUser.parts ?? [],
               },
            ]);
         }
      },
      onFinish: async (_ctx, info) => {
         // Save assistant response
         const assistantId = crypto.randomUUID();
         await chatRepo.appendMessages(db, threadId, [
            {
               id: assistantId,
               role: "assistant",
               parts: [{ type: "text", content: info.content }],
            },
         ]);
         // Generate title in background
         void generateThreadTitle(db, threadId, userMessages, language);
      },
   };
}

export function chatRubi({
   db,
   userId,
   teamId,
   organizationId,
   threadId,
   messages,
   modelId,
   language = "pt-BR",
}: ChatRubiOptions) {
   const resolvedModelId: ModelId =
      modelId && modelId in AVAILABLE_MODELS
         ? (modelId as ModelId)
         : DEFAULT_CONTENT_MODEL_ID;
   const preset = AVAILABLE_MODELS[resolvedModelId];

   return chat({
      adapter: openRouterText(resolvedModelId, {
         temperature: preset.temperature,
         topP: preset.topP,
         maxTokens: preset.maxTokens,
         frequencyPenalty: preset.frequencyPenalty,
         presencePenalty: preset.presencePenalty,
      }),
      messages: messages as Parameters<typeof chat>[0]["messages"],
      systemPrompts: [buildSystemPrompt(language)],
      middleware: [
         createPersistenceMiddleware(db, threadId, messages, language),
      ],
   });
}

async function generateThreadTitle(
   db: DatabaseInstance,
   threadId: string,
   messages: unknown[],
   language: string,
): Promise<void> {
   const thread = await chatRepo.getThreadById(db, threadId);
   if (!thread || thread.title) return;
   const firstUser = messages.find(
      (m) => (m as { role: string }).role === "user",
   ) as { parts?: Array<{ type: string; content?: string }> } | undefined;
   if (!firstUser) return;
   const textPart = firstUser.parts?.find((p) => p.type === "text");
   if (!textPart?.content) return;
   try {
      const titleStream = chat({
         adapter: openRouterText("openrouter/qwen/qwen3.5-flash-02-23", {
            maxTokens: 20,
         }),
         messages: [
            {
               role: "user",
               content: `Generate a short title (max 6 words, no punctuation) in ${language} for: "${textPart.content.slice(0, 200)}"`,
            },
         ] as Parameters<typeof chat>[0]["messages"],
      });
      let title = "";
      for await (const chunk of titleStream) {
         if (
            chunk.type === "TEXT_MESSAGE_CONTENT" &&
            "delta" in chunk
         ) {
            title += chunk.delta;
         }
         if (chunk.type === "RUN_FINISHED") break;
      }
      if (title.trim()) await chatRepo.updateThreadTitle(db, threadId, title.trim());
   } catch {
      // best-effort
   }
}
```

**Step 2: Update `core/agents/src/utils.ts`** — remove `MastraLLMUsage`:

```typescript
export function buildLanguageInstruction(language: string): string {
   const languageMap: Record<string, string> = {
      "pt-BR":
         "OBRIGATÓRIO: Sempre escreva e responda EXCLUSIVAMENTE em Português Brasileiro (pt-BR). NUNCA use inglês ou qualquer outro idioma.",
      "en-US": "Always respond and write content in American English (en-US).",
      es: "Siempre responda y escriba contenido en Español.",
   };
   return `## IDIOMA DE SAÍDA\n${languageMap[language] ?? languageMap["pt-BR"]}`;
}
```

**Step 3: Delete old Mastra files**

```bash
rm core/agents/src/mastra/index.ts
rm core/agents/src/mastra/agents/rubi-agent.ts
rm core/agents/src/mastra/workspace-instance.ts
rmdir core/agents/src/mastra/agents
rmdir core/agents/src/mastra
```

**Step 4: Build**

```bash
cd core/agents && bun run build
```

**Step 5: Commit**

```bash
git add core/agents/
git commit -m "feat(agents): replace Mastra with TanStack AI chat() + openRouterText()"
```

---

## Task 5: Create /api/chat route + rewrite chat oRPC router

**Files:**
- Create: `apps/web/src/routes/api/chat/$.ts`
- Rewrite: `apps/web/src/integrations/orpc/router/chat.ts`

**Step 1: Create `apps/web/src/routes/api/chat/$.ts`**

```typescript
import { chatRubi } from "@core/agents";
import { auth } from "@core/authentication/server";
import { db } from "@core/database/client";
import * as chatRepo from "@core/database/repositories/chat-repository";
import { toServerSentEventsResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { ModelId } from "@core/agents/models";

const bodySchema = z.object({
   teamId: z.string().uuid(),
   threadId: z.string().uuid(),
   messages: z.array(z.unknown()),
   model: z.string().optional(),
   thinkingBudget: z.number().int().nonnegative().optional(),
   language: z.string().optional(),
});

async function handle({ request }: { request: Request }) {
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session) return new Response("Unauthorized", { status: 401 });

   const rawBody = await request.json().catch(() => null);
   const parsed = bodySchema.safeParse(rawBody);
   if (!parsed.success) return new Response("Bad Request", { status: 400 });

   const { teamId, threadId, messages, model, language } = parsed.data;
   const userId = session.user.id;

   const thread = await chatRepo.getThreadById(db, threadId);
   if (!thread || thread.resourceId !== `${teamId}:${userId}`) {
      return new Response("Forbidden", { status: 403 });
   }

   const stream = chatRubi({
      db,
      userId,
      teamId,
      organizationId: session.session.activeOrganizationId ?? "",
      threadId,
      messages,
      modelId: model as ModelId | undefined,
      language: language ?? "pt-BR",
   });

   return toServerSentEventsResponse(stream);
}

export const Route = createFileRoute("/api/chat/$")({
   server: {
      handlers: { POST: handle },
   },
});
```

**Step 2: Rewrite `apps/web/src/integrations/orpc/router/chat.ts`**

```typescript
import * as chatRepo from "@core/database/repositories/chat-repository";
import { WebAppError } from "@core/logging/errors";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const listThreads = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         page: z.number().int().min(0).default(0),
         perPage: z.number().int().min(1).max(50).default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      const result = await chatRepo.listThreads(
         context.db,
         `${input.teamId}:${context.userId}`,
         input.page,
         input.perPage,
      );
      return {
         threads: result.threads.map((t) => ({
            id: t.id,
            title: t.title ?? "Nova conversa",
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
         })),
         total: result.total,
         hasMore: result.hasMore,
      };
   });

export const createThread = protectedProcedure
   .input(
      z.object({
         teamId: z.uuid(),
         title: z.string().optional(),
         metadata: z.record(z.string(), z.unknown()).optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const thread = await chatRepo.createThread(
         context.db,
         `${input.teamId}:${context.userId}`,
         input.title,
         input.metadata,
      );
      return {
         id: thread.id,
         title: thread.title ?? "Nova conversa",
         createdAt: thread.createdAt,
      };
   });

export const deleteThread = protectedProcedure
   .input(z.object({ threadId: z.string() }))
   .handler(async ({ input, context }) => {
      const thread = await chatRepo.getThreadById(context.db, input.threadId);
      if (!thread?.resourceId.endsWith(`:${context.userId}`)) {
         throw WebAppError.forbidden("Thread not found or access denied");
      }
      await chatRepo.deleteThread(context.db, input.threadId);
   });

export const getThreadMessages = protectedProcedure
   .input(z.object({ threadId: z.string() }))
   .handler(async ({ input, context }) => {
      const thread = await chatRepo.getThreadById(context.db, input.threadId);
      if (!thread?.resourceId.endsWith(`:${context.userId}`)) {
         throw WebAppError.forbidden("Thread not found or access denied");
      }
      return chatRepo.getThreadMessages(context.db, input.threadId);
   });
```

**Step 3: Typecheck**

```bash
bun run typecheck 2>&1 | grep -E "error TS|api/chat|chat\.ts" | head -20
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/api/chat/ apps/web/src/integrations/orpc/router/chat.ts
git commit -m "feat(web): add /api/chat route (TanStack AI SSE) + rewrite chat oRPC router"
```

---

## Task 6: Rewrite use-rubi-runtime → use-rubi-chat

Replace `use-rubi-runtime.ts` with a simpler hook that uses `useChat` from TanStack AI.

**Files:**
- Delete: `apps/web/src/features/rubi-chat/hooks/use-rubi-runtime.ts`
- Create: `apps/web/src/features/rubi-chat/hooks/use-rubi-chat.ts`

**Step 1: Create `apps/web/src/features/rubi-chat/hooks/use-rubi-chat.ts`**

```typescript
import { useChat, fetchServerSentEvents } from "@tanstack/ai-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { chatContextStore } from "@/features/rubi-chat/stores/chat-context-store";
import { client, orpc } from "@/integrations/orpc/client";
import { useStore } from "@tanstack/react-store";

interface UseRubiChatOptions {
   teamId: string;
   onThreadCreated?: (threadId: string) => void;
}

export function useRubiChat({ teamId, onThreadCreated }: UseRubiChatOptions) {
   const queryClient = useQueryClient();
   const createThread = useMutation(orpc.chat.createThread.mutationOptions({}));

   const activeThreadIdRef = useRef<string | undefined>(undefined);
   const pendingThreadRef = useRef<Promise<string> | undefined>(undefined);
   const onThreadCreatedRef = useRef(onThreadCreated);
   onThreadCreatedRef.current = onThreadCreated;
   const createThreadRef = useRef(createThread.mutateAsync);
   createThreadRef.current = createThread.mutateAsync;
   const teamIdRef = useRef(teamId);
   teamIdRef.current = teamId;

   const model = useStore(chatContextStore, (s) => s.model);
   const thinkingBudget = useStore(chatContextStore, (s) => s.thinkingBudget);

   const ensureThread = useCallback(async (): Promise<string> => {
      if (activeThreadIdRef.current) return activeThreadIdRef.current;
      pendingThreadRef.current ??= createThreadRef
         .current({ teamId: teamIdRef.current })
         .then((thread) => {
            activeThreadIdRef.current = thread.id;
            onThreadCreatedRef.current?.(thread.id);
            // Invalidate thread list after creation
            void queryClient.invalidateQueries({
               queryKey: orpc.chat.listThreads.queryKey(),
            });
            return thread.id;
         })
         .finally(() => {
            pendingThreadRef.current = undefined;
         });
      return pendingThreadRef.current;
   }, [queryClient]);

   const connection = useMemo(
      () =>
         fetchServerSentEvents("/api/chat", async () => {
            const threadId = await ensureThread();
            return {
               body: {
                  teamId: teamIdRef.current,
                  threadId,
                  model,
                  ...(thinkingBudget > 0 ? { thinkingBudget } : {}),
               },
            };
         }),
      [ensureThread, model, thinkingBudget],
   );

   const chat = useChat({ connection });

   const selectThread = useCallback(
      async (threadId: string) => {
         activeThreadIdRef.current = threadId;
         // Load history and seed into useChat
         const messages = await client.chat.getThreadMessages({ threadId });
         // Reset chat with loaded messages
         chat.setMessages(
            messages.map((m) => ({
               id: m.id,
               role: m.role as "user" | "assistant",
               parts: Array.isArray(m.parts) ? m.parts : [],
            })),
         );
      },
      [chat],
   );

   const newThread = useCallback(() => {
      activeThreadIdRef.current = undefined;
      pendingThreadRef.current = undefined;
      chat.setMessages([]);
   }, [chat]);

   const deleteThread = useCallback(
      async (threadId: string) => {
         await client.chat.deleteThread({ threadId });
         if (activeThreadIdRef.current === threadId) {
            newThread();
         }
         void queryClient.invalidateQueries({
            queryKey: orpc.chat.listThreads.queryKey(),
         });
      },
      [newThread, queryClient],
   );

   return {
      ...chat,
      activeThreadId: activeThreadIdRef,
      selectThread,
      newThread,
      deleteThread,
   };
}
```

**Note:** Check whether `useChat` from `@tanstack/ai-react` exposes `setMessages`. If not, check what method is available for seeding initial messages (may be `reset(messages)` or a similar API). Read the types:

```bash
grep -r "setMessages\|reset\|initialMessages" /home/yorizel/Documents/montte-nx/node_modules/@tanstack/ai-react/dist/ --include="*.d.ts" | head -20
```

**Step 2: Commit**

```bash
git add apps/web/src/features/rubi-chat/hooks/use-rubi-chat.ts
git add apps/web/src/features/rubi-chat/hooks/use-rubi-runtime.ts  # for deletion
git rm apps/web/src/features/rubi-chat/hooks/use-rubi-runtime.ts
git commit -m "feat(web): replace use-rubi-runtime with use-rubi-chat (TanStack AI useChat)"
```

---

## Task 7: Rewrite thread.tsx — full custom UI

This is the largest change. `thread.tsx` currently uses ~20 `@assistant-ui/react` imports. We replace them with a custom implementation driven by `useRubiChat`.

**Files:**
- Rewrite: `apps/web/src/features/rubi-chat/ui/thread.tsx`

**The new architecture:**
- `Thread` component receives the `chat` object from `useRubiChat` (passed down via props or context)
- Messages: iterate `chat.messages`, render each part based on `part.type`
- Tool calls: `TOOL_UI_REGISTRY` maps `toolName → Component`
- Composer: `<textarea>` + submit button, `react-textarea-autosize` for auto-height
- No branch picker
- Scroll-to-bottom via `useRef` + `useEffect`

**Step 1: Define the tool props type and registry at the top of `thread.tsx`**

```typescript
// Replace ToolCallMessagePartComponent type from @assistant-ui
export type RubiToolProps = {
   toolName: string;
   argsText: string | undefined;
   status: {
      type: "running" | "complete" | "incomplete";
      reason?: string;
   };
   result: unknown;
};

type RubiToolComponent = FC<RubiToolProps>;

// Map tool names to their display components
const TOOL_UI_REGISTRY: Record<string, RubiToolComponent> = {
   "agent-research-agent": AgentCallTool,
   "agent-writer-agent": AgentCallTool,
   // ... (same mapping as current thread.tsx tools.by_name)
   "write-content": EditorTool,
   // etc.
};
```

**Step 2: Convert TanStack AI tool call status to RubiToolProps status**

```typescript
function toToolStatus(
   tsStatus: string,
): RubiToolProps["status"] {
   if (tsStatus === "awaiting-input" || tsStatus === "input-streaming" || tsStatus === "input-complete") {
      return { type: "running" };
   }
   return { type: "complete" };
}
```

**Step 3: Message renderer for a single `UIMessage`**

```typescript
function AssistantMessageParts({ parts }: { parts: UIMessage["parts"] }) {
   return (
      <>
         {parts.map((part, idx) => {
            if (part.type === "text") {
               return <MarkdownText key={idx} content={part.content} />;
            }
            if (part.type === "thinking") {
               return <ReasoningDisplay key={idx} text={part.content} />;
            }
            if (part.type === "tool-call") {
               const ToolUI = TOOL_UI_REGISTRY[part.toolName];
               const toolProps: RubiToolProps = {
                  toolName: part.toolName,
                  argsText: part.argsText,
                  status: toToolStatus(part.status ?? "completed"),
                  result: part.result,
               };
               if (ToolUI) return <ToolUI key={idx} {...toolProps} />;
               return <ToolFallback key={idx} {...toolProps} />;
            }
            return null;
         })}
      </>
   );
}
```

**Step 4: Write the full new `thread.tsx`**

The full component structure:
```
Thread (receives chat from useRubiChat via props)
├── scroll container (ref for auto-scroll)
│   ├── [empty state: ThreadWelcome]
│   ├── messages.map(msg =>
│   │   ├── UserMessage (role === 'user')
│   │   └── AssistantMessage (role === 'assistant')
│   │       └── AssistantMessageParts
│   └── [scroll anchor div ref]
└── Composer
    ├── attachments area (react-dropzone, optional)
    ├── TextareaAutosize
    └── action bar (model selector, send/stop button)
```

Key behaviours to replicate from old thread.tsx:
- Auto-scroll to bottom on new messages (useEffect on messages.length)
- Send on Enter (not Shift+Enter)  
- Stop button while `isLoading`
- Quick suggestion chips click → `chat.sendMessage(prompt)`
- Context items (context chips from `chatContextStore.contextId`)
- Model selector → `setChatModel()` from store

**Step 5: Typecheck**

```bash
bun run typecheck 2>&1 | grep "thread.tsx" | head -20
```

**Step 6: Commit**

```bash
git add apps/web/src/features/rubi-chat/ui/thread.tsx
git commit -m "feat(web): rewrite thread.tsx using TanStack AI useChat — remove @assistant-ui"
```

---

## Task 8: Rewrite thread-list.tsx

Replace `ThreadListPrimitive`, `ThreadListItemPrimitive`, `useAuiState` with `useSuspenseQuery` + `useMutation` on oRPC procedures.

**Files:**
- Rewrite: `apps/web/src/features/rubi-chat/ui/thread-list.tsx`

**New implementation:**

```typescript
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/integrations/orpc/client";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { MessageSquarePlusIcon, Trash2Icon } from "lucide-react";
import type { FC, ReactNode } from "react";

export interface ThreadListProps {
   teamId: string;
   activeThreadId: string | undefined;
   onSelect: (threadId: string) => void;
   onDelete: (threadId: string) => Promise<void>;
   onNew: () => void;
   className?: string;
   newThreadTrigger?: ReactNode;
   renderThreadTrigger?: (props: {
      threadId: string;
      title: string | undefined;
      children: ReactNode;
   }) => ReactNode;
}

export const ThreadList: FC<ThreadListProps> = ({
   teamId,
   activeThreadId,
   onSelect,
   onDelete,
   onNew,
   className,
   newThreadTrigger,
   renderThreadTrigger,
}) => {
   const { data } = useSuspenseQuery(
      orpc.chat.listThreads.queryOptions({
         input: { teamId, page: 0, perPage: 50 },
      }),
   );

   return (
      <div className={cn("flex h-full flex-col gap-1 overflow-y-auto px-2 py-2", className)}>
         {newThreadTrigger ?? (
            <Button
               className="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium"
               onClick={onNew}
               variant="outline"
            >
               Nova conversa
               <MessageSquarePlusIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </Button>
         )}
         <div className="mt-2">
            <p className="mb-1 px-2 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide">
               Conversas
            </p>
            {data.threads.map((thread) => (
               <ThreadItem
                  activeThreadId={activeThreadId}
                  key={thread.id}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  renderThreadTrigger={renderThreadTrigger}
                  thread={thread}
               />
            ))}
         </div>
      </div>
   );
};

function ThreadItem({ thread, activeThreadId, onSelect, onDelete, renderThreadTrigger }: {
   thread: { id: string; title: string; updatedAt: Date };
   activeThreadId: string | undefined;
   onSelect: (id: string) => void;
   onDelete: (id: string) => Promise<void>;
   renderThreadTrigger?: ThreadListProps["renderThreadTrigger"];
}) {
   const isActive = thread.id === activeThreadId;
   const triggerContent = (
      <span className="flex-1 truncate text-foreground/80">
         {thread.title ?? "Nova conversa"}
      </span>
   );

   return (
      <div
         className={cn(
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
            isActive && "bg-accent/80 font-medium",
         )}
      >
         {renderThreadTrigger ? (
            renderThreadTrigger({
               threadId: thread.id,
               title: thread.title,
               children: triggerContent,
            })
         ) : (
            <button
               className="flex min-w-0 flex-1 items-center gap-2 text-left"
               onClick={() => onSelect(thread.id)}
               type="button"
            >
               {triggerContent}
            </button>
         )}
         <button
            className="ml-auto shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={() => onDelete(thread.id)}
            type="button"
         >
            <Trash2Icon className="size-3.5" />
            <span className="sr-only">Excluir conversa</span>
         </button>
      </div>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/rubi-chat/ui/thread-list.tsx
git commit -m "feat(web): rewrite thread-list.tsx — remove @assistant-ui, drive with oRPC queries"
```

---

## Task 9: Rewrite rubi-chat-tab.tsx + tool components cleanup

**Files:**
- Rewrite: `apps/web/src/features/context-panel/ui/rubi-chat-tab.tsx`
- Modify: all tool components (change `ToolCallMessagePartComponent` type to `RubiToolProps`)
- Simplify: `packages/ui/src/components/assistant-ui/model-selector.tsx`
- Simplify: `packages/ui/src/components/assistant-ui/attachment.tsx`
- Simplify: `packages/ui/src/components/assistant-ui/markdown-text.tsx`
- Delete: `apps/web/src/features/rubi-chat/ui/tool-components/write-content-tool.tsx` (used `makeAssistantToolUI`)

**Step 1: Rewrite `rubi-chat-tab.tsx`** — remove `AssistantRuntimeProvider`, wire `useRubiChat` directly:

```typescript
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { useRubiChat } from "@/features/rubi-chat/hooks/use-rubi-chat";
import type { QuickSuggestion } from "@/features/rubi-chat/ui/thread";
import { formatTimeAgo, Thread } from "@/features/rubi-chat/ui/thread";
import { useActiveTeam } from "@/hooks/use-active-team";
import { orpc } from "@/integrations/orpc/client";

const QUICK_SUGGESTIONS: QuickSuggestion[] = [ /* same as before */ ];

function RecentThreadsList({ teamId }: { teamId: string }) {
   const { data } = useSuspenseQuery(
      orpc.chat.listThreads.queryOptions({ input: { teamId, page: 0, perPage: 5 } }),
   );
   return (
      <>
         {data.threads.map((t) => (
            <div className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left" key={t.id}>
               <span className="flex-1 truncate text-sm text-foreground/80">{t.title}</span>
               <span className="shrink-0 text-xs text-muted-foreground/60">{formatTimeAgo(t.updatedAt)}</span>
            </div>
         ))}
      </>
   );
}

export function RubiChatTab() {
   const { activeTeamId } = useActiveTeam();
   const chat = useRubiChat({ teamId: activeTeamId ?? "" });

   if (!activeTeamId) return null;

   return (
      <div className="h-full [&_.aui-user-message-content]:bg-background [&_.aui-user-message-content]:text-foreground">
         <Thread
            chat={chat}
            quickSuggestions={QUICK_SUGGESTIONS}
            recentThreadsSlot={
               <Suspense fallback={null}>
                  <RecentThreadsList teamId={activeTeamId} />
               </Suspense>
            }
            teamId={activeTeamId}
            welcomeIconUrl="/mascot.svg"
            welcomeSubtitle="Seu assistente financeiro e ERP com IA."
            welcomeTitle="Como posso te ajudar?"
         />
      </div>
   );
}
```

**Step 2: Update all tool components** — replace `ToolCallMessagePartComponent` import with `RubiToolProps` from `thread.tsx`:

In `agent-call-tool.tsx`, `editor-tool.tsx`, `research-tool.tsx`, `skill-tool.tsx`:

```typescript
// Before
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
const AgentCallToolImpl: ToolCallMessagePartComponent = ({ toolName, status }) => { ... }
export const AgentCallTool = memo(AgentCallToolImpl) as ToolCallMessagePartComponent;

// After
import type { RubiToolProps } from "@/features/rubi-chat/ui/thread";
const AgentCallToolImpl: FC<RubiToolProps> = ({ toolName, status }) => { ... }
export const AgentCallTool = memo(AgentCallToolImpl);
```

In `reasoning-display.tsx`:
```typescript
// Before: ReasoningMessagePartComponent, ReasoningGroupComponent
// After: FC<{ text: string }> and FC<{ children: React.ReactNode }>
```

Delete `write-content-tool.tsx` (used `makeAssistantToolUI` — now handled by `TOOL_UI_REGISTRY` in thread.tsx).

**Step 3: Simplify `packages/ui/src/components/assistant-ui/model-selector.tsx`**

Remove `useAui` import and `api.modelContext().register()` call entirely. The `ModelSelectorImpl` becomes:

```typescript
const ModelSelectorImpl = ({ value, onValueChange, defaultValue, models, triggerClassName, children, ...props }: ModelSelectorImplProps) => {
   const isControlled = value !== undefined;
   const [internal, setInternal] = useState(() => defaultValue ?? models[0]?.id ?? "");
   const resolved = isControlled ? value : internal;
   const onChange = onValueChange ?? setInternal;

   return (
      <ModelSelectorRoot models={models} onValueChange={onChange} value={resolved} {...props}>
         {children ?? (
            <>
               <ModelSelectorTrigger className={triggerClassName} />
               <ModelSelectorContent />
            </>
         )}
      </ModelSelectorRoot>
   );
};
```

**Step 4: Rewrite `packages/ui/src/components/assistant-ui/markdown-text.tsx`**

Use `react-markdown` + `remark-gfm` (already installed in packages/ui):

```typescript
"use client";
import { memo, type FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@packages/ui/lib/utils";

interface MarkdownTextProps {
   content: string;
   className?: string;
}

const MarkdownTextImpl: FC<MarkdownTextProps> = ({ content, className }) => (
   <div className={cn("aui-md prose-sm leading-relaxed", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
         {content}
      </ReactMarkdown>
   </div>
);

export const MarkdownText = memo(MarkdownTextImpl);
```

**Step 5: Simplify `packages/ui/src/components/assistant-ui/attachment.tsx`**

Drop `AttachmentPrimitive`, `ComposerPrimitive`, `MessagePrimitive`, `useAui`, `useAuiState`. Keep only `ComposerAddAttachment` and `ComposerAttachments` as simple wrappers around `react-dropzone`. For the initial migration, these can be stub components if full attachment support is out of scope:

```typescript
// Stub — re-implement with react-dropzone after core chat works
export const UserMessageAttachments: FC = () => null;
export const ComposerAttachments: FC = () => null;
export const ComposerAddAttachment: FC = () => null;
```

**Step 6: Typecheck**

```bash
bun run typecheck 2>&1 | head -40
```

Fix all errors — most will be import path changes and type mismatches from the tool component prop type.

**Step 7: Commit**

```bash
git add apps/web/src/features/context-panel/ui/rubi-chat-tab.tsx
git add apps/web/src/features/rubi-chat/ui/tool-components/
git add packages/ui/src/components/assistant-ui/
git rm apps/web/src/features/rubi-chat/ui/tool-components/write-content-tool.tsx
git commit -m "feat(web): remove @assistant-ui — rewrite rubi-chat-tab, tool components, packages/ui components"
```

---

## Task 10: Remove @assistant-ui from catalog + final cleanup

**Step 1: Grep for remaining @assistant-ui imports**

```bash
grep -r "@assistant-ui" apps/web/src packages/ui/src core/ --include="*.ts" --include="*.tsx" -l
```

Fix any remaining imports.

**Step 2: Remove `@assistant-ui/*` from `packages/ui/package.json`**

Remove `@assistant-ui/react`, `@assistant-ui/react-markdown`, `@ai-sdk/react`.

**Step 3: Remove `assistant-ui` catalog from root `package.json`** (after confirming zero usages).

**Step 4: Move `ai` package**

If `ai` is still in `catalog:mastra`, move it to `catalog:server` in root `package.json`. Remove `catalog:mastra`.

**Step 5: Install + build**

```bash
bun install
bun run build
```

**Step 6: Commit**

```bash
git add package.json packages/ui/package.json
git commit -m "chore: remove @assistant-ui/* catalog, clean up legacy deps"
```

---

## Task 11: End-to-end verification

**Step 1: Start dev**

```bash
bun dev
```

**Step 2: Smoke test**

1. Open Rubi chat panel
2. Send a message → text streams in progressively
3. Check a tool call renders (if agent tools exist) 
4. Reload → thread list shows the conversation, messages reload
5. Click a previous thread → messages load
6. Delete a thread → removed from list
7. "Nova conversa" → fresh empty thread

**Step 3: Run all tests**

```bash
bun run test
```

**Step 4: Full typecheck**

```bash
bun run typecheck
```

**Step 5: Check bundle — no @assistant-ui in output**

```bash
grep -r "@assistant-ui" node_modules/.modules.yaml 2>/dev/null | head -5
# Should be empty after bun install with updated deps
```

---

## Notes & Gotchas

- **TanStack AI `chat()` messages type** — the `messages` from `useChat` are `UIMessage[]`. Pass them directly to `chat()` on the server; TanStack AI's adapter handles conversion internally.
- **`setMessages` API** — verify the exact method name on `useChat`'s return for loading thread history. It may be `reset()`, `setMessages()`, or an `initialMessages` option. Check `@tanstack/ai-react` types.
- **`fetchServerSentEvents` body** — the `body` option is merged into the POST JSON alongside `messages`. Confirmed by the connection adapter docs.
- **Tool call `argsText`** — TanStack AI tool parts have both `args` (parsed object) and `argsText` (raw string). The tool components use `argsText`, so this should work without changes.
- **`ReasoningDisplay` / `ReasoningGroupDisplay`** — TanStack AI emits thinking as `{ type: 'thinking', content }` parts. There's no "reasoning group" concept. Drop `ReasoningGroupDisplay`, render `ReasoningDisplay` directly for `type === 'thinking'` parts.
- **Scroll to bottom** — `useEffect(() => { scrollRef.current?.scrollIntoView() }, [messages])`.
- **Old `mastra.*` tables** — untouched in the DB. Future cleanup migration can drop them.
- **`@openrouter/ai-sdk-provider`** in `apps/web/package.json` — this is the Vercel AI SDK OpenRouter provider, not TanStack AI's. Remove it in Task 10 cleanup if no longer used elsewhere.
