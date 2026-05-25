# Code Context

## Files Retrieved
1. `README.md` (lines 1-80) - product thesis and current app/worker surfaces.
2. `PRODUCT.md` (lines 1-64) - product purpose, AI-in-flow principle, Autumn + Rillet framing.
3. `apps/web/src/integrations/orpc/router/index.ts` (lines 1-67) - current typed capability surface exposed to web and AI tools.
4. `apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-nav-items.ts` (lines 36-138) - current product domains/route groups.
5. `apps/web/src/routes/api/chat.ts` (lines 1-33) - current AG-UI/TanStack AI HTTP entrypoint.
6. `apps/web/src/routes/_authenticated/$slug/$teamSlug/-montte-ai/chat-runtime.tsx` (lines 60-140, 244-372) - assistant-ui/AG-UI runtime, thread adapter, scope → `skillHint` injection.
7. `modules/agents/src/agent.ts` (lines 1-207) - TanStack AI runtime, PostHog Prompts, skill prompt loading, read tools, OTEL.
8. `modules/agents/src/router/chat.ts` (lines 233-238, 383-387, 595-648, 788-1009, 1034-1175 via grep) - thread/chat procedures, page context, stream creation, middleware hooks.
9. `modules/agents/src/skills.ts` (lines 1-27) - current skill catalog; only `financeiro` exists.
10. `modules/agents/src/tools/registry.ts` (lines 1-65) - AI read tools wrap oRPC routers for finance/classification/cards/reports.
11. `modules/agents/src/runtime/middleware/create-agent-runtime-middlewares.ts` (grep lines 77-133, 213-359) - post-run pg-boss enqueue seams for title/suggestions.
12. `core/database/src/schemas/schemas.ts` (lines 1-9) and `core/database/src/schema.ts` (lines 1-17) - active DB schemas exported today.
13. `core/database/src/schemas/transactions.ts` (lines 66-246) - finance transaction system of record and relationship linkage.
14. `core/database/src/schemas/relationships.ts` (lines 13-58) - current customers/suppliers primitive.
15. `core/database/src/schemas/workflows.ts` (lines 16-190) - current automation graph and run schema.
16. `core/database/src/schemas/agents.ts` (lines 1-34), `threads.ts` (lines 1-39), `messages.ts` (lines 1-60) - agent settings, persisted threads/messages/page context.
17. `core/orpc/src/context.ts` (grep lines 10-38) and `core/orpc/src/server.ts` (grep lines 34-52, 210-245, 455-464) - shared runtime context includes DB, PostHog, Prompts, Redis, pg-boss, DBOS workflow client.
18. `core/dbos/src/client.ts` (lines 1-150), `core/dbos/src/factory.ts` (lines 1-49), `core/dbos/src/worker.ts` (grep lines 20-70) - DBOS client/enqueue/worker primitives.
19. `core/pg-boss/src/client.ts` (lines 1-46), `core/pg-boss/src/worker.ts` (grep lines 10-39) - pg-boss Postgres queue primitives.
20. `core/posthog/src/server.ts` (lines 1-180), `core/posthog/src/config.ts` (lines 1-36) - PostHog client, Prompts client, survey/feedback config.
21. `modules/workflows/src/router.ts` (grep lines 274-769) and `modules/workflows/src/runtime.ts` (lines 1-220, grep lines 246-428) - existing workflow CRUD/run/report runtime.
22. `modules/classification/src/workflows/classification-workflow.ts` (grep lines 647-648) and `modules/classification/src/workflows/enqueue.ts` (grep lines 66-67) - existing DBOS workflow for classification.
23. `outputs/skill-first-ai-native-architecture.md` (lines 459-579, 677-802) - target single-agent, skill-first, lazy discovery, approval/async architecture.
24. `outputs/erp-billing-ai-native-roadmap.md` (lines 243-453, 697-856) - target ERP/billing/fiscal/contracts roadmap and domain model.

## Key Code

### Current product domains

`apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-nav-items.ts` defines the active route groups:

```ts
main: Inbox
finance: Lançamentos, Contas Bancárias, Cartões de Crédito, Relatórios, Categorias, Centros de Custo
relationships: Clientes, Fornecedores
automation: Automações
```

These are the natural AI skill boundaries. Current `modules/agents/src/skills.ts` only has:

