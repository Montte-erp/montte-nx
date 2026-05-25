# Provenance — skill-first-ai-native-architecture

Data: 2026-05-25

## Busca web

- `web_search`: skill based AI agent architecture capability based agents tool permissions evals 2026
- `web_search`: LLM agent skills architecture capability contracts tool governance enterprise agents
- `web_search`: Claude skills ChatGPT tools agent skills architecture prompt tool routing
- `web_search`: AI native application architecture agentic software design AI-native SaaS architecture 2026
- `web_search`: AI-native enterprise software architecture agents workflows human approval observability evals
- `web_search`: AI-native ERP finance software architecture AI agents system of record workflow

## Fetch direto

- Anthropic Agent Skills overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic Skill best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Microsoft Agent Skills: https://learn.microsoft.com/en-us/agent-framework/agents/skills
- NVIDIA Verified Agent Skills: https://developer.nvidia.com/blog/nvidia-verified-agent-skills-provide-capability-governance-for-ai-agents/
- SAP AI-native North Star Architecture vision: https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision
- SAP Process Layer: https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- Builder.io Agent-Native Architecture: https://www.builder.io/blog/agent-native-architecture
- Anthropic PDF fetch returned too little content in one route; not used as primary source.

## Alpha / papers

- `alpha search -m semantic "skill based LLM agent architecture capability contracts tool governance evaluation"`
- `alpha get 2605.07358` — A Comprehensive Survey on Agent Skills
- `alpha get 2605.22634` — Contractual Skills
- `alpha get 2604.17870` — GraSP
- `alpha get 2601.08815` — Agent Contracts
- `alpha get 2601.11816` — POLARIS
- `alpha get 2604.11839` — Beyond Static Sandboxing / Aethelgard
- `alpha search -m semantic "AI native ERP generative business process agents system of record workflows finance"`
- `alpha get 2506.01423` — FinRobot / Generative Business Process AI Agents for ERP

## Repo local

- `read modules/agents/src/skills.ts`
- Prior artifact/repo inspection from `outputs/tanstack-ai-finance-agent-strategy.md` used for current Montte runtime state.

## Caveats

- Several 2026 arXiv results are preprints; numeric claims are cited as paper-reported, not independently reproduced.
- Vendor/blog claims were used for architectural framing, not quantitative performance claims.

## Review pass

Ran `reviewer` subagent on the draft. Applied corrections:

- Clarified that Montte skills must not execute arbitrary directory scripts; executable behavior should be typed TypeScript tools/procedures/workflows.
- Separated oRPC (contract/procedure), DBOS (durable workflows), and pg-boss (operational jobs).
- Softened `pageContext.skillHint` from absolute winner to strong prior.
- Added tool risk tiers, owner module, audit metadata, and rollback/compensation policy fields.
- Strengthened `skill.cobranca` controls: templates, consent/opt-out, rate limit, allowed channel, send audit.

## Second refinement — agent-driven skill discovery + lazy tools + frontend context

User requested: let the agent discover skills using a tool, use lazy tool loading, and allow frontend-injected context similar to PostHog.

Additional sources consulted:

- `web_search`: PostHog Max AI frontend context injection tools product analytics AI agent architecture
- `web_search`: PostHog AI frontend context LLM tools product context documentation
- `web_search`: lazy tool loading LLM agents discover tools dynamically architecture
- `fetch_content`: https://tanstack.com/ai/latest/docs/tools/lazy-tool-discovery
- `fetch_content`: https://posthog.com/handbook/engineering/ai/architecture
- `fetch_content`: https://posthog.com/docs/posthog-ai/context-and-commands
- `fetch_content`: https://github.com/PostHog/posthog/blob/master/ee/hogai/README.md
- `alpha search -m semantic "lazy tool discovery dynamic tool gating LLM agents tool schemas"`
- `alpha get 2604.21816` — Tool Attention Is All You Need

Applied design changes:

- Replaced hard pre-router recommendation with agent-driven `discover_skills` / `load_skill` flow.
- Added bootstrap tools: `discover_skills`, `load_skill`, `get_frontend_context`, `discover_tools`, `load_tool_schema`, `request_approval`.
- Added lazy tool loading architecture and unpromoted tool rejection.
- Added `AgentFrontendContext` schema and safety policy.
- Changed `pageContext.skillHint` into a hint/prior, not an imperative router.
- Updated roadmap with PRs for bootstrap discovery, lazy loading, and frontend context injection.

## Verification/review fix after subagent review

Reviewer flagged implementability and safety gaps. Applied corrections:

- Added explicit TanStack AI implementation strategies:
  - Strategy A: one `chat()` using TanStack lazy tool discovery with metadata registered up front.
  - Strategy B: two `chat()` invocations when full skill prompt must be mounted after activation.
