# TanStack AI

Use para mudancas no agente do Montte: chat runtime, middleware, prompts, tools, streaming, AG-UI/OpenUI, structured outputs, adapter/model config, AI telemetry e testes de comportamento de IA.

## Stack

- Sempre use `@tanstack/ai` + `@tanstack/ai-openrouter` pelo catalog `tanstack-ai`.
- Nunca use Vercel AI SDK (`ai`, `@openrouter/ai-sdk-provider`).
- Modelos/adapters compartilhados ficam em `@core/ai/*`.
- Observabilidade de AI usa OTEL/TanStack AI middleware; product analytics continua via PostHog quando for evento de produto.

```typescript
const result = await chat({
   adapter: openRouterText("liquid/lfm2-8b-a1b", {
      apiKey: env.OPENROUTER_API_KEY,
   }),
   messages: [{ role: "user", content: [{ type: "text", content: prompt }] }],
   outputSchema: z.object({}),
   stream: false,
});
```

## Ownership

`modules/agents` e dono da plataforma agentica:

- chat execution;
- prompts;
- tools;
- thread/message state do agente;
- OpenUI/AG-UI integration;
- AI telemetry;
- jobs operacionais do agente.

CRUD/actions nao agenticos ficam nos modulos de dominio e podem ser expostos ao agente apenas por tools tipadas.

Estrutura preferida:

```text
modules/agents/src/
  router/chat.ts
  runtime/
  threads/
  tools/
  openui/
  jobs/
  workflows/
  harness/
  telemetry/
```

## Runtime

- O entrypoint do chat deve montar argumentos para `chat(...)` e chamar TanStack AI diretamente.
- Use `convertMessagesToModelMessages` para converter `UIMessage[]` antes de chamar o modelo.
- Use `systemPrompts` para prompt raiz, skill ativa e primers de renderizacao.
- Use `maxIterations(...)` para limitar agent loop.
- Use `modelOptions` para reasoning e `parallelToolCalls: false` quando as tools dependem de estado/ordem.
- Propague `threadId`, `runId` e `AbortSignal` para o runtime.
- Prompt assembly deve carregar templates via PostHog Prompts e compilar com contexto controlado.
- Se `pageContext.skillHint` existir, carregue a skill ativa pelo catalogo de skills do agente.

## Middleware

TanStack AI chat lifecycle logic pertence a `ChatMiddleware`, nao a callbacks de endpoint/client.

- Mantenha middleware coeso em `runtime/middleware/create-agent-runtime-middlewares.ts`.
- Nao divida um side effect pequeno por arquivo antes de haver complexidade real.
- Persistencia de mensagens assistant acontece em `onFinish`.
- Use `ctx.defer()` para side effects nao bloqueantes depois do stream, como title e suggestions.
- Falhas recuperaveis usam `better-result` + `TaggedError`, nao `try/catch` cru.
- Jobs disparados pelo middleware devem respeitar pg-boss singleton/debounce/retry/DLQ.

Title e suggestions sao pg-boss jobs disparados de `ChatMiddleware.onFinish`; mantenha fora de DBOS ate virarem workflows de negocio duraveis que exigem replay/steps.

## Transport

Chat transport pertence ao oRPC, nao a rota manual `/api/chat`.

- Exponha stream como procedure tipada retornando Event Iterator.
- Consuma no TanStack AI client por RPC stream adapter.
- Exclua streaming procedures do batching oRPC.
- Preserve lifecycle AG-UI estrito: um `RUN_STARTED`, tool calls consistentes, terminal chunk unico.
- Zod valida input HTTP, forwarded props, page context e persisted metadata antes de passar para o runtime.

## AG-UI e assistant-ui

TanStack AI streama eventos AG-UI.

Para assistant-ui, prefira o runtime AG-UI nativo quando o endpoint fala o contrato AG-UI:

- `@assistant-ui/react-ag-ui`;
- `HttpAgent` de `@ag-ui/client`;
- `useAgUiRuntime({ agent })`.

O runtime nativo parseia `TEXT_MESSAGE_*`, `TOOL_CALL_*`, `THINKING_*`/`REASONING_*`, `STATE_SNAPSHOT`, `STATE_DELTA`, `RUN_ERROR` e cancellation.