```ts
id: "financeiro"
name: "Financeiro"
promptName: "montte-ai-skill-financeiro"
```

### Current AI runtime

`modules/agents/src/agent.ts` already has the core loop:

```ts
chat({
  adapter: flashModel,
  systemPrompts: [rootPrompt, activeSkillPrompt?, RENDERING_PRIMER],
  messages: convertMessagesToModelMessages(options.messages),
  tools: [advisorTool, ...readTools],
  modelOptions: { reasoning, parallelToolCalls: false },
  agentLoopStrategy: maxIterations(8),
  middleware: [otelMiddleware(...), ...extraMiddleware]
})
```

Important capabilities already present:
- PostHog Prompts via `options.prompts.get(...)` and `prompts.compile(...)`.
- OTEL middleware with org/team/thread/run metadata.
- `pageContext.skillHint` prompt loading.
- json-render UI primer, but no formal OpenUI component contract yet.
- Read tools built from oRPC clients.

### Current AI transport/UI

`apps/web/src/routes/api/chat.ts` accepts AG-UI/TanStack AI HTTP POST, builds oRPC web context, calls `createAgUiThreadChatStream`, and returns SSE.

`chat-runtime.tsx` uses assistant-ui + `@assistant-ui/react-ag-ui`:

```ts
class MontteHttpAgent extends HttpAgent {
  super({ threadId: initialThreadId, url: "/api/chat" });
  forwardedProps: { ...forwardedProps, pageContext: pickPageContext() }
}
```

`pickPageContext()` currently only sends `{ skillHint }` from a persisted chat scope. It does not send route/entity/filter/selection context yet.

### Current domain tools exposed to AI

`modules/agents/src/tools/registry.ts` exposes read-only wrappers over:
- bank accounts: `getAll`, `list`
- categories: `getAll`, `getPaginated`
- credit cards: `getAll`
- reports: P&L, cash flow, expenses by cost center/category, aging
- statements: `getAll`
- tags: `getAll`
- transactions: `getAll`, `getSummary`

Missing from AI tools today: relationships, inbox, workflows, writes/proposals, approvals, async start/status/cancel, contracts/billing/payments/fiscal/open finance.

### Current workflow/async stack

Existing primitives:
- `core/dbos`: DBOS client, queue registration, workflow enqueue, `registerWorkflowOnce`.
- `core/pg-boss`: Postgres job client/worker helpers.
- `modules/classification`: DBOS workflow for transaction classification.
- `modules/workflows`: user-facing automation CRUD/run system, currently fixed graph shape: schedule trigger → create report.
- `modules/agents`: pg-boss jobs for generating thread titles and refreshing suggestions.
- `modules/cards`: pg-boss job for closing statements.

### Current data model

Active schemas exported by `core/database/src/schema.ts`: agents, auth, bank accounts, categories, credit cards/statements/totals, inbox, reports, relationships, workflows, financial settings, tags, threads, messages, transactions.

Important existing seams:
- `relationships.parties` supports `customer` and `supplier` with document/email/phone.
- `finance.transactions` links to `relationshipId`, payment method, status, due date, paid date, recurrence/installments/items.
- `agents.threads/messages` persist conversations and message page context.
- `platform.workflow_runs` links runs to generated reports.

Missing active schemas: contracts, billing, payments, fiscal, vault, open_finance, integrations, extensions, business_events, provider_webhook_events, approvals, audit_events, agent_trajectory_events, knowledge/retrieval/memory.

## Architecture

### What exists now

```text
Web UI/routes
  -> oRPC routers
    -> Drizzle/Postgres domain schemas

Montte AI panel/chat
  -> /api/chat AG-UI SSE endpoint
    -> buildWebContext (db, auth, posthog, prompts, redis, pg-boss, workflowClient)
    -> modules/agents createAgentChat()
      -> PostHog Prompt root + optional finance skill prompt
      -> TanStack AI chat loop
      -> read-only finance/classification/cards/report tools via oRPC router client
      -> OTEL middleware
      -> pg-boss post-run title/suggestion jobs

Worker process
  -> DBOS workflows for classification/workflows/agents setup
  -> pg-boss workers for agent/card operational jobs
```

Current platform is already close to the desired substrate: one app, Postgres, oRPC, TanStack AI, PostHog, DBOS, pg-boss. The gap is not infrastructure availability; it is cohesion and domain capability coverage.

