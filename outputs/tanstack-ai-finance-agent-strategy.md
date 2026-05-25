# Deep research — TanStack AI, harness do agente e estratégia para agentes financeiros no Montte

Data: 2026-05-25  
Escopo: avaliar o estado atual do harness do Montte AI, o que TanStack AI oferece hoje, o padrão emergente de agentes financeiros/ERP e uma estratégia pragmática para o Montte.

## Resumo executivo

**Observação principal:** o Montte já está na direção certa: usa `@tanstack/ai`, OpenRouter, `toolDefinition` com Zod, `maxIterations`, OpenTelemetry, assistant-ui via AG-UI nativo, thread state remoto e tools financeiras de leitura. Isso combina com a arquitetura recomendada nas docs atuais do TanStack AI e com o padrão de mercado para agentes financeiros: agir dentro do sistema de registro, com contratos tipados, trilha de auditoria, controles e humano no loop.

**Gap principal:** ainda falta um **harness formal de avaliação e governança**. Hoje o runtime existe, mas não há pacote explícito `modules/agents/src/harness/` para: golden tasks, replay de threads, assert de tool calls, orçamento de iterações/custo, avaliação de respostas financeiras, testes de permissões, simulação de aprovação, nem relatório de regressão por skill.

**Estratégia recomendada:** manter **um agente principal** e evoluir por **skills**. Não criar vários agentes separados como produto/UX. O usuário conversa com Montte AI; capacidades novas entram como `skill.financeiro`, `skill.conciliacao`, `skill.categorizacao`, `skill.cobranca`, `skill.billing`. Subagents podem existir, mas apenas como detalhe interno de execução de uma skill — nunca como a abstração principal exposta ao usuário.

## Evidência coletada

### 1. TanStack AI atual

Fontes oficiais indicam que `chat()` hoje suporta:

- `adapter`, `messages`, `tools`, `systemPrompts`, `agentLoopStrategy`, `abortController`, `modelOptions`, `threadId`, `runId` e `parentRunId`.
- `toolDefinition()` como definição isomórfica com schema Zod/JSON Schema, `.server()` e `.client()`.
- AG-UI compliance com `RunAgentInput`, `threadId`, `runId`, `tools`, `forwardedProps`, `chatParamsFromRequest` e `mergeAgentTools`.
- Middleware de lifecycle com `onConfig`, `onChunk`, `onBeforeToolCall`, `onAfterToolCall`, `onUsage`, `onAbort` e `ctx.defer()`.
- OpenTelemetry via `otelMiddleware`, spans por chat/iteração/tool e métricas de tokens/duração; `captureContent` deve ficar desligado por padrão para privacidade.

**Inferência:** TanStack AI é suficiente para o harness do Montte sem Vercel AI SDK/Mastra. A peça que falta é produto/arquitetura interna, não framework.

### 2. Estado atual do Montte

Inspeção local do repo:

