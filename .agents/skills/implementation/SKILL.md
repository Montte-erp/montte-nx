---
name: implementation
description: Guia de implementacao do Montte para backend, frontend, CRUD, erros, jobs, workflows, testes e validacao. Use ao criar, migrar, refatorar, revisar ou testar codigo em apps, modules, core, packages ou tooling.
---

# Implementation

Use esta skill antes de implementar mudancas no Montte. Ela roteia para referencias menores; nao carregue todas por padrao.

## Roteamento

Leia so as referencias envolvidas na tarefa:

- CRUD frontend, live queries, mutations, schemas, DataTable, forms, importacao, bulk actions, optimistic UI: `references/tanstack-db.md`.
- Domain errors, recoverable failures, provider calls, jobs, workflows, serialization: `references/better-result.md`.
- oRPC router, input/output contracts, ownership, typed errors, transport: `references/orpc.md`.
- Durable workflows, replay, DBOS transactions/steps, self-rescheduling: `references/dbos.md`.
- Operational background jobs, debounce, singleton, retry, DLQ: `references/pg-boss.md`.
- AI agents, TanStack AI runtime, chat lifecycle, AG-UI/OpenUI, tools, AI telemetry: `references/tanstack-ai.md`.
- Triagem de bugs da plataforma para GitHub Issues via GitHub Actions: `references/issue-triage-agent.md`.

Carregue tambem as skills de dominio quando a tarefa bater:

- New Payments/Vault/domain errors: `better-result`.
- Legacy oRPC handlers/errors ainda usando `neverthrow`: `neverthrow`.
- Schema/queries: `postgres-drizzle`.
- Search/BM25: `paradedb-skill`.
- Redis: `redis-best-practices`.
- Client data: `tanstack-query`.
- Forms: `tanstack-form`.
- Tables: `tanstack-table` e `tanstack-virtual` para listas longas.
- Routes: `tanstack-router`.
- Stores: `tanstack-store` e `tanstack-db`.
- SSR/server functions: `tanstack-start` e `tanstack-devtools`.
- AI agents: `tanstack-ai`.
- Durable workflows: `dbos-typescript`.
- Auth: `better-auth-best-practices` e sub-skills de email/2FA/orgs/scaffolding quando aplicavel.
- shadcn primitives: `shadcn`.
- UI/UX review: `ui-ux-expert`.
- A11y: `wcag-audit-patterns`.
- Nx scaffolding: `nx-generate`.
- Nx task runs: `nx-run-tasks`.
- New package or `TS2307` for `@core/*`, `@packages/*`, `@montte/*`: `link-workspace-packages`.
- New Nx plugin: `nx-plugins`.
- Importing repos into Nx: `nx-import`.

Se uma tarefa cruza dominios, leia so as referencias envolvidas. Exemplo: criar procedure + job async = `orpc.md`, `pg-boss.md`, `better-result.md`.

## Regras sempre ativas

- Mensagens visiveis ao usuario em pt-BR.
- Sem `as` em TypeScript editado.
- Sem `try/catch` em codigo de app/module/core, exceto tests/scripts.
- Datas com `dayjs`; `new Date()` so em excecoes existentes como Drizzle `$onUpdate` e fixtures de teste.
- Sem barrel novo.
- Sem repository layer novo.
- Frontend importa tipos de oRPC por `Inputs` e `Outputs` de `@/integrations/orpc/client`.
- Tabelas, filtros, sort, paginacao, tabs e selected ids persistem estado na URL.
- Forms usam TanStack Form; forms em sheet usam `useSheet`.
- Validar com comandos focados antes de fechar.

## Workflow

1. Leia o codigo atual antes de editar.
2. Escolha as referencias desta skill que se aplicam.
3. Mantenha o diff no menor escopo que resolve o pedido.
4. Use patterns ja existentes no modulo antes de criar abstracao.
5. Rode format/typecheck/test focado e `git diff --check`.

## Monorepo e dependencias

```text
core/         # ai, authentication, database, dbos, environment, files, logging,
              # notifications, orpc, posthog, redis, sse, utils
modules/      # account, agents, billing, classification, finance, insights
              # domain modules: router, services, workflows quando aplicavel
apps/         # web (TanStack Start + oRPC), worker (DBOS), landing (Astro)
packages/     # ui (shadcn primitives + Montte components)
tooling/      # boundary, css (Tailwind), oxc, typescript
```