### What the roadmap wants

```text
relationships
  -> contracts + Contract Writer
    -> billing primitives
      -> payments provider adapter
      -> fiscal engine
      -> finance transactions/reconciliation
      -> open finance sync/reconciliation
      -> integrations/extensions

Montte AI single agent
  -> domain skills
  -> lazy tool discovery
  -> proposal/preview/approval
  -> DBOS/pg-boss async work
  -> audit/events/evals
```

The target architecture in `outputs/skill-first-ai-native-architecture.md` is explicit: UI and AI should call the same oRPC/use cases/workflows; AI should not get privileged data paths; tools should be governed by skill, tenant, risk and approvals; pg-boss is operational jobs; DBOS is durable business workflows.

## Connectivity Map

### Existing domains and current seams

| Domain | Exists | Connected to | Missing seam for cohesive AI-native platform |
|---|---|---|---|
| Account/Auth/Org/Team | Yes | oRPC context, protected procedures, routes | RBAC/permission model not yet surfaced as AI tool policy/skill permissions. |
| Finance/Cashbook | Yes | Transactions, bank accounts, imports, status, recurrence, reports, AI read tools | Write/proposal tools, approval gate, audit receipts, billing/invoice source links. |
| Cards | Yes | Credit cards, statements, transaction locking, pg-boss close statements | AI read tools exist; no AI proposal/workflow hooks for card/statement operations. |
| Classification | Yes | Categories/tags, suggestions, DBOS batch workflow | AI can read categories/tags but cannot safely trigger classification workflow or explain trajectory with approval/status. |
| Relationships | Yes | Customers/suppliers CRUD, transactions via `relationshipId` | Not exposed to AI read tools; no contracts/timeline/dedupe/enrichment/fiscal data. |
| Inbox | Yes | Aggregates due payments + uncategorized tx + persisted/dismissed items | Not exposed to AI; no unified action/task model across modules. |
| Reports/Insights | Yes | Deterministic report routers; workflows can create reports | AI can read reports; missing report generation proposal/approval and async status tool. |
| Workflows/Automation | Partially | Fixed schedule→report graph, runs, DBOS execution | Narrow domain; no event triggers, action catalog, approval, cross-domain orchestration. |
| Agents | Yes | Threads/messages/settings, PostHog prompts, AG-UI UI, pg-boss title/suggestions | Only finance skill; no lazy discovery/tool policy/approval/audit/harness/OpenUI schemas. |
| PostHog | Yes | Prompts, analytics/errors/feedback/surveys | No production eval wiring or prompt version metadata persisted into agent run/audit tables. |
| DBOS | Yes | Classification and workflow execution | No generic AI `start_workflow/get_status/cancel`; business workflows for contracts/billing/payments absent. |
| pg-boss | Yes | Agent/card operational jobs | No generic AI `start_background_job/get_status`; no shared job receipt/activity model. |
| Contracts | Roadmap only | Should bridge relationships → billing → finance/fiscal | Entire module/schema/UI/toolset missing; PlateJS dependency absent. |
| Billing | Roadmap only | Should bridge contracts → invoices/usage/customer state | Entire canonical source-of-truth missing. |
| Payments | Roadmap only | Provider adapter, webhooks, reconciliation | Entire module/schema/provider ledger missing. |
| Fiscal/Vault | Roadmap only | Certificates, SEFAZ/NFS-e, DFe, fiscal docs | Entire engine/schema/vault/approval/operational monitoring missing. |
| Open Finance | Roadmap only | External account/transaction sync into finance staging/reconciliation | Entire module/schema/provider connection/consent missing. |
| Integrations/Extensions | Roadmap only | Twenty/PostHog/external providers | No provider registry, SDK, webhook/event architecture. |

### Platform-wide seams to close first

1. **Business event spine missing**  
   Roadmap calls for `business_events`, `provider_webhook_events`, `audit_events`, `agent_trajectory_events`. Current modules mutate/read their own tables but do not emit a canonical cross-domain event stream. This is the main seam for “a plataforma conversar entre si”.

2. **Approval/preview model missing**  
   AI architecture requires preview → approval → deterministic procedure/workflow. Current code has AG-UI approval event types in chat parsing, but no reusable approvals table/router/UI/tool policy backing business actions.