- `modules/agents/src/agent.ts` monta `chat()` diretamente com `flashModel`, `systemPrompts`, skill ativa, tools, `maxIterations(8)`, `parallelToolCalls: false`, `threadId/runId`, abort e `otelMiddleware`.
- `modules/agents/src/tools/*` expõe tools financeiras tipadas: lançamentos, resumo financeiro, contas, cartões, categorias, tags e relatórios.
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/-montte-ai/chat-runtime.tsx` usa `useAgUiRuntime` + `HttpAgent` de `@assistant-ui/react-ag-ui`/`@ag-ui/client`.
- `apps/web/src/routes/api/chat.ts` serve o stream AG-UI hoje. **Isso é dívida técnica**: a guideline local de TanStack AI diz que o transporte deve pertencer ao oRPC e não a uma rota manual `/api/chat`.
- As tools financeiras atuais retornam dados estruturados, mas ainda **não retornam `ui`/json-render** de forma consistente; OpenUI/json-render deve ser tratado como etapa futura.
- Não existe diretório `modules/agents/src/harness/` no estado atual inspecionado.

**Inferência:** o runtime de produção está razoavelmente moderno, mas o harness ainda é implícito. Para mexer com dinheiro, o harness precisa virar primeira-classe.

### 3. Padrão de mercado para agentes financeiros

Fontes oficiais/produto mostram o mercado convergindo para agentes embutidos em workflows financeiros:

- Microsoft Finance Reconciliation Agent reconcilia dois datasets em Excel, sugere chaves/mapeamentos e produz relatório generativo; custom agents permitem controlar gatilho, fontes de dados e workflow.
- SAP posiciona Business AI para ERP/Finance em cash position, cash forecast, reporting, compliance e automação de processos financeiros.
- Oracle posiciona AI agents para ERP/EPM como automação end-to-end, visibilidade financeira, eficiência e controles.
- AWS Security recomenda, para agentes em serviços financeiros: identidades de agentes, escopo de ferramentas, supervisão para ações críticas, segregação de deveres, maker-checker, logs e monitoramento comportamental.
- Relatórios/produtos de 2026 como SAP, OneStream, Prophix e Microsoft enfatizam agentes dentro do sistema de registro, com controle e transparência — não chatbots soltos. A fonte da Sage apareceu na busca, mas o fetch foi bloqueado; portanto fica apenas como sinal não verificado, não como evidência forte.

**Inferência:** o wedge mais forte para Montte não é “chat com financeiro”. É **operação financeira assistida com evidência e ação controlada**: conciliação, categorização, cobranças, previsão de caixa e explicação de variações.

### 4. Literatura relevante

- **POLARIS: Typed Planning and Governed Execution for Agentic AI in Back-Office Automation** (2026, arXiv:2601.11816) defende planejamento tipado, seleção governada, execução guardada, repair loop limitado, policy guardrails e trilhas auditáveis para back-office.
- **Designing Intelligent Enterprise Agents: A Capability-Aligned Multi-Agent Architecture** (2026, arXiv:2605.08258) argumenta contra decomposição prematura em microagentes; propõe contratos de capacidade e fronteiras de autonomia/tool/data/memória.
- **AI Agents in Financial Markets: Architecture, Applications, and Systemic Implications** (2026, arXiv:2603.13942) organiza agentes financeiros em percepção de dados, motor de raciocínio, geração de estratégia e execução/controle; destaca autonomia, heterogeneidade, acoplamento, concentração de infraestrutura e observabilidade como riscos.

**Inferência:** para Montte, o caminho seguro é “typed tools + bounded autonomy + audit trail + eval harness + skill-first architecture”, não “agent swarm”.

## Estratégia recomendada

### Norte arquitetural

Criar um **Agent Harness** explícito com três responsabilidades:

1. **Avaliação:** provar que o agente responde certo, chama tools certas e não inventa números.
2. **Governança:** limitar autonomia, ferramentas, custo, iterações, escopo e ações de escrita.
3. **Operação:** registrar replay, traces, incidentes, feedback e métricas de qualidade.

Adicionar **Evalite** como runner de eval em massa. Evalite é local-first, TypeScript-native, baseado em Vitest, usa arquivos `.eval.ts`, permite `data` estático ou assíncrono, `task` e `scorers`, roda via CLI (`evalite run`) e possui UI local para explorar outputs/traces/logs. Para o Montte, usar Evalite como orquestrador de datasets e scorers, mas **não** adotar o wrapper de Vercel AI SDK (`wrapAISDKModel`) porque a guideline local proíbe Vercel AI SDK; o `task` deve chamar o runtime real de TanStack AI/fixtures LLMock diretamente.

Estrutura sugerida:

```text
modules/agents/src/
  harness/
    cases/
      financeiro-smoke.ts
      financeiro-regression.ts
      permissions.ts
      hallucination.ts
    evalite/
      financeiro-smoke.eval.ts
      financeiro-regression.eval.ts
      permissions.eval.ts
      run-evalite.ts
    fixtures/
      finance-small-org.ts
    evaluators/
      tool-call-evaluator.ts
      numeric-answer-evaluator.ts
      citation-evaluator.ts
      safety-evaluator.ts
      evalite-scorers.ts
    replay/
      run-harness.ts
      replay-thread.ts
    reports/
      render-harness-report.ts
    contracts/
      agent-capability-contract.ts
  runtime/
  tools/
  openui/
  telemetry/