`apps/landing` e a landing publica em Astro. Ela importa `@tooling/css/globals.css`, pode server-renderizar componentes shadcn de `@packages/ui`, usa `public/favicon.svg`, e roda na porta `3001` em desenvolvimento.

Catalogs no `package.json` raiz: `analytics-client`, `assistant-ui`, `astro`, `auth`, `database`, `development`, `dnd`, `environment`, `files`, `fot`, `logging`, `mastra`, `notifications`, `orpc`, `payments`, `react`, `search-providers`, `server`, `tanstack`, `tanstack-ai`, `telemetry`, `testing`, `ui`, `validation`, `vite`, `workers`. Internal: `"@core/database": "workspace:*"`.

Ao adicionar dependencia: declare no `package.json` consumidor com o catalog correto, rode `bun nx sync`, e inclua as referencias TypeScript geradas. Referencias faltando fazem `bun run typecheck` falhar antes dos testes.

## API - oRPC, nao tRPC

Routers vivem em `modules/<module>/src/router/<name>.ts` e sao agregados em `apps/web/src/integrations/orpc/router/index.ts`. Apenas `notifications.ts` ainda vive no agregador.

Contexto: `{ db, posthog?, organizationId, userId, session, auth, headers, request, workflowClient }`.

Regras:

- Falhas esperadas de dominio/router usam `better-result` com `TaggedError` local ao owner carregando erro de catalogo evlog com `status`.
- Handlers podem lancar esses tagged errors diretamente; o middleware global oRPC mapeia para os construtores tipados de `.errors(...)`.
- `@core/orpc` configura `Registry.throwableError = Error`; nunca lance literals, strings cruas ou objetos planos.
- Nao use `WebAppError`, `AppError`, `ORPCError` direto, `Error` cru, strings, wrapper factories, fake type guards ou `instanceof` para erros de dominio.
- Mensagens sempre em pt-BR porque aparecem diretamente em toasts.
- Routers consultam `context.db` diretamente.
- Workflows usam `<module>DataSource.runTransaction`.
- Toda escrita fica dentro de `db.transaction(async (tx) => ...)`. Leituras simples sao excecao.
- Checagens de regra de negocio (`conflict`, `notFound`) ficam fora da transacao.
- `returning()` vazio deve virar retorno/throw do tagged catalog error local fora da transacao.
- Ownership via middleware: busque entidade, cheque `teamId`, passe via `next({ context: { entity } })`. Handler nao reconsulta.
- Bulk ops usam procedure dedicada + `Promise.allSettled` no servidor. Nunca faca loop de `mutateAsync` no client.

Pattern canonico:

```typescript
const itemByIdProcedure = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .use(async ({ context, input, next }) => {
      const result = await Result.gen(async function* () {
         const item = yield* Result.await(
            Result.tryPromise({
               try: () =>
                  context.db.query.items.findFirst({
                     where: (f, { eq }) => eq(f.id, input.id),
                  }),
               catch: () =>
                  new ItemRouterError({
                     error: itemRouterErrors.PERMISSION_CHECK_FAILED(),
                     message: "Falha ao verificar permissao.",
                  }),
            }),
         );

         if (!item || item.teamId !== context.teamId) {
            yield* new ItemRouterError({
               error: itemRouterErrors.NOT_FOUND(),
               message: "Item nao encontrado.",
            });
         }

         return Result.ok(item);
      });
      if (Result.isError(result)) throw result.error;
      return next({ context: { item: result.value } });
   });
```

Routers agregados: `account`, `agentSettings`, `analytics`, `apiKeys`, `bankAccounts`, `benefits`, `categories`, `categoriesBulk`, `cnpj`, `contactSettings`, `contacts`, `coupons`, `creditCards`, `customerPortal`, `dashboards`, `financialSettings`, `insights`, `meters`, `notifications`, `onboarding`, `organization`, `prices`, `agent`, `services`, `session`, `subscriptionItems`, `subscriptions`, `tags`, `team`, `threads`, `transactions`, `usage`.

## Client - oRPC + TanStack Query