- Clarified `load_skill` must not magically mutate a system prompt already sent to the model.
- Added server-side telemetry fields: `hintedSkill` and `activatedSkill`.
- Tightened `AgentFrontendContext`: Zod per route/skill, rejected unknown keys, bounded primitive filters, fixed selection entity types.
- Added `ui_control` tool risk tier for UI manipulation tools.
- Added bootstrap tool risk contracts, especially `request_approval` as idempotent proposal-only and unable to approve its own proposal.

## Decision update

User confirmed: Strategy A is the correct direction. Updated report to make one `chat()` with TanStack AI native lazy tool discovery the chosen architecture. Strategy B is retained only as a fallback note, not as an implementation target.

## Third refinement — agent-initiated background jobs and durable workflows

User requested: model that Montte AI can run background tasks via pg-boss jobs and workflows via DBOS.

Additional sources consulted:

- `web_search`: DBOS TypeScript workflows durable execution AI agents human approval background tasks
- `web_search`: pg-boss PostgreSQL job queue TypeScript background jobs retries scheduling docs
- `web_search`: AI agent background tasks durable workflows approval async jobs architecture

Applied design changes:

- Added a distinction between synchronous chat work, pg-boss background jobs, and DBOS durable workflows.
- Added `asyncWork` to `AgentSkillContract` with allowed pg-boss jobs, DBOS workflows, status/cancel tools, and visibility policy.
- Added risk tiers `background_job` and `durable_workflow`.
- Added bootstrap/lazy tools: `start_background_job`, `start_workflow`, `get_async_status`, `cancel_async_work`.
- Added policy that async work cannot bypass preview/approval; async write/external/bulk actions retain the same approval requirements.
- Added typed result contracts for background jobs and workflows.
- Added roadmap PR for pg-boss/DBOS async work tools and eval scorers for async policy/idempotency/workflow approval.

Key source interpretation:

- pg-boss is treated as operational background queue with retries/scheduling/DLQ.
- DBOS is treated as durable business-process workflow runtime with checkpointed steps, resume/replay, waits, approval, and compensation.
- oRPC remains contract/procedure/transport, not durable execution.

## Fourth refinement — domain skills + agentic UX/UI + execution matrix

User requested a larger research pass on agentic UX/UI, agentic loops, and which tools per domain should be synchronous, pg-boss jobs, or DBOS workflows. User also clarified that skills must be domain-based using route group labels, with references like the repo skills, PostHog Prompts, and PostHog production evals.

Local repo evidence:

- Screenshot showed route group labels: Finanças, Relacionamentos, Automação.
- Read `apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-nav-items.ts` and confirmed route groups:
  - `finance` / `Finanças`: transactions, bank-accounts, credit-cards, reports, categories, tags.
  - `relationships` / `Relacionamentos`: customers, suppliers.
  - `automation` / `Automação`: workflows.
  - `main`: inbox.
- Searched modules and found existing relevant modules/workflows: `modules/classification/src/workflows`, `modules/workflows`, `modules/inbox`, `modules/cashbook`, `modules/agents`.

Additional web research:

- `web_search`: agentic UX UI patterns human in the loop approval preview AI agents enterprise software
- `web_search`: agentic user interface design patterns AI agents workflows background tasks approvals activity center
- `web_search`: agentic loop architecture plan act observe reflect tool use UI human approval production agents
- `web_search`: AI agent UX design background tasks progress notifications approvals enterprise

Applied changes:

- Added section: domain skills should be route-group/domain based, not feature-route based.
- Added domain skill catalog with references for finance, relationships, automation.
- Added PostHog Prompts + PostHog Evals production architecture.
- Added Agentic UX/UI and agentic loop section: Observe → Discover → Frame → Plan → Preview → Approve → Act → Observe progress → Verify → Recover.
- Added product UX requirements: intent preview, autonomy levels, plan surface, progress stream, activity center, confirmation gates, evidence panel, receipts, error recovery, selective transparency.
- Added matrix mapping domain tools/capabilities to sync read/write, pg-boss jobs, DBOS workflows, approval, and UX surface.
- Fixed duplicated numbering in Decisions section.

## Fifth refinement — OpenUI, AI chat UX, harness engineering, sandbox, TanStack AI Code Mode

User requested adding generative UI with OpenUI, more research on AI chat UI/UX, harness engineering, sandboxing, and TanStack AI Code Mode.

Additional sources consulted:

- `web_search`: OpenUI generative UI AI agents structured UI components tool calls
- `web_search`: AI chat UI UX best practices conversational interface agentic chat design sources
- `web_search`: agent harness engineering LLM agents tools guardrails evals observability sandbox architecture
- `web_search`: LLM agent sandboxing tools code execution security capability isolation approval
- `web_search`: TanStack AI code mode codemode documentation
- `web_search`: TanStack AI CodeMode agent documentation OpenUI AG-UI
- `web_search`: site:tanstack.com/ai CodeMode TanStack AI
- `fetch_content`: NN/g AI chatbot guidelines; Microsoft UX design for agents; Amazon Science human-AI coordination. OpenUI fetch hit HTTP 429, so web_search snippets and local TanStack AI reference were used for OpenUI details.
- `alpha search`: agent harness safety sandbox LLM agents tool calls unauthorized resource access
- `alpha get 2605.14271`: Auditing Agent Harness Safety
- `alpha get 2603.22928`: SoK: The Attack Surface of Agentic AI
- Local reference: `.agents/skills/implementation/references/tanstack-ai.md` OpenUI/AG-UI guidance.

Applied changes:

- Added Chat UI/UX + OpenUI/generative UI section.
- Clarified AG-UI = transport/events, OpenUI = structured generative UI layer, assistant-ui = React shell.
- Proposed initial OpenUI component library for Montte: EvidenceCard, FinancialMetricGrid, TransactionsTable, ReportChart, IntentPreview, ApprovalPanel, AsyncWorkCard, ReceiptCard, RelationshipCard, AutomationRunTimeline.
- Added OpenUI security/provenance/accessibility rules.
- Added harness engineering section: AgentHarness responsibilities and trajectory audit.
- Added TanStack AI Code Mode section with selected policy: default off, read/proposal-only sandbox for approved references, no writes/secrets/network, no persisted snippets initially.
- Added sandbox requirements: capability-based APIs, deny-by-default network/filesystem/secrets, Zod boundaries, resource limits, audit, redaction, tenant isolation, prompt-injection/tool-poisoning evals.
- Added Code Mode and OpenUI fields to `AgentSkillContract`.
- Added roadmap PRs for OpenUI and harness safety/Code Mode sandbox.

## Sixth refinement — broad AI technology radar: RAG, memory, protocols, model routing, evals

User requested a broader research pass over “all kinds of AI technology, like RAG etc.” and what makes sense to add to this architecture.

Searches/tools used:

- `web_search`: enterprise AI / RAG / agent architecture patterns for 2025–2026.
- `web_search`: agentic RAG, GraphRAG, memory, observability, guardrails, RAG evaluation, hybrid search, reranking.
- `fetch_content`: Model Context Protocol introduction and security best practices.
- `fetch_content`: OpenAI Structured Outputs; Anthropic tool use overview; Anthropic Building Effective Agents.
- `fetch_content`: LlamaIndex evaluation docs; Ragas metrics; LangSmith evaluation concepts.
- `fetch_content`: Pinecone rerankers; ParadeDB hybrid search; PostgreSQL full-text search.
- `alpha search`: RAG/agent architecture/memory/eval/observability and agent security/governance.
- `alpha get`: `2407.13193`, `2501.09136`, `2603.07379`, `2602.10479`, `2604.08224` where available. `2505.00675` had an alphaXiv 502, but the arXiv metadata/search result was used and marked by direct URL in sources.

Applied changes:

- Added `Radar de tecnologias de IA para Montte` section.
- Added decision matrix covering: domain tools, structured outputs, RAG, hybrid retrieval, reranking, agentic RAG, GraphRAG, NL2SQL, semantic layer, memory, model routing, prompt caching, fine-tuning, embeddings, multimodal/OCR, voice, browser/computer use, MCP, A2A, guardrails, LLM judges, synthetic data, human feedback.
- Added a governed `Knowledge & Retrieval Layer` architecture.
- Added production RAG pattern: query understanding → lexical BM25/full-text → dense embeddings → fusion → rerank → citation context pack → eval.
- Added boundaries: RAG for docs/text/evidence; deterministic tools/procedures for financial numbers.
- Added sections on Agentic RAG, GraphRAG/entity graph, memory buckets, model gateway/routing, fine-tuning criteria, and protocols.
- Added new harness/eval requirements: retrieval source policy, injection resistance, citation required, financial number source, memory write policy, memory poisoning eval, model routing regression, MCP tool boundary.
- Added roadmap PR for `Knowledge & Retrieval Layer mínima`.
- Updated recommended decisions with RAG/memory/MCP policies.
- Fixed top thesis skills list to route-group domain skills plus references/subcapacidades.


## Seventh refinement — Postgres-only AI data/storage constraint

User clarified a hard architecture constraint: Montte will use only Postgres, no additional database.

Applied changes:

- Updated technology radar to make hybrid retrieval explicitly Postgres-only.
- Replaced generic embeddings/vector index wording with Postgres storage/indexes: Postgres full-text/ParadeDB BM25 and embeddings in Postgres if needed, e.g. pgvector/ParadeDB-compatible setup.
- Reframed GraphRAG as `entity graph Postgres-only`, implemented with relational tables/views/materialized views/indexes, not Neo4j or another graph DB.
- Added explicit decision: no separate vector DB, graph DB, or search DB.
- Updated roadmap item for GraphRAG/entity graph to say Postgres-only.