```

### Sequência de produto

#### Fase 1 — `skill.financeiro` confiável

Foco: leitura e explicação dentro do agente principal.

Casos alvo:

- “Quanto entrou e saiu este mês?”
- “Quais despesas venceram e ainda estão pendentes?”
- “Mostra despesas por Centro de Custo no mês passado.”
- “Por que o caixa projetado caiu?”
- “Quais lançamentos parecem sem categoria?”

Critérios de aceite:

- Todo número vem de tool result, não de texto livre.
- Resposta financeira inclui período, filtros e base consultada.
- Se dados insuficientes, responde incerteza e pergunta/propõe filtro.
- Sem escrita no sistema.

#### Fase 2 — skills de triagem/recomendação

Foco: sugerir ações, ainda sem execução automática, como expansão do agente principal por skills.

Casos alvo:

- categorizações sugeridas;
- possíveis duplicidades;
- divergências de conta/cartão;
- cobranças vencidas por cliente/serviço;
- anomalias de despesa por fornecedor/Centro de Custo.

Critérios:

- Cada recomendação tem evidência: IDs, valores, datas, regra e confidence.
- Usuário pode aprovar em lote via UI, não por texto solto.
- Harness mede precisão/recall em fixtures rotuladas.

#### Fase 3 — skills de ação controlada

Foco: ações com aprovação, ainda sob o mesmo agente principal.

Ações candidatas:

- categorizar lançamentos;
- marcar como ignorado;
- preparar lembrete/cobrança como **rascunho** com template aprovado, consentimento/canal/frequência validados e aprovação explícita;
- preparar conciliação;
- gerar relatório recorrente.

Controles obrigatórios:

- `needsApproval`/fluxo equivalente para tools de escrita.
- preview determinístico antes da execução.
- maker-checker para ações sensíveis.
- rollback/compensação quando possível.
- audit log com input, tool, output, usuário aprovador, threadId, runId e ids afetados.

## Design de harness mínimo

### Eval em massa com Evalite

Formato recomendado para cada `.eval.ts`:

```typescript
import { evalite } from "evalite";
import { runAgentHarnessCase } from "../replay/run-harness";
import { numericGroundingScorer, toolCallScorer } from "../evaluators/evalite-scorers";
import { financeiroSmokeCases } from "../cases/financeiro-smoke";