- `useSuspenseQuery` por padrao. Envolva todo uso em `<QueryBoundary fallback={<Skel/>} errorTitle="...">`.
- Nunca use `ErrorBoundary + Suspense` cru.
- Queries condicionais: `useQuery + skipToken`, ou renderize child em `<Suspense>{cond && <Child id/>}</Suspense>` para `useSuspenseQuery`.
- Nunca use `useQuery + enabled`.
- Duas ou mais queries independentes no mesmo componente usam `useSuspenseQueries`.
- Use `select` agressivamente para derivar shape; nao armazene estado derivado.
- `input` fica dentro de `queryOptions()`.
- Callbacks ficam dentro de `mutationOptions()`.
- Sempre use `orpc.proc.queryKey()` / `mutationKey()`, nunca arrays manuais.
- `MutationCache` global invalida todas as queries depois de cada mutation. Opt-out com `meta: { skipGlobalInvalidation: true }`.
- Filtros, sort, paginacao, tabs e selected ids ficam em URL search params via `validateSearch` + `navigate({ search: prev => ..., replace: true })`.
- SSE usa `useQuery + experimental_liveOptions`. Nunca `consumeEventIterator + useEffect`.
- Tipos: `import type { Inputs, Outputs } from "@/integrations/orpc/client"`.
- Frontend nunca importa `@core/*`, exceto helpers puros de `@core/utils/*`.
- Slugs: use `useDashboardSlugs`, `useOrgSlug`, `useTeamSlug`, `useActiveOrganization`, `useActiveTeam`. Nunca `useParams` cru.
- Chamadas diretas `orpc.*` so dentro de route loaders para prefetch. Componentes usam `useMutation`/`useSuspenseQuery`.

## Forms - TanStack Form

- Schema em escopo de modulo, nunca dentro do componente.
- `isInvalid = isTouched && errors.length > 0`.
- Remova `isTouched` de campos ligados a erro de servidor, porque conflita com `onSubmitAsync`.
- Sempre defina `id`, `name`, `aria-invalid`; use `htmlFor` em `<FieldLabel>`.
- Use `children={(field) => ...}` como prop explicita.
- `onSubmitAsync` so quando conflito de servidor mapeia para campo visivel.
- CRUD generico usa `onSubmit` + `toast.error` ou `fromPromise`.
- Erro de campo de servidor retorna `{ fields: { fieldName: "..." } }`.
- Sem paragrafo de erro no footer.
- `form.Subscribe` selectors devem ser especificos; nunca `state => state`.
- Multi-step forms usam React context local via factory function e tipo com `ReturnType<typeof createMyForm>`.
- Nav guard: `useBlocker({ withResolver: true, disabled: isCreate })`.

## Routes - TanStack Start

Obrigatorio em toda rota:

- `head()` com titulo `"Page - Montte"` em pt-BR.
- `pendingMs: 300` + `pendingComponent` quando loader faz prefetch.
- `errorComponent` quando loader usa `ensureQueryData` bloqueante.
- Campos de `validateSearch` usam `.catch()`, nunca `.optional()`.
- `loaderDeps` sempre que o loader le search params.

```typescript
export const Route = createFileRoute("/feature")({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
      page: z.number().int().min(1).catch(1).default(1),
      pageSize: z.number().int().catch(20).default(20),
   }),
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, deps }) =>
      context.queryClient.prefetchQuery(
         orpc.feature.getAll.queryOptions({ input: deps }),
      ),
   pendingMs: 300,
   pendingComponent: FeatureSkeleton,
   head: () => ({ meta: [{ title: "Feature - Montte" }] }),
   component: FeaturePage,
});
```

Ordem critica de plugins Vite: `tanstackStart({ router: { autoCodeSplitting: true } })` -> `nitro({ preset: "bun" })` -> `viteReact()`.

`apps/web/src/router.tsx` define `defaultPendingMs: 0` e `defaultPendingMinMs: 0` para trocar navegacoes imediatamente. A animacao de auth fica em `apps/web/src/routes/auth/-auth/route-transition.tsx`: `motion.div` com animacao somente de entrada, sem `AnimatePresence`/`exit`. Regressao coberta por `apps/web-e2e/tests/auth-route-transition.spec.ts`.

`createServerFn` so para operacoes HTTP-puras que precisam de `process.env` ou request context. Nao substitui oRPC.