3. **Skill contract gap**  
   `skills.ts` is metadata only and uses `financeiro`; target wants domain skills (`finance`, `relationships`, `automation`, `inbox`, later `contracts`, `billing`, etc.) with allowed tools, references, risk tiers, async work and evals.

4. **Tool policy/lazy discovery gap**  
   Current tools are eagerly included read tools. Target wants bootstrap tools (`discover_skills`, `load_skill`, `discover_tools`, `load_tool_schema`, `request_approval`, async tools) and deterministic rejection of unpromoted/unauthorized tools.

5. **Frontend context is too thin**  
   Current `pickPageContext()` sends only `skillHint`. Target needs route, page kind, entity id, filters, selection, visible range and UI capabilities as non-authoritative hints with server revalidation.

6. **AI tools do not cover existing product evenly**  
   Finance has read tools. Relationships, inbox and workflows do not. This creates an AI experience that can talk about finances but cannot connect clients/suppliers, tasks and automations.

7. **Async primitives exist but are not productized for AI**  
   DBOS/pg-boss are installed and used, but there is no common `async_work` abstraction, status UI, cancel policy, or receipt linking a chat run to job/workflow/domain effects.

8. **PostHog is available but not full AI control plane yet**  
   Prompt loading exists. Missing: promptVersion/policyVersion persisted, PostHog Evals production wiring, run/tool metadata in PostHog, deterministic eval suite for financial correctness.

9. **OpenUI/json-render seam**  
   The prompt says tools return `ui` json-render specs, and message renderer appears to handle rich tool parts, but there is no central allowlisted OpenUI/json-render component registry/schema in `modules/agents/src/openui`.

10. **Contracts/billing source-of-truth mismatch**  
    README/product say billing is central, but active source has no billing/contracts schemas. Roadmap already flags this. This must be resolved before AI can connect recurrence end-to-end.

## Cohesive AI-Native Integration Shape

A cohesive Montte should look like this at runtime:

```text
User action or event
  -> oRPC procedure validates tenant/permissions/input
  -> deterministic domain change OR preview proposal
  -> business_event emitted
  -> optional pg-boss job or DBOS workflow started
  -> audit/receipt created
  -> inbox/activity surfaces update
  -> Montte AI can explain/status/next-action using same IDs
```

For AI-initiated flows:

```text
Montte AI
  -> discover/load skill
  -> read current state via domain tools
  -> produce structured preview with evidence
  -> request approval if write/external/high-risk
  -> call oRPC procedure or DBOS workflow after approval
  -> return receipt + async status card
  -> business_events feed Inbox/Reports/Timeline/Integrations
```

## Suggested First Seams to Implement

1. **`platform.business_events` + small emitter helper**  
   Add canonical event rows for current modules before new billing work. Start with finance transaction created/updated/paid, party created/updated, workflow run completed, agent run completed.

2. **`platform.action_receipts` / `approvals`**  
   Shared schema/router/UI for preview, approval, execution result, actor, source (`ui`/`ai`/`webhook`/`workflow`), linked entity IDs.

3. **Expand AI read tools to relationships + inbox + workflows**  
   Low-risk and immediately makes Montte AI cross-platform without writes.

4. **Replace simple `skills.ts` with skill contracts**  
   Start with `finance`, `relationships`, `automation`, `inbox`; keep `financeiro` alias temporarily if needed for existing prompts/scopes.

5. **Upgrade frontend page context**  
   Send route group, route, title, selected entity IDs, filters and table selection. Server validates all IDs before use.

6. **Async work abstraction**  
   Wrap existing DBOS/pg-boss jobs as `async_work` records/status cards before adding contract/billing workflows.

7. **Contracts module as first new connective domain**  
   Build `relationships → contracts` before billing. Include Contract Writer document tables, extracted terms and evidence, but keep activation deterministic/approved.

8. **Billing primitives after contract terms**  
   Build products/services/prices/subscriptions/invoices/usage as Montte source-of-truth; providers only map to payments.

## Start Here

Open `apps/web/src/integrations/orpc/router/index.ts` first. It is the live capability map: every cohesive AI/tool/workflow integration should either reuse an existing router there or add a new domain router there. Then open `modules/agents/src/tools/registry.ts` to see which of those capabilities the AI can currently access; the delta between these two files is the fastest actionable seam map.