evalite("financeiro.smoke", {
   data: financeiroSmokeCases,
   task: async (input) => runAgentHarnessCase(input),
   scorers: [toolCallScorer, numericGroundingScorer],
});
```

Uso no CI/local:

```bash
bunx evalite run modules/agents/src/harness/evalite
bunx evalite run modules/agents/src/harness/evalite --threshold 0.85
```

Regras:

- Evalite roda em massa e mostra inspeção local; o harness do Montte continua dono de fixtures, tenant context, prompts, runtime TanStack AI e coleta de traces.
- Cada eval registra `threadId`, `runId`, prompt version/hash, modelo, skill, tools disponíveis e seed/fixture.
- Scorers devem ser determinísticos sempre que possível; LLM-as-judge só para qualidade textual secundária e nunca para validar números financeiros.
- Separar smoke curto para PR de regressão pesada/nightly.

### Golden tasks iniciais

| Classe | Exemplo | Oráculo |
|---|---|---|
| Consulta numérica | “saldo de abril” | valor exato igual ao `get_financial_summary` |
| Filtro temporal | “semana passada” | datas resolvidas corretamente em pt-BR |
| Tool selection | “despesas por categoria” | chama `generate_financial_report(expenses_by_category)` |
| Não-alucinação | “qual cliente mais atrasou?” sem tool cliente | informa limitação |
| Permissão | thread/time errado | erro/sem vazamento |
| UI futura | quando tool retornar `ui`/json-render | assistant não duplica tabela; antes disso, validar apenas dados estruturados |
| Custo | pergunta simples | <= N iterações, sem tool redundante |

### Métricas

- `tool_call_accuracy`: tool esperada vs tool usada.
- `argument_accuracy`: filtros/data/status/categoria corretos.
- `numeric_grounding`: números na resposta aparecem no tool output.
- `unsupported_claim_rate`: claims sem evidência.
- `approval_gate_rate`: ações sensíveis bloqueadas para aprovação.
- `iteration_count` e tokens por run.
- `latency_p50/p95` por skill.
- `tenant_isolation_failures`: deve ser zero.

### Middleware recomendado

Adicionar middlewares TanStack AI pequenos e compostos:

1. `financeGroundingMiddleware`: captura tool outputs e valida que números finais foram vistos.
2. `budgetMiddleware`: aborta por iteração/token/custo.
3. `toolPolicyMiddleware`: bloqueia tools por skill, papel e risco.
4. `auditMiddleware`: registra tool calls e decisões com `ctx.defer()`.
5. `pii/contentGuardMiddleware`: redige/filtra antes de stream/traces quando necessário.
6. `promptRunMetadataMiddleware`: registra prompt name/versão ou hash, modelo, reasoning effort, skill, threadId, runId e versões das tools em cada run do harness.

## Estratégia skill-first para finanças

Começar com **um agente principal supervisionado** e contratos de capacidade por skill. Não criar vários agentes como unidade de produto. A unidade de evolução deve ser a skill.

Regra arquitetural:

> O usuário conversa com um agente. O produto evolui por skills. Subagents são implementação, não experiência.

Contrato inicial:

```text
Skill: financeiro
Agente: Montte AI principal
Objetivo: responder, explicar e visualizar dados financeiros operacionais.
Pode: consultar lançamentos, contas, cartões, categorias, Centros de Custo e relatórios.
Não pode: alterar dados, enviar cobranças, criar lançamentos, reconciliar automaticamente.
Deve: citar período/filtros, usar tools para números, declarar limitação, manter pt-BR.
Métricas: numeric_grounding, tool_call_accuracy, unsupported_claim_rate, latency, custo.
```

Depois, adicionar skills/capacidades por fronteira de risco:

1. `skill.conciliacao` — matching e conciliação, alto valor, precisa fixtures e approval.
2. `skill.categorizacao` — sugestões com confidence e aprovação em lote.
3. `skill.cobranca` — cobranças/inadimplência somente como rascunho/preview inicialmente; exige política de canal, opt-out/consentimento, templates aprovados, aprovação explícita e auditoria.
4. `skill.previsao_caixa` — previsão de caixa; separar cálculo determinístico de narrativa LLM.
5. `skill.billing` — MRR, churn, uso medido e assinaturas quando o lado billing amadurecer.

Subagents são permitidos apenas quando uma skill precisa decompor trabalho internamente. Exemplos:

```text
skill.conciliacao
  subagent matcher: propõe pares prováveis entre extrato e lançamento
  subagent verifier: checa evidência, tolerância e inconsistências
  Montte AI principal: decide o que mostrar, pede aprovação e mantém a conversa

skill.categorizacao
  subagent classifier: sugere categoria/Centro de Custo
  subagent reviewer: identifica baixa confiança e conflitos
  Montte AI principal: apresenta preview e coleta aprovação