Nunca use `VITE_*` ou `import.meta.env` para public env vars. Leia `process.env` em server fn e passe via loader. Tema: cookie `theme` lido no root loader e aplicado como `<html className>`, sem `dangerouslySetInnerHTML`. Devtools sempre dentro de `<ClientOnly>` + `import.meta.env.DEV`.

## Database - Drizzle + ParadeDB

Schemas em `core/database/src/schemas/`. Sempre use namespace, nunca `pgTable(...)` cru:

- `financeSchema`: transactions, transaction-items, bank-accounts, credit-cards, credit-card-statements, credit-card-statement-totals, categories.
- `crmSchema`: contacts, contact-settings, contact-subscriptions, services, service-prices, service-benefits, benefits, benefit-grants, meters, subscription-items, coupons, coupon-redemptions, resources, tags.
- `platformSchema`: dashboards, insights, agent-settings, invoices, usage-events.
- `settingsSchema`: financial config.
- `agentsSchema`: threads.
- `authSchema`: Better Auth managed (`user`, `session`, `account`, `organization`, `team`, `member`, `invitation`, `twoFactor`, `apikey`) e read-only. Extenda via `additionalFields` na config de auth.

Imagem local de DB e `paradedb/paradedb`; nao troque.

## Auth - Better Auth

Config: `core/authentication/src/server.ts`. Plugins: Magic Link, Email OTP, 2FA, Organization, API Key.

- Auth schema e read-only; extenda via `additionalFields`.
- Queries usam oRPC (`orpc.organization.*`).
- Mutations usam `authClient` direto, nunca `useMutation`.
- `member.id` nao e `user.id`: `member.id` para APIs Better Auth, `member.userId` para DB.
- Loading state usa `useTransition`, nao `useState<boolean>`.

## Worker, DBOS e pg-boss

DBOS roda em `apps/worker`, nunca no processo web. Web enfileira via `context.workflowClient` (`DBOSClient`, PostgreSQL-backed). Cada workflow file declara sua propria `WorkflowQueue`; DBOS processa automaticamente.

Use DBOS para workflows duraveis/criticos: billing, ledger, entitlement, invoice period closing, state machines multi-step, self-rescheduling deterministico, DBOS transactions/steps, e casos onde replay/observabilidade de workflow de negocio fazem parte da corretude.

Use pg-boss para jobs operacionais simples: one-shot background work, retries, DLQ, singleton/debounce, enfileiramento a partir de Drizzle transaction, e side effects nao criticos que podem ser retentados ou inspecionados manualmente.

Regras pg-boss:

- Consumers rodam apenas em `apps/worker`.
- Web pode enfileirar pelo `pgBoss` promise no contexto oRPC e helpers do pacote, mas nao roda workers/consumers.
- Logs por `@core/logging` (`evlog`) com campos estruturados.
- Nao use `DBOS.logger` em pg-boss jobs.
- Use recursos nativos da plataforma: `retryLimit`, `retryDelay`, `retryBackoff`, `expireInSeconds`, `retentionSeconds`, `deadLetter`, `singletonKey`, `singletonSeconds`, `singletonNextSlot`, `sendDebounced`, `sendThrottled`, `group`.
- Para `key_strict_fifo`, sempre forneca `singletonKey` estavel.
- Queue names so podem ter alfanumericos, underscores, hifens, pontos ou barras. Nao use colon (`classification:derive-keywords`); use slash (`classification/derive-keywords`).
- Todo job precisa de Zod input schema, retorno `Result` tipado, union de `TaggedError` com catalogo evlog, helpers de registro de fila, e handler que valida `job.data`.
- Job id vazio/ausente e erro, nao no-op.
- Se o job precisa de DBOS steps, workflow replay, scheduling deterministico ou e financeiro/security critical, mantenha em DBOS.

Regras DBOS:

- Use `<module>DataSource = new DrizzleDataSource<DatabaseInstance>(...)` por modulo.
- Dentro de steps: `dataSource.runTransaction(async () => { const tx = <module>DataSource.client; ... }, { name })`.
- O generic da um `client` tipado; nunca faca cast.
- Nunca use `db` plano ou repositories em workflows.
- Startup do worker: `initOtel()` primeiro, depois `await setup<Module>Workflows(deps)` para cada modulo, depois `DBOS.launch()`.
- Cada `setup<Module>Workflows` inicializa schema DBOS, context store, filas, e importa workflow files por side effect.
- Sem `initializeDBOSSchema`, a tabela `transaction_completion` falta e `runTransaction` quebra.
- Logging de workflows: `DBOS.logger` somente, com interpolacao de string.
- Nao substitua por `getWorkerLogger` dentro de workflows, porque perde contexto.
- Esperas por instancia: `enqueueOptions.delaySeconds` no enqueue/self-reschedule. `DBOS.sleepms` pode segurar slot; evite para esperas longas.
- `@DBOS.scheduled` fica reservado para cron fixo.
- Self-rescheduling: re-check status em tx, faz trabalho, computa proximo wake dentro de `DBOS.runStep`, e chama `DBOS.startWorkflow(self, { workflowID: "<deterministic-per-period>", queueName, enqueueOptions: { delaySeconds } })`.
- Inputs de workflow sempre carregam `teamId` e `organizationId`; nao busque dentro dos steps.

Queues existentes de workflows em `classification`: `workflow:classify`, `workflow:derive-keywords`. Title/suggestions de agent sao pg-boss, nao DBOS.

Startup atual do worker (`apps/worker/src/index.ts`): `initOtel` -> `setupClassificationWorkflows(deps)` -> `setup<Module>Workflows(deps)` para modulos que realmente possuem DBOS workflows -> `DBOS.setConfig` -> `DBOS.launch()`; depois inicia pg-boss e registra consumers como `agent-title` / `agent-suggestions`.

Testes de DBOS: mock `@dbos-inc/dbos-sdk` com `vi.hoisted` + `dbosSdkMockFactory` / `drizzleDataSourceMockFactory` de `@core/dbos/testing/mock-dbos`; `registerWorkflow` deve retornar a funcao diretamente. Use `setupTestDb()` com pglite para assertions. Para tempo: `vi.useFakeTimers()` + `vi.setSystemTime(T0)`. Smoke real-runtime: `__tests__/integration/dbos-smoke.test.ts`.

## Logging e erros

`@core/logging` usa `evlog`. O drain oficial de wide events e PostHog Logs via `createPostHogDrain({ mode: "logs" })`. Nao adicione drain OTLP paralelo para evlog. OTLP permanece reservado para DBOS/TanStack AI observability.

Web usa o modulo Nitro v3 de evlog em `apps/web/nitro.config.ts` com `experimental.asyncContext`. Request context fica em `useRequest().context.log`; passe esse logger para oRPC/server handlers em vez de Pino plugins ou standalone request loggers. Better Auth identity e anexada no hook de request com emails mascarados.

Request telemetry pertence ao wide event evlog e sai pelo PostHog Logs drain. Nao duplique telemetria normal de oRPC com `captureServerEvent`; reserve PostHog capture direto para product analytics e identity/group calls.

Sem health heartbeat/logger standalone em `@core/logging`: Railway health fica em `/api/ping`, e service/request telemetry pertence a evlog ou OTEL/TanStack AI. API key auth deve viver no middleware oRPC ativo quando necessario.

Erros de dominio pertencem ao modulo dono, nao a `@core/logging` nem a transport helpers:

- Defina `defineErrorCatalog("<bounded-context>", ...)` local ao arquivo/bounded context dono da falha.
- Registre via `declare module "evlog"`.
- Falhas recuperaveis com `Result` usam um `TaggedError("<Context>Error")<{ error: ReturnType<typeof catalog.SOME_ERROR>; ...payload }>` por bounded context.
- Nao crie wrappers/factories de `TaggedError`: sem `makeXError`, `xInternal`, `xNotFound`, `dbError` ou atalhos parecidos.
- Instancie `new TaggedErrorClass({ error: catalog.CODE(), message, ...typedPayload })` diretamente no owner.
- Nao crie `errors.ts` module-wide so para centralizar erros.
- oRPC transport mapping e global em `@core/orpc` por `.errors(...)` tipado; modulos nao devem traduzir falhas esperadas para transport errors.

Audit logs nao fazem parte da migracao atual. Nao conecte `auditEnricher`, `auditOnly`, journals assinados em filesystem, MinIO journals ou `log.audit()` ate a fase de audit ser reaberta explicitamente.

## Billing - HyprPay

100% usage-based. Customer = Better Auth organization. Subscriptions suportam seats por `item.quantity`.