Enquanto Montte mantiver thread state externo em TanStack DB/Query, `useExternalStoreRuntime` pode ficar como adapter de transicao. Nao construa um segundo parser AG-UI custom no app.

## OpenUI e json-render

OpenUI e a camada de generative UI, nao substitui AG-UI transport.

- Backend prompt assembly inclui component/tool spec OpenUI quando o output esperado for UI generativa.
- O modelo deve produzir OpenUI Lang ou spec controlado conforme o renderer da tela.
- Frontend renderiza OpenUI/json-render dentro das assistant-ui message parts.
- Definicoes de componente e tool specs ficam em `modules/agents/src/openui`.
- Tools de leitura/escrita devem retornar `ui` quando a resposta tiver visualizacao estruturada.
- Depois de uma tool call com `ui`, o assistant deve responder no maximo 1-2 frases e nao duplicar a tabela/contagem/nomes em markdown.

## Tools

- Tools vivem em `modules/agents/src/tools`.
- Tool input/output sempre usa Zod.
- Tool deve expor contrato pequeno, tipado e orientado ao dominio.
- Tools de dominio chamam routers/use cases do modulo dono; nao recriam regra de negocio dentro de `modules/agents`.
- Read tools podem usar `createRouterClient` com `ORPCContextWithOrganization` para reaproveitar procedures existentes.
- Nao deixe `unknown` atravessar a edge da tool; parseie ou converta imediatamente para erro tipado.
- Tools internas de orquestracao tambem devem ter UI/estado claro quando forem exibidas no cliente.

## Erros

Fluxos novos em `modules/agents` usam `better-result` com `TaggedError`, catalogo evlog e mensagens pt-BR explicitas.

- Nao importe `WebAppError`.
- Nao misture `neverthrow` em `modules/agents`.
- Nao crie `errors.ts` module-wide.
- Defina catalogo no owner: `agents.chat` no runtime de chat, `agents.thread` em `router/chat.ts`, `agents.runtime` no middleware, `agents.job.title` no title job, `agents.job.suggestions` no suggestions job, e catalogos por tool no arquivo dono.
- Uma classe `TaggedError` por bounded context. O `error` return type do catalogo e o discriminador; nao crie uma classe por codigo.
- Payload deve incluir ids operacionais como `threadId`, `teamId`, `organizationId`, `jobId`, `messageCount` quando ajudarem a operar a falha.
- Evite strings genericas `operation` quando o catalog code ja identifica a falha.
- Nao passe `cause` unknown nem adicione helpers `toError`.
- Handlers oRPC podem lancar tagged errors diretamente; nao traduzir para `WebAppError`.

## Jobs

Title e suggestions sao jobs operacionais simples, nao DBOS workflows.

- Enfileire de `ChatMiddleware.onFinish` com `ctx.defer()`.
- Title usa singleton/debounce estavel por thread.
- Suggestions usa `sendDebounced` com chave `threadId`.
- Arquivo do job e dono de queue name, DLQ, queue creation, enqueue helper, Zod payload schema, handler, catalog e tagged error.
- Consumers vivem em `apps/worker`; web so enfileira pelo `pgBoss` context promise e helpers.

Leia tambem `references/pg-boss.md` quando criar ou alterar job de agente.

## Telemetry

- Use `otelMiddleware` do TanStack AI para traces de runtime.
- Use `getAiTracer()` e atributos de `@core/ai/otel`.
- `captureContent` deve ficar `false` por padrao para nao vazar conteudo sensivel.
- Inclua atributos como distinct/user/org/team/thread/run/turn e skill ativa quando disponiveis.
- Nao duplique request telemetry normal em PostHog capture direto; reserve capture direto para eventos de produto.

## Testes

- Testes que exercem AI behavior usam `@copilotkit/aimock`/`LLMock` fixtures contra o caminho real de TanStack AI.
- Nao mocke action functions locais so para pular model calls.
- Mocke apenas queue/workflow boundaries quando o comportamento de IA nao for alvo do teste.
- Valide Zod schemas de inputs/outputs de tools quando a tool tiver transformacao relevante.
- Para stream/AG-UI, teste invariantes de lifecycle quando alterar normalizacao do stream.

## Validacao

```bash
bun --filter agents typecheck
bun --filter worker typecheck
bun --filter web typecheck
git diff --check
```