```

Esses subagents não devem ter thread própria na UX, identidade de produto ou autonomia de escrita. Eles rodam com tools, orçamento e escopo herdados da skill ativa.

## Riscos e objeções

- **Risco de alucinação numérica:** mitigar com outputs estruturados, grounding evaluator e resposta baseada em tool result.
- **Risco de permissão/tenant leakage:** harness precisa fixtures multi-tenant e testes de thread/team/organization.
- **Risco de decomposição excessiva:** evitar microagentes como arquitetura de produto. Preferir skills; subagents só como implementação interna com contrato, métricas e escopo herdados.
- **Risco de UX chatbot paralelo:** continuar integrando AI ao fluxo, com OpenUI/json-render e ações aprováveis na UI.
- **Risco de custo/latência:** budget middleware; cache apenas para dados quase estáticos por tenant/team/user, como categorias e Centros de Custo, com TTL curto. Evitar cache para saldos, lançamentos, vencimentos e relatórios financeiros. Manter `parallelToolCalls: false` onde ordem importa.

## Próximos passos concretos

1. Criar `modules/agents/src/harness/` com runner local e 10 golden tasks financeiras.
2. Adicionar Evalite (`.eval.ts`) como camada de eval em massa, chamando o runner real do harness via `task` e scorers próprios.
3. Adicionar fixtures pequenas e determinísticas de financeiro.
4. Usar `@copilotkit/aimock`/`LLMock` contra o caminho real do TanStack AI para testes de comportamento, e testes de invariantes AG-UI quando stream/tool calls entrarem no escopo.
5. Implementar avaliadores de tool calls, argumentos, números e claims sem evidência, expondo wrappers compatíveis com Evalite scorers.
6. Gerar relatório Markdown/JSON por run do harness, incluindo prompt name/versão/hash, modelo, reasoning effort, skill e versões das tools.
7. Planejar migração do transporte `/api/chat` para oRPC stream adapter conforme guideline local.
8. Só depois adicionar tools de escrita com approval, preview determinístico, procedure de domínio existente, audit log e política de reversão/compensação.
9. Planejar PR separado para contrato `skill.financeiro` e prompt reforçado.
10. Atualizar `modules/agents/src/skills.ts` para tratar skills como unidade principal de capacidade, incluindo permissões, tools permitidas, eval suite e política de aprovação por skill.

## Fontes

- TanStack AI Docs — `@tanstack/ai`: https://tanstack.com/ai/latest/docs/api/ai
- TanStack AI Docs — AG-UI compliance: https://tanstack.com/ai/latest/docs/migration/ag-ui-compliance
- TanStack AI Docs — Tools: https://tanstack.com/ai/latest/docs/tools/tools
- TanStack AI Docs — OpenTelemetry: https://tanstack.com/ai/latest/docs/advanced/otel
- TanStack Blog — Middleware, 2026-03-12: https://tanstack.com/blog/tanstack-ai-middleware
- Evalite — docs: https://www.evalite.dev/
- Evalite — `evalite()` API: https://v1.evalite.dev/api/evalite
- Evalite — CLI: https://v1.evalite.dev/api/cli
- Evalite — GitHub: https://github.com/mattpocock/evalite
- Microsoft Learn — Financial Reconciliation agent: https://learn.microsoft.com/en-us/copilot/finance/reconcile/reconcile-data
- Microsoft Learn — Custom reconciliation agents: https://learn.microsoft.com/en-us/copilot/finance/reconcile/custom-reconciliation-agent
- AWS Security Blog — Preparing for agentic AI: https://aws.amazon.com/blogs/security/preparing-for-agentic-ai-a-financial-services-approach/
- SAP Business AI for ERP & Finance: https://www.sap.com/products/financial-management/ai.html
- Oracle AI Apps for ERP and EPM: https://www.oracle.com/erp/ai-financials/
- SAP Sapphire 2026 Autonomous Enterprise: https://news.sap.com/2026/05/sap-sapphire-sap-unveils-autonomous-enterprise/
- OneStream SensibleAI Agents GA: https://www.onestream.com/blog/sensibleai-agents-are-now-generally-available/
- Prophix One Agents 2026: https://www.prnewswire.com/news-releases/prophix-launches-next-wave-of-prophix-one-agents-defining-the-delegation-era-for-finance-302749103.html
- POLARIS, 2026, arXiv:2601.11816: https://arxiv.org/abs/2601.11816
- Designing Intelligent Enterprise Agents, 2026, arXiv:2605.08258: https://arxiv.org/abs/2605.08258
- AI Agents in Financial Markets, 2026, arXiv:2603.13942: https://arxiv.org/abs/2603.13942

## Itens não verificados / bloqueados

- Não rodei o harness porque ele ainda não existe como módulo explícito no repo.
- A página da Sage bloqueou fetch automatizado; usei apenas o snippet retornado na busca web, então não a tratei como fonte forte no corpo principal.
- Não validei versões mais novas do pacote no npm além do que consta no `package.json` local e nas docs atuais.