Cobrar apenas o que custa para operar: AI calls, email, storage, webhook egress. UI/CRUD/listings sao gratis.

Workflows escrevem usage rows diretamente no schema `usage-events`; `period-end-invoice` agrega via `summarizeUsageByMeter`. HyprPay ingestion middleware esta planejado mas nao esta wired; nao referencie helpers inexistentes.

## Code style

- TypeScript: nunca `as`, inclusive `[] as string[]`; corrija o tipo de origem.
- Sem return types redundantes que o TS infere.
- Sem parametros nao usados; delete, nao use `_foo`.
- Sem JSDoc, section comments ou inline rationale.
- Sem barrel files.
- Sem imports relativos em `core/`; use `@core/<pkg>/*`.
- Sem dynamic imports.
- `core/utils` e subpath-only e pequeno: `@core/utils/dates`, `@core/utils/hash`, `@core/utils/text`.
- `core/utils` nao tem root barrel, helpers de dominio/UI, redaction/logging helpers, nem depende de logger, db, redis, PostHog, auth ou infra.
- Erros: sem `try/catch` em app/module/core. Use `better-result` para codigo novo Payments/Vault/domain; legacy em `neverthrow` pode manter `fromPromise`, `fromThrowable`, `ok`, `err`, `Result`, `ResultAsync`, `safeTry`.
- Nao misture `better-result` e `neverthrow` no mesmo modulo.
- Excecao para `try/catch`: tests e scripts.
- Controle de fluxo: early returns, nunca `else` depois de `return`.
- Minimize `useEffect`; derive state ou use event handlers. `useEffect` so para sync externo.
- Use `useCallback`, nunca `useStableHandler`.
- Datas sempre com `dayjs`.
- Para Drizzle: `.toDate()`.
- Para ISO: `.toISOString()`.
- Para date strings: `.format("YYYY-MM-DD")`.
- Arquivos em kebab-case.
- Componentes PascalCase `[Feature][Action][Type]`.
- Hooks `use[Feature][Action]`.
- Tailwind: sem margin utilities (`m-`, `mt-`, `mx-`, `space-x-*`, `space-y-*`); use `gap-*`.
- Somente `gap-2` ou `gap-4`.
- Spacing/sizing so sufixos `2` e `4` (`p-*`, `px-*`, `size-*`).
- oxlint suppress: `// oxlint-ignore <rule>`.
- Array index keys: `` `step-${index + 1}` ``.
- Tags sempre se chamam "Centro de Custo".

## UI conventions

- Forms em modals/sheets/drawers sempre usam `useSheet`.
- Outros modal flows usam `useCredenza`.
- Confirmacao destrutiva usa `useAlertDialog`.
- Nunca importe Dialog/Drawer/AlertDialog/Credenza primitives diretamente.
- Empty states usam `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent` de `@packages/ui/components/empty`.
- DataTable de `@packages/ui/components/data-table` nunca fica embrulhada em `Card`.
- Props obrigatorias de DataTable: `getRowId`, `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange`.
- Column defs devem ser memoizadas.
- `manualSorting`/`manualFiltering` ja sao wired internamente.
- Por uso de DataTable: estado em modulo com `createLocalStorageState<DataTableStoredState | null>("montte:datatable:<feature>", null)` + `validateSearch` com arrays `sorting` e `columnFilters`.
- `ColumnMeta`: `label`, `filterVariant` (`"text" | "select" | "range" | "date"`), `align`, `exportable`.
- View toggle usa `useViewSwitch("feature:view", VIEWS)`.
- Nunca use `renderMobileCard`.
- Animacoes Tailwind-first.
- Framer Motion so para enter/exit dependente de estado, `layoutId`, gestures.
- Framer Motion apenas em client components e envolvendo shadcn primitives em `motion.div`; nao modifique primitives.
- Anime apenas `transform` e `opacity`.
- Componentes de uma unica rota ficam em `-[name]/` ao lado da rota. Imports relativos sao permitidos ali.
- Componentes compartilhados ficam em `features/[name]/`, flat, sem `hooks/`, `ui/`, `utils/`.

## Singletons

```typescript
import { auth } from "@core/authentication/server";
import { db } from "@core/database/client";
import { env } from "@core/environment/server";
import { minioClient } from "@core/files/client";
import { notificationsClient } from "@core/notifications/client";
import { posthog } from "@core/posthog/server";
import { redis } from "@core/redis/connection";
```

