# Provenance — tanstack-ai-finance-agent-strategy

## Comandos/artefatos locais

- `find modules/agents/src -maxdepth 3 -type f`
- `read modules/agents/src/agent.ts`
- `read modules/agents/src/tools/registry.ts`
- `read modules/agents/src/tools/cashbook.ts`
- `read modules/agents/src/tools/reports.ts`
- `read modules/agents/src/skills.ts`
- `read core/ai/src/models.ts`
- `rg -n "useAgUiRuntime|HttpAgent|externalStore|Thread|agent\.chat|stream" apps/web/src modules/agents/src/router/chat.ts`
- `rg -n "tanstack|assistant|ag-ui|openrouter|mastra|@ai|\bai\b" package.json modules/agents core apps/web -S`

## Web search/fetch

- `web_search`: TanStack AI docs/current features, GitHub/examples, finance agents 2025/2026.
- `web_search`: Evalite docs/GitHub/API/CLI for TypeScript eval runner.
- `fetch_content`: TanStack AI API, AG-UI compliance, tools, OTel, middleware blog.
- `fetch_content`: Microsoft Finance reconciliation docs, AWS agentic AI financial services security, SAP Business AI for finance.

## Paper search/read

- `alpha search -m semantic "LLM agents tool use evaluation benchmarks task automation governance auditability finance accounting"`
- `alpha get 2601.11816` — POLARIS.
- `alpha get 2605.08258` — Designing Intelligent Enterprise Agents.
- `alpha get 2603.13942` — AI Agents in Financial Markets.

## Known caveats

- Sage source fetch blocked.
- No live package registry diff performed beyond search result snippets and local `package.json` inspection.
- No code changes applied; this is a strategy artifact.

## Update 2026-05-25 — Evalite

Added Evalite recommendation based on current docs/search results:

- https://www.evalite.dev/
- https://v1.evalite.dev/api/evalite
- https://v1.evalite.dev/api/cli
- https://github.com/mattpocock/evalite

Decision: use Evalite as batch eval runner and UI, but avoid `evalite/ai-sdk` wrapper because Montte guidelines prohibit Vercel AI SDK; call TanStack AI harness directly from Evalite `task`.