## State, storage e pacing

- Stores: `@tanstack/store` + `@tanstack/react-store` somente.
- Nunca Zustand/Jotai/React-context para shared mutable state.
- Use `createStore()`, nao `new Store()`, exceto stores por instancia dentro de `useState`.
- Selectors de objeto sempre passam `shallow`.
- Derived state: `createAtom`.
- Async: `createAsyncAtom`.
- Persisted: `createPersistedStore` de `@/lib/store`.
- Cross-store: `createStoreEffect`.
- Multi-store updates: `batch()`.
- Nunca armazene `ReactNode`; use render functions.
- SSR safety: `createClientOnlyFn` / `createIsomorphicFn`, nunca `typeof window` guards.
- localStorage keys sempre prefixadas com `montte:`.
- Hooks SSR-safe por subpaths `foxact`, nunca `@uidotdev/usehooks`.
- Comuns: `foxact/use-local-storage`, `foxact/create-local-storage-state`, `foxact/use-session-storage`, `foxact/use-media-query`, `foxact/invariant`, `foxact/merge-refs`, `foxact/use-isomorphic-layout-effect`.
- Debounce/throttle/rate-limit: `@tanstack/react-pacer`.
- Nunca `foxact/use-debounced-value`.
- Async/`mutateAsync`: sempre `useAsyncDebouncedCallback`.
- Options object: `{ wait: 350 }`.

## F-O-T libraries

- `@f-o-t/money`: todo dinheiro. Normalize com `toMajorUnitsString(of(decimal, "BRL"))`; exiba com `format(of("1500.00", "BRL"), "pt-BR")`.
- `@f-o-t/csv`: parse/geracao CSV. UI usa `useCsvFile`, nunca `FileReader.readAsText`.
- `@f-o-t/ofx`: OFX. Use `readAsArrayBuffer` + `parseBufferOrThrow(new Uint8Array(buffer))`, nunca `readAsText`.
- `@f-o-t/condition-evaluator`: rule eval. `weight` vive em `ConditionGroup`, nao `Condition`.
- XLSX na UI: `useXlsxFile` de `@/hooks/use-xlsx-file`.

## Inputs - Maskito

Use `@maskito/core` + `@maskito/react` para inputs estruturados.

- Use `onInput`, nao `onChange`.
- Use `defaultValue`, nao `value`.
- `MaskitoOptions` em escopo de modulo.
- Mascaras dinamicas como CPF/CNPJ via `useMemo`.
- Remova mascara antes da API com `value.replace(/\D/g, "")`.
- Currency usa `MoneyInput` de `@packages/ui/components/money-input`.

Masks:

- Telefone: `["(", /\d/, /\d/, ")", " ", /\d/, /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/, /\d/, /\d/]`
- CPF: `[/\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "-", /\d/, /\d/]`
- CNPJ: `[/\d/, /\d/, ".", /\d/, /\d/, /\d/, ".", /\d/, /\d/, /\d/, "/", /\d/, /\d/, /\d/, /\d/, "-", /\d/, /\d/]`
- Agencia: `mask: /^\d{0,4}(-\d{0,1})?$/`
- Conta: `mask: /^\d{0,12}(-\d{0,1})?$/`

## PostHog

Config toda em `@core/posthog/config`; nunca duplique em `apps/web`.

```typescript
import { FEATURE_FLAG_KEYS, POSTHOG_SURVEYS } from "@core/posthog/config";
```

- Importe `usePostHog` de `posthog-js/react` diretamente; nao reexporte.
- `posthog.identify` + `posthog.group` somente no loader de `_dashboard.tsx`.
- `opt_in_site_apps: true` para `renderSurvey()`.
- Early-access stages vem de `getEarlyAccessFeatures()`, nunca hardcoded.
- Surveys: `bugReport`, `featureRequest`, `featureFeedback`, `feedbackContatos`, `feedbackGestaoServicos`, `feedbackAnalisesAvancadas`, `feedbackDados`.
- Flags: `contatos`, `gestao-de-servicos`, `analises-avancadas`, `dados`.

## Environment

Use `SCREAMING_SNAKE_CASE` e validacao Zod em `core/environment/src/server.ts`. `.env*` vive em `apps/web/`. Public vars so por server fn -> loader data; nunca `VITE_*` / `import.meta.env`.

## Onboarding

- Org: `organization.onboardingCompleted`.
- Project: `team.onboardingCompleted`, `team.onboardingProducts`, `team.onboardingTasks`.
- Procedures: `apps/web/src/integrations/orpc/router/onboarding.ts`.
- Step `features` e multi-select estilo PostHog.
- Duas opcoes mapeiam 1:1 para `OnboardingProduct`: `finance` (Financas), `contacts` (Negocios).
- URL search param: `features` array.
- Empty selection e valida e vira `onboardingProducts: []`.
- Nao adicione opcao "pick myself"; array vazio cobre isso.
- Brand gender: Montte e masculino. Sempre "no Montte", "do Montte", "o Montte"; nunca "na Montte".
- E2E: `apps/web-e2e/tests/onboarding.spec.ts` + `multi-org-onboarding.spec.ts`.
- Helpers: `features/auth.ts` (`completeOnboarding`, `createAdditionalOrganization`, `pickFeature`).

## Testing

```bash
bun run test
npx vitest run <file>
```

Testes vivem em `core/*` e `packages/*` para logica nao trivial: Zod transforms, date/math, analytics, credits, repository queries.

Nao adicione unit/integration tests em `apps/*`; nunca teste routers/components/hooks/singletons/file existence.

Testes que exercem AI behavior devem usar `@copilotkit/aimock`/`LLMock` fixtures contra o caminho real de TanStack AI. Nao mocke action functions locais so para pular model calls; mocke apenas queue/workflow boundaries quando o AI behavior nao e o alvo.

E2E vive em `apps/web-e2e/tests/` com Playwright. Auth fixture em `fixtures.ts` injeta `storageState`. Para paginas que exigem sessao anonima (`/auth/*`), use `import { test } from "@playwright/test"` + `test.use({ storageState: { cookies: [], origins: [] } })`.

E2E guidelines:

- Teste fluxos reais de usuario, nao detalhes de implementacao.
- Prefira role/name locators e `data-testid` estavel para chrome inevitavel.
- Nunca dependa de classes geradas ou icon class names.
- Nao use `test.skip` para esconder falha.
- Se um fluxo ficou stale, atualize para o comportamento atual e comente so quando o motivo nao for obvio.
- Limpe recursos Playwright isolados em `finally`, fechando browser/context com null checks ou optional chaining.
- Mantenha determinismo; evite dados de API externa em assertions.
- Asserte outcomes duraveis: `page.waitForURL`, estado persistido via `helpers/db`, feedback visivel.
- Preserve redirects em sign-in/sign-up/magic-link/email flows.
- Em tabelas/listas, filtre pelo registro criado antes de afirmar rows.
- E2E reliability vem antes de velocidade: rode web-e2e serialmente quando compartilham sessao/DB global.

## Nx

- Sempre rode via `nx`/`bun nx run|run-many|affected`, nao pelo tool interno.
- Docs de plugin em `node_modules/@nx/<plugin>/PLUGIN.md` quando existir.
- Use Nx MCP tools quando disponiveis.
- Nunca adivinhe flags; cheque `nx_docs` ou `--help`.

## Referencias TanStack locais

No fluxo de implementacao, use primeiro as referencias do Montte. TanStack Intent e fonte complementar para manutencao destas referencias, nao roteamento padrao de tarefa.

- CRUD frontend, TanStack DB, collections, live queries, mutations otimistas, preload e SSR: `references/tanstack-db.md`.
- AI agents, TanStack AI runtime, chat lifecycle, tools, structured outputs, AG-UI/OpenUI e AI telemetry: `references/tanstack-ai.md`.
- Rotas, loaders, search params, SSR, server functions e devtools seguem as secoes locais desta skill: `Client - oRPC + TanStack Query`, `Routes - TanStack Start`, `State, storage e pacing` e `Environment`.
- Se a referencia local estiver incompleta, use TanStack Intent apenas como pesquisa para atualizar a reference local antes de aplicar a regra no codigo.

## Validacao base

Use validacao focada no escopo da mudanca:

```bash
bunx oxfmt --write <arquivos>
bun --filter web typecheck
bun --filter <module> typecheck
bun nx run <target>
git diff --check
```
