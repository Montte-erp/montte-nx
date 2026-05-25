# Montte AI — arquitetura consolidada
Compilado em: 2026-05-25
Este arquivo consolida quatro artefatos em um único documento canônico, sem descartar conteúdo dos originais.
## Documentos de origem
1. `outputs/skill-first-ai-native-architecture.md` — Arquitetura skill-first e AI-native para Montte AI (87380 bytes)
2. `outputs/tanstack-ai-finance-agent-strategy.md` — Estratégia TanStack AI e agente financeiro (19603 bytes)
3. `outputs/skill-first-ai-native-architecture.provenance.md` — Proveniência — arquitetura skill-first (15491 bytes)
4. `outputs/tanstack-ai-finance-agent-strategy.provenance.md` — Proveniência — estratégia TanStack AI financeira (1981 bytes)

## Índice
1. [Arquitetura skill-first e AI-native para Montte AI](#arquitetura-skill-first-e-ai-native-para-montte-ai)
2. [Estratégia TanStack AI e agente financeiro](#estrategia-tanstack-ai-e-agente-financeiro)
3. [Proveniência — arquitetura skill-first](#proveniencia-arquitetura-skill-first)
4. [Proveniência — estratégia TanStack AI financeira](#proveniencia-estrategia-tanstack-ai-financeira)

---

## Arquitetura skill-first e AI-native para Montte AI

Origem: `outputs/skill-first-ai-native-architecture.md`

## Deep research — arquitetura skill-first e AI-native para Montte AI

Data: 2026-05-25  
Objetivo: desenhar uma arquitetura **AI-native**, mas **single-agent + skill-first**, para o Montte: um agente principal na UX, capacidades evoluindo por skills, subagents apenas como implementação interna quando necessário.

### Tese

A arquitetura recomendada é:

> **Um agente principal, muitas skills governadas, workflows determinísticos para side effects e subagents apenas dentro de uma skill.**

Para o Montte, “AI-native” não deve significar “tudo é agente” nem “vários agentes com identidades próprias”. Deve significar que UI, API, workflows e agente compartilham as mesmas ações, permissões, dados e evidências. O usuário vê o **Montte AI**; a plataforma evolui por `skills`.

```text
Montte AI principal
  runtime TanStack AI
  thread/memória/telemetria únicos
  bootstrap discovery tools
  agent-driven skill activation
  lazy tool loading
  skill contracts
  skill-scoped tool policy
  approval gates
  eval harness + Evalite
  durable workflows para efeitos colaterais

Skills
  skill.finance
  skill.relationships
  skill.automation
  skill.inbox opcional

References/subcapacidades
  transações, contas, cartões, relatórios, categorias, tags
  clientes, fornecedores
  workflows, classificação, conciliação, cobranças, previsões

Subagents opcionais
  internos a uma skill
  sem identidade de produto
  sem thread própria na UX
  orçamento e tools herdados da skill ativa
```

### O que a literatura e docs sugerem

#### 1. Skills são uma camada procedural, não apenas prompts

A literatura recente define skills como artefatos reutilizáveis de conhecimento procedural: elas dizem **quando usar**, **como executar**, **quais constraints importam**, **como julgar conclusão** e **como evoluir**. O survey **A Comprehensive Survey on Agent Skills** (2026, arXiv:2605.07358) modela uma skill como `S = (M, R, C)`:

- `M`: documento principal de instruções;
- `R`: recursos auxiliares, scripts, templates, exemplos;
- `C`: condições de aplicabilidade.

O mesmo survey organiza o ciclo de vida em representação, aquisição, recuperação/seleção e evolução. Isso é diretamente útil para Montte: `modules/agents/src/skills.ts` hoje só contém metadata simples (`id`, `name`, `description`, `promptName`). O próximo salto é tratar skill como contrato operacional versionado.

#### 2. Progressive disclosure é essencial

Docs de Anthropic/Microsoft Agent Skills convergem em um padrão:

1. carregar só metadata de skills no prompt raiz;
2. carregar o corpo da skill quando relevante;
3. ler recursos específicos sob demanda;
4. executar scripts/rotinas determinísticas só quando necessário.

Isso reduz custo de contexto e evita que o agente veja capacidades demais. Para Montte, isso vira:

- prompt raiz lista catálogo de skills;
- skill ativa carrega contrato curto;
- referências longas ficam em arquivos/recursos ou PostHog Prompts separados;
- ferramentas disponíveis são filtradas pela skill ativa.

#### 3. Skills empresariais precisam ser contratuais

**Contractual Skills: A GovernSpec Design Framework for Enterprise AI Agents** (2026, arXiv:2605.22634) argumenta que skills empresariais precisam expressar mais do que instrução: inputs, permissões, pontos de aprovação humana, evidência, output contract, quality bar, verificação e handoff.

A conclusão prática: a skill do Montte não deve ser apenas “prompt financeiro”. Deve ser um contrato verificável.

#### 4. Mais skills nem sempre melhora

**GraSP: Graph-Structured Skill Compositions for LLM Agents** (2026, arXiv:2604.17870) relata que listas grandes de skills podem degradar performance; conjuntos focados de 2–3 skills tendem a funcionar melhor que documentação ampla. O gargalo vira orquestração, não disponibilidade de skills.

Para Montte: não injetar todas as skills/tools em todas as conversas. A skill ativa deve reduzir o espaço de ação. Se uma tarefa precisar compor skills, usar um plano explícito ou workflow, não despejar tudo no contexto.

#### 5. Least privilege deve acontecer antes do tool call

**Beyond Static Sandboxing: Learned Capability Governance for Autonomous AI Agents** (2026, arXiv:2604.11839) formaliza “capability overprovisioning”: agentes recebem tools demais para a tarefa. A ideia forte é: o agente não deve nem saber que uma tool perigosa existe se a task/skill não precisa dela.

Para Montte: `toolPolicyMiddleware` deve filtrar tools por skill, usuário, team/org, risco e estado da aprovação. Guardrail depois do tool call é necessário, mas insuficiente.

#### 6. Subagents precisam herdar orçamento e contrato

**Agent Contracts** (2026, arXiv:2601.08815) propõe contratos com inputs/outputs, recursos, tempo e critérios de sucesso; em delegação, budgets precisam respeitar limites do contrato pai.

Para Montte: subagents internos a uma skill só podem existir se receberem orçamento, escopo, tools e critérios herdados. Exemplo: `skill.conciliacao` pode usar um matcher interno, mas ele não ganha ferramentas de cobrança nem autorização de escrita.

#### 7. AI-native ERP precisa unir agentes com processos e sistema de registro

A arquitetura SAP AI-native North Star descreve uma mudança de processos rígidos para orquestração agentic, mas ainda dentro de políticas, dados e semântica de negócio. O paper **FinRobot: Generative Business Process AI Agents for Enterprise Resource** (2025, arXiv:2506.01423) propõe ERP AI-native com camadas de data modeling, business modeling, LLM integration, Chain-of-Actions e deployment. A promessa é dinamismo, mas os casos financeiros exigem auditabilidade e integração com sistemas existentes.

Para Montte: AI-native significa que o agente opera sobre o mesmo sistema de registro que a UI, não sobre uma cópia solta; e side effects devem passar por procedures/workflows do domínio.

#### 8. Lazy tool discovery é melhor que schema dump

A documentação atual do **TanStack AI Lazy Tool Discovery** descreve exatamente o problema que o Montte vai ter quando sair de 3–5 tools financeiras para dezenas de capabilities: enviar todos os schemas em todo turno custa tokens e piora escolha de tools. O mecanismo recomendado é marcar tools como `lazy` e expor ao modelo apenas uma ferramenta sintética de descoberta/carregamento; o modelo descobre a tool e carrega o schema completo sob demanda.

O paper **Tool Attention Is All You Need** (2026, arXiv:2604.21816) reforça a mesma tese: schemas demais viram “Tools Tax”, poluem contexto, aumentam custo e ampliam superfície de tool poisoning. A recomendação prática é dois estágios: resumos curtos sempre disponíveis e schemas completos carregados apenas para tools relevantes, com rejeição determinística de tool calls não promovidas.

Para Montte: **não fazer eager load de todas as tools da skill**. Fazer bootstrap com poucas tools seguras: descobrir skills, carregar contrato de skill, descobrir tools da skill, carregar schema da tool e pedir approval.

#### 9. Contexto do front-end é parte da experiência AI-native

PostHog Max/PostHog AI usa uma arquitetura single-loop com “modes” dinâmicos e contexto vindo da UI. A documentação pública e PRs descrevem: contexto automático da página ativa, contexto manual via `@ Add context`, insights/dashboards/events/actions/notebooks anexáveis e mecanismos de tools montadas no front-end para controlar UI ou executar ações de produto.

Para Montte, isso sugere que o front-end deve poder injetar **hints estruturados** no run do agente:

- rota e título da página;
- entidade ativa (`customerId`, `accountId`, `transactionId`, `invoiceId`);
- filtros atuais de tabela/dashboard;
- seleção do usuário;
- período visível;
- colunas/ordenação;
- modo da tela (`view`, `edit`, `reconciliation`, `billing`);
- capabilities de UI disponíveis (`openSheet`, `applyTableFilter`, `showApprovalPreview`).

Mas esse contexto deve ser tratado como **hint não-autoritativo**. Ele ajuda a descobrir skill e preencher argumentos; ele nunca concede permissão, nunca substitui validação server-side e nunca deve carregar segredos.

#### 10. Agentes de produção precisam separar resposta síncrona, job e workflow durável

Fontes sobre DBOS, pg-boss e arquiteturas de agentes duráveis convergem em uma separação importante:

- **Resposta síncrona:** consulta curta, leitura, explicação ou preparação de preview. Deve caber no loop do `chat()` e responder ao usuário imediatamente.
- **Background task / pg-boss job:** trabalho assíncrono operacional, geralmente idempotente, com retry/backoff/DLQ, fan-out ou processamento em lote. Ex.: gerar relatório pesado, reprocessar importação, enviar notificações pendentes, recalcular sugestões.
- **DBOS workflow:** processo de negócio durável, multi-step, com checkpoints, replay/resume, esperas, aprovação humana e side effects importantes. Ex.: conciliação aprovada, régua de cobrança, fechamento mensal assistido, fluxo de estorno/compensação.

DBOS TypeScript descreve workflows como funções compostas por steps checkpointados; se o processo reinicia, o workflow retoma do último step concluído. pg-boss, por sua vez, é uma fila em Postgres para processamento assíncrono confiável com retries, scheduling e workers. Para Montte, a diferença semântica é:

```text
pg-boss = fila de trabalho operacional
DBOS    = orquestração durável de processo de negócio
oRPC    = contrato/procedure/transporte
TanStack AI = loop conversacional + tool calls
```

O agente pode iniciar ambos, mas não deve “virar” o executor de longo prazo. Ele cria uma proposta, recebe aprovação quando necessário, chama uma tool que agenda job/workflow, e depois consulta status/resultado por tools específicas.

#### 11. Skills devem seguir os domínios do produto, não features soltas

A imagem e o código atual de navegação (`apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-nav-items.ts`) mostram que os agrupadores de rotas são a melhor fonte inicial de domínios do Montte:

```text
main
  Inbox

Finanças
  Lançamentos
  Contas Bancárias
  Cartões de Crédito
  Relatórios
  Categorias
  Centros de Custo

Relacionamentos
  Clientes
  Fornecedores

Automação
  Automações
```

Logo, o catálogo de skills deve ser **por domínio/route group**, com subcapacidades internas por rota/feature. Não criar `skill.transactions`, `skill.categories`, `skill.suppliers` como skills de produto separadas. Criar skills dominiais:

- `skill.finance` / label `Finanças`;
- `skill.relationships` / label `Relacionamentos`;
- `skill.automation` / label `Automação`;
- `skill.inbox` se Inbox virar domínio operacional próprio; caso contrário, fica como surface/contexto.

Cada skill dominial pode ter references, como as skills do repo (`.agents/skills/*/references`). Exemplo: `skill.finance` referencia documentos menores para lançamentos, contas bancárias, cartões, relatórios, categorias e centros de custo. O agente carrega só a reference necessária via lazy context, mantendo progressive disclosure.

#### 12. PostHog Prompts e PostHog Evals entram no runtime de produção

PostHog Prompt Management permite criar/atualizar prompts no PostHog, buscá-los em runtime com caching/fallback e vincular uso de prompt a generations. PostHog LLM Analytics captura generations/traces com custo, latência, tokens, modelo, sessão e metadata. PostHog Evaluations suporta avaliações em produção, incluindo LLM-as-judge e avaliações determinísticas em Hog/code-based.

Para Montte, a divisão recomendada é:

```text
Código
  skill manifest, domain contract, tool policy, references allowlist, fallback prompt id

PostHog Prompts
  prompt raiz do agente
  prompt de cada skill dominial
  prompt snippets/references curtas quando fizer sentido
  versões e experimentos de prompt sem deploy

Evalite
  regressão offline/CI com fixtures e oráculos determinísticos

PostHog Evals em produção
  avaliação contínua de generations reais
  LLM-as-judge para clareza/tom/seguimento de política
  Hog/code-based para formato, presença de campos, flags de risco e invariantes simples
```

Regra: PostHog Prompts gerencia texto de prompt em produção, mas **não** gerencia autorização. Permissões, allowlists de tools, approval policy, asyncWork e tenant isolation continuam em código/DB do Montte.

### Radar de tecnologias de IA para Montte

Esta seção responde à pergunta “o que mais existe além de skills/tools e o que faz sentido adicionar?”. A conclusão é que Montte precisa de um stack de IA **por camadas**, não de um grande RAG genérico. RAG entra, mas só como uma das formas de contexto. Em ERP financeiro, o sistema de registro continua sendo Postgres/oRPC/procedures/workflows; IA acessa isso por tools tipadas e auditadas.

#### Mapa geral

| Tecnologia | O que é | Onde faz sentido no Montte | Risco se usar errado | Decisão |
|---|---|---|---|---|
| **Domain tools / function calling** | APIs tipadas que o modelo chama | Principal caminho para dados transacionais e writes | tool sprawl, args inventados, permissão frouxa | **Adicionar/fortalecer agora** |
| **Structured outputs / constrained JSON** | Saída validada por schema | planos, previews, OpenUI props, eval payloads, classificações | schema válido mas semanticamente errado | **Adicionar agora** |
| **RAG documental** | Recuperar docs/textos para grounding | docs do produto, help, políticas, contratos, notas, docs de workflows | citar chunks irrelevantes; prompt injection em docs | **Adicionar seletivamente** |
| **Hybrid retrieval em Postgres** | full-text/BM25/ParadeDB + embeddings dentro do Postgres + fusion/rerank | busca em docs, inbox, fornecedores/clientes, histórico textual | custo/latência; tuning sem eval | **Adicionar como padrão de RAG, sem outro banco** |
| **Reranking** | reordenar candidatos recuperados | perguntas complexas sobre docs/textos | aumenta latência | **Adicionar quando recall inicial for alto** |
| **Agentic RAG** | agente decide buscar, refinar, verificar | investigações/documentos multi-hop; não para números financeiros finais | loop caro e difícil de auditar | **Adicionar só em references de conhecimento** |
| **GraphRAG / entity graph em Postgres** | entidades + relações + retrieval usando tabelas/edges em Postgres, não graph DB separado | mapa de cliente/fornecedor/documento/categoria/workflow; análise multi-hop | grafo stale vira fonte falsa | **Explorar depois do RAG híbrido; Postgres-only** |
| **Text-to-SQL / NL2SQL** | modelo escreve SQL | exploração interna/admin e analytics read-only | vazamento tenant, query cara, números errados | **Não usar direto no produto; preferir tools/procedures** |
| **Semantic layer / metrics layer** | métricas nomeadas com definição única | MRR, DRE, fluxo de caixa, inadimplência, categorias | duas definições do mesmo indicador | **Adicionar antes de dashboards AI avançados** |
| **Long-term memory** | preferências, episódios, fatos lembrados | preferências do usuário, padrões recorrentes, última configuração de relatório | memória envenenada ou privacidade | **Adicionar com allowlist e TTL** |
| **Episodic memory / traces** | memória de runs passados | aprender prompts ruins, falhas, aprovações, eval datasets | repetir erro passado como verdade | **Adicionar como fonte para eval/suporte, não prompt default** |
| **Procedural memory / skill distillation** | extrair procedimentos de runs bem-sucedidos | evoluir references/skills após revisão humana | auto-evolução perigosa | **Adicionar via PR/revisão, não automático** |
| **Model routing/cascades** | escolher modelo por tarefa/risco/custo | cheap model para classificação; strong model para plano complexo | inconsistência e eval por modelo insuficiente | **Adicionar após harness estabilizar** |
| **Prompt caching/context caching** | reduzir custo/latência de prompts longos | prompt raiz, skill contracts, references estáveis | cache de policy velha | **Adicionar com promptVersion/policyVersion** |
| **Fine-tuning / adapters** | treinar modelo em estilo/tarefa | classificação de categoria, extração fiscal, OCR pós-processado | resolve problema errado; difícil auditar | **Não é primeira alavanca** |
| **Embeddings custom/fine-tuned** | melhorar retrieval sem mexer no LLM | documentos Montte, descrições financeiras, fornecedores | drift sem eval | **Depois de baseline híbrido + eval** |
| **Multimodal/OCR** | ler PDFs/imagens/boletos/notas | inbox financeiro, anexos, comprovantes | extração errada vira lançamento errado | **Adicionar com preview/validação humana** |
| **Voice** | entrada/saída por voz | mobile/quick capture no futuro | ambiguidade em dinheiro | **Não agora** |
| **Computer/browser use** | agente controla UI externa | tarefas fora do Montte | alto risco, frágil | **Evitar para core financeiro** |
| **MCP** | protocolo para expor tools/resources/prompts | integração interna/dev e parceiros controlados | servidor MCP vira bypass de permissão | **Não expor no produto agora; estudar adapter interno** |
| **A2A/multi-agent protocols** | comunicação entre agentes | integrações futuras com ecossistema | conflita com “um Montte AI” | **Não expor na UX** |
| **Guardrails/policy engine** | validação antes/depois do modelo/tool | aprovação, bloqueio, mascaramento, tenant scope | sensação falsa de segurança | **Adicionar como código determinístico** |
| **LLM judges** | avaliar qualidade/tom/policy | helpfulness, groundedness, UX, prompt regressions | não julgar dinheiro/números | **Usar com limites** |
| **Synthetic data** | gerar casos de teste/eval | cobrir intents, edge cases, prompt injection | dataset artificial demais | **Adicionar com golden set real** |
| **Human feedback/RLHF-like loop** | feedback do usuário vira melhoria | thumbs, reasons, bad generations para evals | “aprender” ação perigosa | **Capturar agora; treinar depois** |

#### O que muda no desenho: adicionar uma camada de conhecimento

O relatório já separa skills, tools, OpenUI, async work, evals e harness. Falta explicitar uma **Knowledge & Retrieval Layer** governada:

```text
Knowledge & Retrieval Layer
  sources
    product docs
    skill references
    workflow docs
    help center / onboarding
    anexos e documentos textuais do cliente
    inbox items textualizados
    audit receipts e traces selecionados

  storage/indexes — Postgres-only
    tabelas canônicas do Montte
    Postgres full-text search / ParadeDB BM25
    embeddings em Postgres, se necessário, via pgvector/ParadeDB compatível
    entity graph opcional como tabelas de nós/arestas em Postgres
    metadata filters: tenant, team, skill, docType, visibility, freshness

  retrieval pipeline
    classify question type
    choose domain source(s)
    hybrid retrieve: lexical + vector dentro do Postgres
    metadata/permission filter before model
    rerank when needed
    assemble citations/provenance
    answer or call domain tools

  evaluation
    retrieval recall/precision
    context relevance
    groundedness/faithfulness
    citation coverage
    tenant/resource boundary
    latency/cost budget
```

Essa camada deve ser chamada por tools (`search_knowledge`, `open_reference`, `retrieve_inbox_context`) e não por acesso livre do modelo ao banco.

#### Padrão RAG recomendado

Não usar “vector search e pronto” e não adicionar outro banco de dados para retrieval. Para Montte, o baseline correto é **Postgres-only**:

```text
query understanding
  -> fonte/domínio/tenant/docType
  -> lexical retrieval em Postgres: BM25/full-text para ids, nomes, códigos, termos exatos
  -> dense retrieval em Postgres: embeddings para paráfrase/semântica, se necessário
  -> fusion: RRF ou score normalizado
  -> rerank top-N quando resposta exigir precisão
  -> context pack com citações, data freshness e resource ids
  -> geração com obrigação de citar sources
  -> eval: context relevance, context recall, faithfulness, answer relevance
```

Por que isso importa: consultas empresariais têm muitos termos raros e exatos — CNPJ, número de nota, fornecedor, tag, categoria, workflow, código de erro. Dense-only retrieval costuma falhar justamente nesses casos.

#### Onde RAG é adequado vs inadequado

**Adequado:**

- documentação do Montte;
- ajuda contextual dentro da tela;
- regras operacionais escritas;
- políticas internas do tenant;
- contratos, notas, anexos e comprovantes como contexto textual;
- histórico narrativo de workflows/jobs;
- explicações de como usar features.

**Inadequado como fonte final:**

- saldo de conta;
- total de receitas/despesas;
- fluxo de caixa;
- status de pagamento;
- listas transacionais completas;
- qualquer número financeiro que precisa bater com o banco.

Para esses casos, o RAG pode explicar a regra, mas o número vem de query/procedure determinística.

#### Agentic RAG: quando usar

Agentic RAG faz sentido quando a pergunta exige múltiplas buscas/refinamentos:

- “explique por que este workflow classificou esses lançamentos assim”;
- “compare a política de categorias com os últimos casos reprovados”;
- “ache documentos que justificam esta exceção”;
- “monte uma investigação textual com fontes”.

Não faz sentido para: “quanto entrou este mês?”, “quais transações estão pendentes?”, “crie pagamento”. Isso é tool/procedure/workflow.

#### GraphRAG e entity graph Postgres-only

GraphRAG é promissor para ERP porque muitas perguntas são relacionais: fornecedor → notas → transações → categorias → workflows → aprovações. Mas, no Montte, isso **não** deve significar Neo4j, Qdrant, Weaviate, Pinecone ou qualquer outro banco. Se entrar, entra como **entity graph em Postgres**: tabelas relacionais normais para nós/arestas, views/materialized views e indexes. Só deve entrar quando houver um modelo de entidades estável. Primeiro passo recomendado:

```text
EntityGraph mínimo
  Customer
  Supplier
  BankAccount
  CreditCard
  Transaction
  Category
  Tag
  Workflow
  Approval
  Document
  InboxItem

Edges
  paid_to / received_from
  categorized_as
  tagged_with
  attached_to
  generated_by_workflow
  approved_by
  reconciled_with
```

Uso inicial: retrieval e explicabilidade, não automação autônoma. O grafo ajuda o agente a navegar relações e montar evidência; writes continuam em procedures/workflows. A implementação fica em Postgres, reutilizando tenant isolation, migrations, backups, observabilidade e governança já existentes.

#### Memory: separar preferência, fato e evidência

Montte deve evitar “memória vetorial geral” como verdade. Recomendo quatro buckets:

```text
UserPreferenceMemory
  idioma, formato de relatório, período padrão, granularidade preferida
  TTL/revisão: médio
  entra no prompt: sim, se allowlisted

WorkspaceSemanticMemory
  glossário, convenções, nomes internos, regras do tenant
  fonte: docs/policies aprovadas
  entra via retrieval com citação

EpisodicRunMemory
  runs, tool calls, erros, feedback, approvals
  fonte: traces/audit
  uso: eval, suporte, melhoria de skill
  entra no prompt: só quando relevante e resumido

ProceduralSkillMemory
  melhorias de procedimento extraídas de runs
  fonte: distillation + revisão humana
  uso: atualizar skill/reference por PR/admin
```

Nunca misturar memória do usuário com fatos financeiros do livro-caixa. Fatos financeiros vivem no banco e são consultados por procedures.

#### Model gateway e model routing

Hoje dá para manter um modelo principal. A camada que faz sentido adicionar é um **model gateway** interno, não “vários agentes”:

```text
ModelGateway
  taskType: chat | classify | extract | plan | judge | codeMode
  riskTier: read | proposal | write | workflow | financial
  contextSize
  latencyBudget
  costBudget
  requiredFeatures: tool_use, structured_output, vision, long_context
  chosenModel
  fallbackModel
  promptVersion
```

Isso permite cascatas: modelo barato para intent/classificação; modelo forte para plano financeiro; judge separado para eval subjetivo; visão/OCR quando houver documento. Mas só depois de golden evals por tarefa, senão routing vira fonte de regressão invisível.

#### Fine-tuning: quando considerar

Fine-tuning não deve ser usado para “ensinar dados do cliente”. Isso é RAG/tools. Casos possíveis depois:

- classificador de categoria/centro de custo;
- extração de campos de notas/boletos/comprovantes;
- normalização de fornecedor/descrição;
- estilo/copy de pt-BR do Montte, se prompt não bastar;
- reranker/embedding custom para docs do domínio.

Critério: só treinar quando houver dataset versionado, split de teste, métrica objetiva e baseline prompt/tool/RAG já medido.

#### Protocolos: MCP, OpenAPI, AG-UI, A2A

- **AG-UI**: continuar como transporte/eventos do agente para front.
- **OpenUI**: UI generativa allowlisted dentro das mensagens.
- **oRPC**: contrato de produto e transporte server-client do Montte.
- **MCP**: bom padrão para conectar tools/resources/prompts a agentes, mas no Montte deve começar como adapter interno/dev, não endpoint amplo para tenants. Toda chamada MCP precisaria passar por tenant auth, tool policy, approval e audit.
- **OpenAPI/function calling**: útil para descrever tools externas, mas schemas públicos não substituem policy server-side.
- **A2A/multi-agent protocols**: estudar para integrações futuras, mas não expor “vários agentes” ao usuário.

#### Segurança e evals novos exigidos por essas tecnologias

Adicionar ao harness:

- `retrieval_source_policy`: só fontes permitidas pela skill/tenant.
- `retrieval_injection_resistance`: chunks com instruções maliciosas não podem controlar tool calls.
- `citation_required`: respostas baseadas em RAG citam chunk/documento.
- `financial_number_source`: números financeiros vêm de tool/procedure, não de chunk.
- `memory_write_policy`: só grava memórias allowlisted, com usuário/tenant e TTL.
- `memory_poisoning_eval`: instruções em documentos não viram preferência/procedimento.
- `model_routing_regression`: cada taskType passa em golden evals por modelo.
- `mcp_tool_boundary`: adapter MCP não expõe tool fora de allowlist.

#### Roadmap tecnológico recomendado

1. **Agora:** structured outputs, tool contracts, OpenUI props schemas, trajectory audit.
2. **Agora:** Knowledge & Retrieval Layer mínima para docs/references/help com full-text/BM25 + embeddings + citations.
3. **Agora:** evals de RAG: context relevance, context recall, faithfulness, answer relevance, citation coverage.
4. **Depois:** hybrid retrieval sobre inbox/anexos textualizados, com OCR preview.
5. **Depois:** memory allowlisted para preferências e traces resumidos.
6. **Depois:** model gateway/routing com golden evals.
7. **Depois:** GraphRAG/entity graph Postgres-only para explicabilidade e multi-hop.
8. **Só com dataset:** fine-tuning/classificadores/rerankers custom.
9. **Evitar por enquanto:** NL2SQL direto no produto, browser/computer use, multi-agent UX, MCP externo amplo, auto-evolving skills sem revisão.

### Definição prática para Montte

#### AI-native, no contexto do Montte

Montte é AI-native quando:

1. **Ações são compartilhadas:** UI e agente chamam os mesmos routers/use cases/workflows.
2. **Permissões são compartilhadas:** agente não tem canal privilegiado; usa `organizationId`, `teamId`, `userId`, RBAC e ownership existentes.
3. **Dados têm semântica de produto:** lançamentos, contas, categorias, Centro de Custo, cobrança, cliente e assinatura são primitivas do domínio, não blobs para RAG genérico.
4. **Skills são capacidades versionadas:** cada skill declara escopo, tools, outputs, evals e aprovação.
5. **Skills não executam código arbitrário:** diferentemente de exemplos Claude/Microsoft com scripts em diretórios, no Montte comportamento executável deve entrar por tools TypeScript tipadas, allowlisted, revisadas e auditáveis; scripts/sandbox só se houver caso inevitável e com isolamento explícito.
6. **Workflows cuidam de side effects:** oRPC define contratos/procedures; DBOS executa workflows duráveis com replay/steps; pg-boss executa jobs operacionais como debounce/retry/DLQ. Não tratar oRPC como runtime durável.
7. **Evals são parte do release:** cada skill tem suite Evalite; prompt/model/tool changes rodam regressão.
8. **Descoberta é tool-driven e lazy:** o agente principal começa com bootstrap tools seguras (`discover_skills`, `load_skill`, `discover_tools`, `load_tool_schema`, `get_frontend_context`) e promove skills/tools conforme necessidade.
9. **Front-end injeta contexto estruturado:** rota, filtros, seleção e entidade ativa entram como hints versionados; o servidor revalida tudo.
10. **Agente pode iniciar trabalho assíncrono:** skills podem declarar background jobs pg-boss e workflows DBOS permitidos, com preview, aprovação, status, cancelamento e audit trail.
11. **Skills são por domínio do produto:** os labels dos agrupadores de rotas (`Finanças`, `Relacionamentos`, `Automação`, e possivelmente `Inbox`) definem o primeiro catálogo de skills; rotas internas viram references/subcapacidades.
12. **PostHog é o control plane de prompt/observabilidade em produção:** prompts dominiais vivem no PostHog Prompts; generations/traces/evals de produção vivem no PostHog LLM Analytics/Evaluations.
13. **A experiência é uma só:** usuário não escolhe “agente de cobrança” vs “agente financeiro”; conversa com Montte AI e a skill ativa muda conforme contexto/intenção.

### Modelo de skill contract

Adicionar uma definição rica em `modules/agents/src/skills.ts` ou `modules/agents/src/skills/catalog.ts`:

```typescript
interface AgentSkillContract {
   id: string;
   domainId: "finance" | "relationships" | "automation" | "inbox";
   routeGroupId: string;
   label: "Finanças" | "Relacionamentos" | "Automação" | "Inbox";
   routes: string[];
   name: string;
   description: string;
   promptName: string; // PostHog prompt key/name
   promptFallbackPath: string; // local fallback for outages/review
   references: Array<{
      id: string;
      title: string;
      source: "repo" | "posthog_prompt" | "docs";
      pathOrPromptName: string;
      whenToLoad: string;
   }>;
   version: string;
   status: "draft" | "beta" | "stable";

   whenToUse: string[];
   whenNotToUse: string[];
   discovery: {
      summary: string; // <= 60-100 tokens, always safe to expose
      examples: string[];
      activationTool: string;
      lazyTools: boolean;
   };

   frontendContext: {
      acceptedHints: string[];
      requiredServerValidation: boolean;
      maxPayloadBytes: number;
   };

   openui: {
      enabled: boolean;
      componentLibrary: string;
      allowedComponents: string[];
      requireProvenanceForNumericComponents: boolean;
   };

   codeMode?: {
      enabled: boolean;
      allowedReferences: string[];
      allowedTools: string[];
      network: "off" | "allowlist";
      filesystem: "none" | "ephemeral";
      maxRuntimeMs: number;
      maxToolCalls: number;
      allowPersistedSnippets: boolean;
   };

   ownerModule: string;
   allowedTools: string[];
   forbiddenTools: string[];
   toolRiskTiers: Record<string, "read" | "proposal" | "write" | "external" | "bulk" | "ui_control" | "background_job" | "durable_workflow">;
   readScopes: string[];
   writeScopes: string[];

   asyncWork?: {
      allowedPgBossJobs: string[];
      allowedDbosWorkflows: string[];
      maxQueuedJobsPerRun: number;
      maxOpenWorkflowsPerRun: number;
      statusTools: string[];
      cancelTools: string[];
      defaultProgressVisibility: "silent" | "inline" | "notification" | "activity_center";
   };

   approvalPolicy: {
      requiredForTools: string[];
      requiredForRisk: Array<"financial_write" | "external_message" | "bulk_action" | "sensitive_ui_control" | "background_job" | "durable_workflow">;
      previewRequired: boolean;
   };

   evidencePolicy: {
      numbersMustComeFromTools: boolean;
      citeToolResultIds: boolean;
      requirePeriodAndFilters: boolean;
      unsupportedClaimBehavior: "ask_clarification" | "state_limitation";
   };

   outputContract: {
      format: "text" | "structured" | "openui";
      maxNarrativeSentencesAfterTool?: number;
      requiredFields?: string[];
   };

   evals: {
      smoke: string;
      regression: string;
      thresholds: Record<string, number>;
      posthog: {
         evaluationSuiteIds: string[];
         productionSamplingRate: number;
         llmJudgeEvalIds: string[];
         hogEvalIds: string[];
      };
   };

   audit: {
      eventPrefix: string;
      includePromptVersion: boolean;
      includeToolVersions: boolean;
      posthogTraceProperties: string[];
   };

   rollbackPolicy?: {
      supported: boolean;
      compensationWorkflow?: string;
   };

   budgets: {
      maxIterations: number;
      maxToolCalls: number;
      maxRuntimeMs: number;
      maxSubagents?: number;
   };
}
```

#### Catálogo inicial por domínio

Baseado nos route groups observados no repo:

```typescript
const domainSkills = [
   {
      id: "finance",
      label: "Finanças",
      routeGroupId: "finance",
      routes: [
         "/$slug/$teamSlug/transactions",
         "/$slug/$teamSlug/bank-accounts",
         "/$slug/$teamSlug/credit-cards",
         "/$slug/$teamSlug/reports",
         "/$slug/$teamSlug/categories",
         "/$slug/$teamSlug/tags",
      ],
      references: [
         "references/transactions.md",
         "references/bank-accounts.md",
         "references/credit-cards.md",
         "references/reports.md",
         "references/categories.md",
         "references/tags.md",
      ],
   },
   {
      id: "relationships",
      label: "Relacionamentos",
      routeGroupId: "relationships",
      routes: ["/$slug/$teamSlug/customers", "/$slug/$teamSlug/suppliers"],
      references: ["references/customers.md", "references/suppliers.md"],
   },
   {
      id: "automation",
      label: "Automação",
      routeGroupId: "automation",
      routes: ["/$slug/$teamSlug/workflows"],
      references: ["references/workflows.md", "references/dbos.md", "references/pg-boss.md"],
   },
];
```

#### Exemplo: `skill.finance`

```text
Skill: finance / Finanças
Status: stable-readonly
Objetivo: responder perguntas financeiras operacionais.
Pode: consultar lançamentos, saldos, contas, cartões, categorias, Centros de Custo e relatórios.
Não pode: alterar dados, enviar cobranças, criar lançamentos, conciliar automaticamente.
Evidência: todo número deve vir de tool result; resposta deve declarar período e filtros.
Output: resumo curto + UI estruturada quando houver tabela/card.
Evals: numeric_grounding >= 0.98; tool_call_accuracy >= 0.9; unsupported_claim_rate <= 0.02.
```

#### Exemplo: `skill.conciliacao`

```text
Subcapacidade: conciliação dentro de skill.finance
Status: beta
Objetivo: propor matches entre extrato/importação e lançamentos existentes.
Pode: ler lançamentos, contas, importações e regras de tolerância.
Não pode: marcar como conciliado sem aprovação explícita.
Subagents permitidos: matcher, verifier.
Approval: obrigatório para qualquer escrita ou bulk action.
Output: lista de candidatos com evidência, confidence, diferença de valor/data e ação sugerida.
Workflow: preview -> aprovação -> procedure de domínio -> audit log.
```

### Arquitetura proposta

```text
User/UI/Page Context
   ↓
Bootstrap Tool Layer
   - discover_skills
   - load_skill
   - get_frontend_context
   - discover_tools
   - load_tool_schema
   ↓
Agent-driven Skill Discovery
   - modelo escolhe skill via tool call auditável
   - pageContext/front-end são hints, não autoridade
   - pode perguntar se ambíguo
   ↓
Lazy Skill/Tool Loader
   - carrega contrato + prompt da skill sob demanda
   - promove apenas tools relevantes
   - carrega schema completo só quando necessário
   ↓
Capability Governor
   - valida skill/tool/user/team/org/risco antes de expor ou executar
   - define budgets e approval policy
   ↓
TanStack AI Runtime
   - chat(), maxIterations, modelOptions, threadId/runId
   - lazy tools / discovery tools
   - middleware: audit, budget, grounding, tool policy, telemetry
   ↓
Domain Tools
   - wrappers finos sobre oRPC/use cases/workflows
   - Zod input/output
   - outputs com provenance e ui quando aplicável
   ↓
Async Work Layer
   - pg-boss jobs para background tasks operacionais
   - DBOS workflows para processos duráveis multi-step
   - tools de status/cancelamento/resultado
   ↓
Approval / Workflow Layer
   - preview determinístico
   - humano aprova
   - oRPC valida contrato/procedure
   - DBOS executa workflows duráveis
   - pg-boss executa jobs operacionais
   ↓
PostHog Prompt + Observability Control Plane
   - prompts raiz/skill/references em PostHog Prompts
   - generations/traces com promptVersion, skillId, domainId, runId
   - PostHog Evals em produção
   ↓
Audit + Eval + Telemetry
   - OTEL spans
   - thread/run/tool traces
   - Evalite regressions por skill
   - PostHog production evals por domínio/skill
```

### Descoberta de skill via tool

Ajuste recomendado pelo objetivo do produto: em vez de um router determinístico escolher a skill fora do agente, o agente principal deve **descobrir e ativar a skill usando tools de bootstrap**. Isso mantém o single-loop agent mais “AI-native”, parecido com PostHog Max/modos dinâmicos e compatível com lazy tool loading do TanStack AI.

#### Tools sempre disponíveis no bootstrap

```typescript
const bootstrapTools = {
   discover_skills,       // lista skills candidatas por intenção + contexto
   load_skill,            // carrega contrato/prompt/resumo da skill
   get_frontend_context,  // lê hints estruturados enviados pela UI
   discover_tools,        // lista tools disponíveis dentro da skill ativa
   load_tool_schema,      // promove schema completo de uma tool lazy
   request_approval,      // abre fluxo de aprovação quando necessário
   start_background_job, // agenda job pg-boss permitido pela skill
   start_workflow,       // inicia workflow DBOS permitido pela skill
   get_async_status,     // consulta progresso/resultado
   cancel_async_work,    // cancela quando suportado pela política
};
```

Bootstrap tools também têm contrato de risco:

- `discover_skills`, `load_skill`, `get_frontend_context`, `discover_tools`, `load_tool_schema`: `read`, sem side effects;
- `request_approval`: `proposal`, idempotente, só cria/atualiza um pedido pendente e **não pode aprovar a própria proposta**;
- UI tools como `navigate`, `openSheet`, `applyTableFilter`, `highlightRows`: `ui_control`; não escrevem no banco, mas podem influenciar decisão do usuário, então precisam de auditoria e limites.
- `start_background_job`: `background_job`; agenda apenas jobs pg-boss allowlisted pela skill, com payload validado e idempotency key.
- `start_workflow`: `durable_workflow`; inicia apenas workflows DBOS allowlisted pela skill, normalmente depois de preview/aprovação.
- `get_async_status`: `read`; permitido para trabalhos do mesmo `threadId/runId/tenant`.
- `cancel_async_work`: `proposal` ou `write`, dependendo se cancela só job pendente ou compensa workflow já iniciado.

Fluxo recomendado:

1. Runtime injeta catálogo mínimo: nomes, summaries curtos e risk tier das skills permitidas ao usuário.
2. Modelo chama `get_frontend_context` se a tela puder esclarecer intenção/entidade/filtros.
3. Modelo chama `discover_skills({ intent, frontendContextSummary })`.
4. Servidor aplica permissões, tenant, plano, feature flags e risk policy; retorna top-k skills candidatas, não todas.
5. Modelo chama `load_skill(skillId)` para ativar uma skill.
6. Runtime carrega prompt/contrato da skill e disponibiliza `discover_tools` para aquela skill.
7. Modelo chama `discover_tools` e `load_tool_schema` sob demanda.
8. Capability Governor rejeita deterministicamente qualquer tool call não carregada/promovida ou incompatível com aprovação.
9. Para trabalho longo, o modelo não fica bloqueado: chama `start_background_job` ou `start_workflow`, recebe `asyncWorkId`, mostra status inicial e depois usa `get_async_status`/notificações.

Regra importante: o modelo pode escolher a skill **dentro de um envelope governado**. Ele não ganha acesso a tools de negócio antes de `load_skill`, e não executa tool cujo schema não foi promovido e validado.

#### Estratégia de implementação no TanStack AI

Decisão: **usar a Estratégia A como arquitetura correta do Montte**. A Estratégia B fica apenas como fallback documentado para um caso futuro em que o runtime não consiga atender lazy discovery/prompts via uma única chamada, mas não deve guiar a implementação inicial.

**A. Uma chamada `chat()` com Lazy Tool Discovery nativo — decisão escolhida**

- Registrar upfront apenas bootstrap tools e metadata/resumos de tools lazy.
- Marcar tools de negócio como lazy conforme API do TanStack AI.
- `discover_skills` retorna skills dominiais permitidas (`finance`, `relationships`, `automation`, `inbox`) com base em route group/contexto/intenção.
- `load_skill` não muta magicamente o runtime; retorna artefato estruturado (`activatedSkill`, `domainId`, `skillContractSummary`, `allowedToolNames`, `allowedReferences`, `posthogPromptName`, `policySnapshot`).
- O prompt raiz instrui: após `load_skill`, só usar tools cujo nome esteja em `allowedToolNames`.
- `load_tool_schema`/lazy discovery promove o schema completo conforme suporte nativo do TanStack AI.
- Middleware `unpromotedToolRejection` rejeita deterministicamente qualquer call fora de `allowedToolNames`, fora de permissão ou sem aprovação.

**B. Duas chamadas `chat()` — não recomendada para o Montte agora**

Manter apenas como fallback teórico. A implementação inicial não deve quebrar o loop em duas chamadas, porque isso enfraquece o modelo single-loop e aumenta complexidade de estado.

Evitar uma arquitetura imaginária em que `load_skill` altera retroativamente o system prompt já enviado ao modelo. Na Estratégia A, o prompt raiz já ensina o protocolo de discovery; `load_skill` retorna contrato/resumo/policy como tool result, e o modelo continua no mesmo loop.

#### Como `pageContext.skillHint` entra

`pageContext.skillHint` deixa de ser roteador imperativo e vira prior/hint:

- aumenta o score de uma skill candidata;
- permite `discover_skills` retornar essa skill no top-k;
- não bloqueia intenção explícita do usuário;
- não concede permissões.

Se o usuário está em `/financeiro/conciliacao` e pergunta “qual foi meu saldo mês passado?”, o agente pode escolher `financeiro` em vez de `conciliacao`. Se pergunta “conciliar esses 3 itens”, escolhe `conciliacao` e carrega tools proposal/write com approval.

### Front-end context injection

Padrão proposto, inspirado no PostHog Max: o front-end envia um `AgentFrontendContext` junto com a mensagem ou o run. O agente também pode chamar `get_frontend_context` para obter/atualizar esse snapshot.

```typescript
interface AgentFrontendContext {
   version: string;
   route: {
      path: string;
      title?: string;
      skillHint?: string;
   };
   page?: {
      kind: "dashboard" | "table" | "form" | "sheet" | "detail" | "reconciliation";
      mode?: "view" | "edit" | "review";
   };
   entity?: {
      type: "customer" | "account" | "transaction" | "invoice" | "subscription";
      id: string;
      label?: string;
   };
   // Estrutura exata deve ser validada por Zod por rota/skill; unknown keys são rejeitadas.
   filters?: Record<string, string | number | boolean | string[] | null>;
   selection?: Array<{
      type: "customer" | "account" | "transaction" | "invoice" | "subscription";
      id: string;
   }>;
   visibleRange?: { from?: string; to?: string };
   uiCapabilities?: Array<
      | "openSheet"
      | "applyTableFilter"
      | "highlightRows"
      | "showApprovalPreview"
      | "navigate"
   >;
}
```

Política de segurança:

- front-end context é **hint**, não fonte de autoridade;
- IDs, filtros e entidades são revalidados no servidor;
- payload deve ser pequeno, allowlisted e validado por Zod por rota/skill; unknown keys são rejeitadas;
- não enviar valores secretos, tokens, CPF completo, dados bancários completos ou conteúdo invisível ao usuário;
- registrar hash/versão do context no audit log;
- evals devem testar que contexto malicioso não aumenta permissões nem altera tenant.

Uso esperado:

- descobrir skill correta;
- preencher defaults de tool arguments;
- gerar respostas com o mesmo período/filtro que o usuário está vendo;
- controlar UI com tools separadas e approval quando houver side effect.

### Tools por skill

Separar tools por risco:

```text
read tools
  search_transactions
  get_financial_summary
  generate_financial_report
  list_bank_accounts

proposal tools
  suggest_categories
  suggest_reconciliation_matches
  draft_collection_message

write tools
  apply_category_suggestions
  reconcile_transactions
  enqueue_collection_message

async tools
  start_background_job
  start_workflow
  get_async_status
  cancel_async_work
```

Regras:

- read tools podem responder direto;
- proposal tools retornam preview/evidência, não alteram estado;
- write tools exigem approval e devem chamar procedure/workflow do módulo dono;
- comunicação externa exige templates aprovados, consentimento/opt-out, rate limit e auditoria de envio;
- async tools seguem o mesmo risk tier da ação que encapsulam;
- tools de escrita nunca ficam disponíveis para skills readonly.

### Skills dominiais, references e PostHog Prompts

A estrutura correta é parecida com as skills do próprio repo: um documento principal pequeno + references menores carregadas sob demanda. A diferença é que, em produção, o texto dos prompts deve vir do **PostHog Prompts** para permitir analytics, versões e iteração sem deploy.

```text
modules/agents/src/skills/
  catalog.ts                         # contratos, allowlists, route groups
  references/                        # fallback/review/local source of truth
    finance/transactions.md
    finance/bank-accounts.md
    finance/credit-cards.md
    finance/reports.md
    finance/categories.md
    finance/tags.md
    relationships/customers.md
    relationships/suppliers.md
    automation/workflows.md

PostHog Prompts
  montte-ai-root
  montte-ai-skill-finance
  montte-ai-skill-relationships
  montte-ai-skill-automation
  montte-ai-ref-finance-transactions
  ...
```

Princípios:

- Skill = domínio/route group.
- Reference = subcapacidade/rota/tarefa dentro do domínio.
- `discover_skills` escolhe domínio.
- `load_skill` carrega prompt dominial via PostHog Prompt key.
- `load_reference` ou `load_tool_schema` carrega apenas a reference necessária.
- Local markdown é fallback e revisão por PR; PostHog Prompt é runtime source para produção.
- Toda generation deve carregar metadata: `domainId`, `skillId`, `referenceIds`, `posthogPromptName`, `posthogPromptVersion`, `toolNames`, `model`, `threadId`, `runId`, `organizationId`, `teamId`.

### PostHog Evals em produção

Evalite continua sendo o harness de CI/offline. PostHog Evals entra como camada de **observabilidade e regressão em produção**.

Usar dois tipos:

1. **LLM-as-judge** para critérios subjetivos:
   - clareza em pt-BR;
   - resposta segue política da skill;
   - pediu aprovação quando deveria;
   - não prometeu execução inexistente;
   - explicou limitação corretamente.

2. **Hog/code-based evals** para invariantes simples e auditáveis:
   - resposta contém `periodo` quando fala de número financeiro;
   - generation tem `skillId/domainId/promptVersion`;
   - tool call sensível tem `approvalId`;
   - async work tem `idempotencyKey`;
   - output estruturado respeita schema;
   - nenhum CPF/token/raw secret aparece na resposta.

Não usar PostHog LLM-as-judge para validar números financeiros. Para dinheiro, continuar com oráculos determinísticos no harness/tool output.

### Agentic UX/UI e agentic loop para Montte

A pesquisa de UX agentic converge em uma tese: **chat é entrada, não é a interface inteira**. Um agente que executa ações precisa de control surfaces: plano, preview, progresso, aprovação, auditoria, undo/cancelamento e activity center.

#### Loop recomendado

```text
Observe
  user message + frontend context + route group + tenant/user policy

Discover
  discover_skills -> load_skill -> discover_tools -> load_tool_schema

Frame
  clarifica objetivo, escopo, filtros, período, entidades e autonomia

Plan
  gera plano curto quando há múltiplos passos, side effect ou trabalho longo

Preview
  mostra intenção, dados afetados, irreversibilidade, custo/tempo, confidence e rollback

Approve / Adjust
  usuário aprova, edita parâmetros, reduz escopo ou cancela

Act
  read tool síncrona, pg-boss job, DBOS workflow ou UI control tool

Observe progress
  status stream, activity center, notifications e get_async_status

Verify
  checa resultado via tool, evidencia números e registra audit

Recover
  retry, cancel, undo, compensating workflow ou escalonamento humano
```

#### Padrões de UX que viram requisitos de arquitetura

- **Intent Preview:** antes de ação significativa, mostrar o que será feito, quantos registros afeta, se é reversível, quais tools/workflows serão usados e quais parâmetros o usuário pode editar.
- **Autonomy levels:** `suggest`, `approve_then_act`, `auto_for_low_risk`, `supervised_bulk`. O nível fica por skill/tool/risk tier, não só no prompt.
- **Plan surface:** quando a tarefa tem mais de uma etapa, mostrar plano compacto e permitir editar escopo.
- **Progress stream:** para jobs/workflows, mostrar estado persistente; não deixar o usuário perguntando “terminou?”.
- **Activity center:** todo trabalho assíncrono tem card persistente com status, dono, skill, domínio, timestamps, auditoria e ação de cancelar/abrir resultado.
- **Confirmation gates:** approval real é enforcement fora do modelo; não é “instrução para perguntar”.
- **Evidence panel:** para Finanças, separar narrativa de evidências: período, filtros, tool result ids, totais, linhas usadas.
- **Receipts:** após ação, mostrar recibo: o que mudou, por quem, quando, workflow/job id e como desfazer/compensar se suportado.
- **Error recovery:** erro precisa oferecer próxima ação: tentar novamente, reduzir escopo, abrir item, pedir revisão humana ou exportar log.
- **Selective transparency:** mostrar detalhes nos nós de decisão/riscos; não despejar chain-of-thought.

### Chat UI/UX, OpenUI e generative UI

A pesquisa de AI chat UI/UX reforça uma separação importante para Montte:

```text
AG-UI        = transporte/eventos do agente para o cliente
assistant-ui = shell conversacional e runtime React
OpenUI       = camada de UI generativa/estruturada renderizada nas mensagens
Domain tools = fonte de dados/efeitos; podem retornar `ui` estruturado
```

OpenUI não substitui AG-UI. AG-UI continua sendo o protocolo de streaming/lifecycle; OpenUI define como o modelo compõe cards, tabelas, gráficos, forms, approval previews e receipts com componentes allowlisted. A guideline local já diz: componentes/specs ficam em `modules/agents/src/openui`; tools retornam `ui` quando há visualização estruturada; depois de tool com `ui`, o assistant responde em no máximo 1–2 frases e não duplica tabela/contagem em markdown.

#### Component library inicial para Montte AI

```text
EvidenceCard
  período, filtros, fonte/toolResultIds, timestamp

FinancialMetricGrid
  receita, despesa, saldo, variações, badges

TransactionsTable
  linhas resumidas, filtros aplicados, ações permitidas

ReportChart
  série, breakdown por categoria/centro de custo, drilldown

IntentPreview
  plano, registros afetados, risco, reversibilidade, approval requerido

ApprovalPanel
  approve/reject/edit-scope, policy reason, audit preview

AsyncWorkCard
  job/workflow id, status, progresso, cancelar/abrir resultado

ReceiptCard
  ação concluída, ids afetados, workflow/job id, undo/compensação

RelationshipCard
  cliente/fornecedor, documentos mascarados, status, links

AutomationRunTimeline
  steps, logs resumidos, erros, retry/cancel
```

#### Regras para generative UI

- O modelo só pode emitir componentes registrados na OpenUI library.
- Props são Zod-validadas e não podem carregar dados sensíveis fora da política de mascaramento.
- Componentes interativos não executam mutação diretamente; disparam tool/procedure/approval.
- OpenUI é usado para **representar** evidência, plano, preview, progresso e recibo; não para burlar domínio.
- Para financeiro, todo número exibido em OpenUI deve vir de tool result/provenance.
- Para streaming, componentes parciais precisam tolerar estado incompleto sem quebrar layout.
- Renderização deve ser acessível: labels, foco, keyboard navigation, estados de loading/erro.

#### AI chat UI/UX básico que não pode faltar

- O chat deve explicar rapidamente o que o Montte AI consegue fazer no contexto atual.
- Sugestões de prompt devem ser contextuais ao route group/skill ativa.
- A tela deve mostrar qual contexto está sendo usado: rota, filtros, seleção, período.
- Deve haver disclosure surface para fontes/evidências/tool results.
- Usuário deve conseguir editar escopo antes de aprovar ação.
- Feedback thumbs/down ou reason tags deve ser capturado e ligado a PostHog generation/trace.
- Cancelamento precisa ser visível quando run/job/workflow ainda é cancelável.

### Harness engineering, Code Mode e sandbox

A arquitetura correta é “model + harness”. O modelo decide; o harness controla contexto, lazy tools, políticas, aprovações, execução, sandbox, observabilidade, avaliações e recovery. O paper **Auditing Agent Harness Safety** (2026, arXiv:2605.14271) mostra por que avaliar só a resposta final é insuficiente: violações podem ocorrer no meio da trajetória — tool errada, recurso fora do escopo, vazamento entre componentes, ações redundantes.

#### Harness do Montte AI

```text
AgentHarness
  prompt loader: PostHog Prompts + fallback local
  skill discovery: discover_skills/load_skill
  reference loader: allowlisted references
  lazy tool registry: summaries + promoted schemas
  capability governor: tool/user/team/org/risk/approval
  frontend context validator: Zod por rota/skill
  OpenUI library: componentes allowlisted
  async runtime bridge: pg-boss + DBOS
  sandbox/code mode policy
  telemetry: OTEL + PostHog generations/traces
  eval hooks: Evalite + PostHog Evals
  trajectory audit log: tool calls, resources, approvals, async ids
```

#### TanStack AI Code Mode

TanStack AI Code Mode permite que o LLM escreva e execute pequenos programas TypeScript em sandbox, compondo tools com loops, condicionais, `Promise.all` e transformações. Também há UI via AG-UI para mostrar progresso de execução e isolate drivers como Node/isolated-vm, QuickJS/WASM e Cloudflare Workers.

Para Montte, Code Mode é útil, mas deve ser restrito:

**Bom uso:**

- compor várias read tools para análise financeira exploratória;
- transformar/agrupar dados já retornados por tools;
- comparar cenários sem side effects;
- gerar tabelas/series para OpenUI;
- rodar validações locais sobre payload antes de criar preview.

**Não usar Code Mode para:**

- executar writes diretamente;
- acessar DB/rede/segredos;
- chamar providers externos fora de tools allowlisted;
- contornar approval;
- rodar código persistente ou salvar snippets como “skills” de produção sem revisão.

Política recomendada:

```text
Code Mode default: off
Enable por skill/reference: finance reports/read analysis, automation diagnostics
Tools disponíveis dentro do sandbox: apenas read/proposal allowlisted
Network: off por padrão
Filesystem: virtual/ephemeral
Secrets: nenhum
CPU/mem/time: limites curtos
Output: structured result + optional OpenUI, sem side effects
Writes: proibidos; gerar preview/request_approval fora do sandbox
Persisted Code Mode skills: desabilitado inicialmente ou revisão por PR/admin
```

#### Sandbox e isolamento

Para Montte financeiro, sandbox é defesa em profundidade, não licença para executar qualquer coisa. A threat surface de agentes inclui prompt injection indireta, tool poisoning, acesso a recursos fora do escopo, exfiltração de segredos e ações autônomas indevidas.

Requisitos mínimos:

- capability-based API: sandbox só vê funções explicitamente fornecidas;
- deny-by-default para rede, filesystem, env vars e secrets;
- payloads e outputs com Zod;
- limite de tempo, memória e número de chamadas;
- audit de cada chamada externa ao sandbox;
- deterministic rejection se o código tentar tool não allowlisted;
- redaction/masking antes de dados sensíveis entrarem no sandbox;
- sem dados cross-tenant no mesmo contexto;
- evals de prompt injection/tool poisoning e resource boundary.

#### Trajectory audit

Além de PostHog generations, o harness deve registrar trajetória verificável:

```text
runId, threadId, parentRunId
domainId, skillId, referenceIds
promptName, promptVersion, model
frontendContextHash
loadedTools, promotedTools, attemptedTools, rejectedTools
tool args/result provenance ids
resource ids touched
approval ids/status
pg-boss job ids
DBOS workflow ids
OpenUI component names emitted
sandbox/codeMode enabled, limits, execution summary
policy decisions and reasons
```

Esses logs alimentam Evalite, PostHog Evals e auditorias internas.

### Matriz inicial: tools por domínio e tipo de execução

Esta matriz é hipótese arquitetural baseada nos route groups atuais, nas telas existentes e nos módulos observados (`cashbook`, `classification`, `inbox`, `workflows`, `agents`). Ela deve virar backlog/evals, não ser tratada como implementação já existente.

#### `skill.finance` — Finanças

| Reference/rota | Tool/capacidade | Execução | Approval | UX principal | Observações |
|---|---|---:|---:|---|---|
| Lançamentos | buscar/listar/filtrar lançamentos | read síncrono | não | resposta + tabela/link | usar filtros da tela como hint |
| Lançamentos | criar/editar lançamento único | oRPC write síncrono | sim se agente agir | intent preview + receipt | baixo volume, mas altera livro-caixa |
| Lançamentos | bulk categorization preview | proposal síncrono ou pg-boss se muitos itens | não para preview | plan + tabela de sugestões | existe módulo `classification` com workflow de categorização |
| Lançamentos | aplicar categorização em lote | DBOS workflow | sim | approval gate + activity card | idempotente, auditável, compensável se possível |
| Lançamentos | importar/processar extrato/CSV | pg-boss job para parsing; DBOS se envolver escrita multi-step | sim para aplicar | progress stream | separar “analisar arquivo” de “gravar lançamentos” |
| Lançamentos | conciliação/reconciliação | DBOS workflow | sim | preview de matches + approval | processo multi-step com checkpoints |
| Contas Bancárias | listar/saldos | read síncrono | não | cards/tabela | números sempre de tool |
| Contas Bancárias | criar/editar conta | oRPC write síncrono | sim | form/sheet + receipt | server revalida ownership |
| Cartões | listar cartões/faturas | read síncrono | não | cards/tabela | current tools já leem cartões/faturas |
| Cartões | fechar/gerar fatura, mover lançamentos | DBOS workflow | sim | preview + approval + progress | side effects financeiros compostos |
| Relatórios | gerar relatório leve | read síncrono + OpenUI | não | chart/table | se rápido, fica no chat |
| Relatórios | análise exploratória multi-consulta | Code Mode sandbox read-only | não | OpenUI chart/table | compõe read tools sem side effects |
| Relatórios | gerar PDF/CSV pesado/agendado | pg-boss job | talvez, se export sensível | activity center + download | job operacional; não workflow de negócio |
| Categorias | listar/criar/editar categoria | read/write síncrono | sim para write por agente | sheet/receipt | referência dentro de finance |
| Categorias | importar categorias/subcategorias | pg-boss job ou oRPC sync pequeno | sim para bulk | progress + receipt | tests indicam import/export em classification router |
| Centros de Custo | listar/criar/editar tag | read/write síncrono | sim para write por agente | sheet/receipt | referência dentro de finance |
| Centros de Custo | reclassificar muitos lançamentos | DBOS workflow | sim | preview + approval + progress | altera reporting histórico |

#### `skill.relationships` — Relacionamentos

| Reference/rota | Tool/capacidade | Execução | Approval | UX principal | Observações |
|---|---|---:|---:|---|---|
| Clientes | buscar/listar clientes | read síncrono | não | tabela/link | contexto pode vir da rota Clientes |
| Clientes | criar/editar cliente | oRPC write síncrono | sim | sheet + receipt | validar CPF/CNPJ server-side |
| Clientes | importar clientes | pg-boss job | sim para bulk | progress + resultado de erros | job operacional com validação linha a linha |
| Clientes | enriquecer cadastro via CNPJ/externo | pg-boss job | talvez | preview + source receipt | external call/rate limit |
| Fornecedores | buscar/listar fornecedores | read síncrono | não | tabela/link | idem |
| Fornecedores | criar/editar fornecedor | oRPC write síncrono | sim | sheet + receipt | domínio Relacionamentos |
| Fornecedores | importar/normalizar fornecedores | pg-boss job | sim para bulk | progress + error table | não deve bloquear chat |
| Relacionamentos | mesclar duplicados | DBOS workflow | sim | side-by-side preview | risco alto, precisa compensação/audit |
| Relacionamentos | arquivar/excluir em lote | DBOS workflow | sim | approval + activity card | bulk destructive |

#### `skill.automation` — Automação

| Reference/rota | Tool/capacidade | Execução | Approval | UX principal | Observações |
|---|---|---:|---:|---|---|
| Automações | listar workflows/automações | read síncrono | não | tabela/canvas link | agente pode explicar automação |
| Automações | criar rascunho de automação | proposal síncrono | não | canvas draft | usuário revisa antes de ativar |
| Automações | salvar/editar automação | oRPC write síncrono | sim | diff + receipt | altera comportamento futuro |
| Automações | ativar/pausar automação | oRPC write síncrono | sim | confirmation gate | já há UI de ativar/pausar |
| Automações | executar automação agora/test run | DBOS workflow | sim | run log + progress | processo durável com steps |
| Automações | agendar recorrência | DBOS workflow/scheduler | sim | schedule preview | cuidado com loops/custos |
| Automações | diagnosticar falha de execução | read + pg-boss job se análise pesada | não | evidence panel | pode consultar logs/status |

#### `skill.inbox` — Inbox / trabalho operacional

Inbox aparece como grupo `main`, mas há módulo `inbox` agregando itens como pagamentos vencidos e lançamentos sem categoria. Decisão pendente: tratar como skill própria ou surface que roteia para finance/relationships/automation.

| Capacidade | Execução | Approval | UX principal | Observações |
|---|---:|---:|---|---|
| resumir itens pendentes | read síncrono | não | inbox cards | usa agregação determinística |
| resolver item simples | oRPC write síncrono ou DBOS se multi-step | sim | card action + receipt | depende do tipo de item |
| gerar plano de limpeza da inbox | proposal síncrono | não | plan surface | não altera estado |
| aplicar várias resoluções | DBOS workflow | sim | bulk preview + progress | alto risco de side effects múltiplos |

#### Heurística para escolher síncrono vs pg-boss vs DBOS

```text
read/query rápida                         -> tool síncrona
write único e atômico                      -> oRPC procedure com approval se agente age
preview/proposta sem side effect           -> tool proposal síncrona
trabalho pesado/idempotente/arquivo/export -> pg-boss job
processo multi-step com side effects        -> DBOS workflow
espera humana/externo/retry/compensação    -> DBOS workflow
recorrência operacional simples            -> pg-boss schedule
recorrência de processo de negócio          -> DBOS workflow + scheduler/policy
```

### Background tasks e workflows acionados pelo agente

O Montte AI deve poder iniciar trabalho assíncrono, mas com semântica clara. A regra é: **o agente conversa e decide; pg-boss/DBOS executam o trabalho longo**.

#### Quando usar pg-boss

Use `pg-boss` para background tasks operacionais:

- gerar CSV/PDF ou relatório pesado;
- recalcular sugestões de categorização;
- processar importações;
- enviar e-mails/notificações já aprovados;
- jobs recorrentes/scheduled;
- fan-out de tarefas idempotentes;
- retentativas com backoff e dead-letter.

Contrato de uma tool de job:

```typescript
interface StartBackgroundJobResult {
   kind: "background_job";
   jobId: string;
   queue: string;
   idempotencyKey: string;
   status: "queued" | "active" | "completed" | "failed" | "cancelled";
   visibleToUser: boolean;
   estimatedCompletion?: string;
}
```

#### Quando usar DBOS

Use `DBOS` para workflows de negócio duráveis:

- conciliação aprovada com múltiplos steps;
- cobrança com espera, aprovação e envio externo;
- fechamento mensal assistido;
- estorno/compensação;
- qualquer processo que precisa sobreviver restart e retomar do step correto;
- qualquer processo com pausa humana, timeout, compensação ou audit trail forte.

Contrato de uma tool de workflow:

```typescript
interface StartWorkflowResult {
   kind: "durable_workflow";
   workflowId: string;
   workflowName: string;
   status: "started" | "waiting_approval" | "running" | "completed" | "failed" | "cancelled";
   approvalId?: string;
   auditEventId: string;
   statusTool: string;
}
```

#### Política para o agente

- Nunca esconder trabalho assíncrono do usuário quando ele altera estado, envia comunicação externa ou consome quota/custo relevante.
- Toda execução assíncrona deve ter `threadId`, `runId`, `skillId`, `organizationId`, `teamId`, `userId`, `promptVersion`, `toolVersion` e `idempotencyKey`.
- Jobs e workflows são allowlisted por skill em `asyncWork`.
- Payload do job/workflow é sempre Zod-validado no servidor.
- Background job não deve virar caminho para burlar approval: se a ação seria `write`, `external` ou `bulk` de forma síncrona, continua exigindo preview/aprovação quando assíncrona.
- O agente deve responder com estado verificável: “iniciei”, “aguardando aprovação”, “em fila”, “concluído”, “falhou”, não com promessa vaga.
- `cancel_async_work` precisa respeitar diferença entre cancelar job pendente, parar workflow seguro, ou criar workflow compensatório.

#### UX sugerida

```text
Usuário: "Concilie esses 120 lançamentos se encontrar correspondência segura."
Agente: usa skill.conciliacao -> gera preview -> pede aprovação
Usuário aprova
Agente: start_workflow(reconcile_batch_workflow)
UI: mostra card "Conciliação em andamento" + progresso + link de auditoria
Agente: pode continuar conversa enquanto DBOS executa
Resultado: notificação/activity center + get_async_status no chat
```

### Subagents skill-scoped

Subagents só devem existir quando uma skill precisa dividir trabalho caro/complexo sem vazar isso para a UX.

Regras:

1. Subagent herda `skillId`, `threadId`, `runId`, `organizationId`, `teamId`, `userId`.
2. Subagent recebe subconjunto de tools, nunca superset.
3. Subagent recebe budget menor que o pai.
4. Subagent retorna artefato estruturado, não mensagem final ao usuário.
5. Montte AI principal sintetiza e decide próxima ação.
6. Audit log registra parent/child run.

Exemplo:

```text
skill.conciliacao run
  main agent: entende pedido e carrega policy
  matcher subagent: calcula candidatos
  verifier subagent: remove matches fracos/conflitantes
  main agent: apresenta preview e pede aprovação
```

### Eval-first: Evalite no CI + PostHog Evals em produção

Cada skill dominial deve ter uma suite de eval offline e uma suite de produção:

```text
modules/agents/src/harness/evalite/
  finance-smoke.eval.ts
  finance-regression.eval.ts
  finance-reconciliation.eval.ts
  relationships-smoke.eval.ts
  automation-workflows.eval.ts

PostHog Evals
  montte-ai-prod-finance-policy
  montte-ai-prod-finance-format-hog
  montte-ai-prod-relationships-privacy
  montte-ai-prod-automation-approval
```

Scorers por skill:

- `skill_selection_accuracy` — skill correta foi ativada?
- `tool_exposure_minimality` — tools expostas eram mínimas?
- `tool_call_accuracy` — tool correta foi chamada?
- `argument_accuracy` — datas/filtros/status corretos?
- `numeric_grounding` — números saíram dos tool outputs?
- `approval_gate_correctness` — write/external/bulk pediu aprovação?
- `unsupported_claim_rate` — claims sem fonte/evidência?
- `tenant_isolation` — zero vazamentos entre org/team.
- `async_policy_correctness` — job/workflow correto foi escolhido?
- `async_idempotency` — retry/reenvio não duplica side effects?
- `workflow_approval_correctness` — workflows DBOS sensíveis pausam para aprovação?
- `openui_schema_validity` — componentes OpenUI emitidos respeitam schemas?
- `openui_provenance` — números em componentes têm toolResultId/provenance?
- `harness_boundary_compliance` — trajetória não acessa tool/recurso fora do contrato?
- `code_mode_policy` — sandbox só usou tools/read scopes permitidos?

Critério importante: LLM-as-judge pode avaliar tom/clareza, mas **não** valida número financeiro. Número financeiro é oráculo determinístico.

### Como isso muda o código atual

Estado atual observado:

- `modules/agents/src/skills.ts` tem apenas uma skill `financeiro` com metadata e `promptName`.
- `modules/agents/src/agent.ts` já recebe `pageContext.skillHint`, carrega prompt ativo e monta tools.
- `buildAgentReadTools` hoje expõe todas as read tools financeiras registradas.

Mudança proposta:

1. Expandir `SkillMeta` para `AgentSkillContract` com `discovery`, `frontendContext` e lazy tools.
2. Criar `buildBootstrapTools({ context, frontendContext })` com `discover_skills`, `load_skill`, `get_frontend_context`, `discover_tools`, `load_tool_schema`, `request_approval`.
3. Trocar `buildAgentReadTools({ context })` por registry lazy: tool summaries ficam disponíveis; schemas completos só via `load_tool_schema`.
4. Remover carregamento eager de prompt por `pageContext.skillHint`; registrar `hintedSkill` e `activatedSkill` separadamente.
5. Criar `createSkillRuntimeContext(options)` durante `load_skill` ou na segunda chamada `chat()` da estratégia B.
6. Adicionar middleware de `toolPolicy`, `budget`, `audit`, `grounding` e `unpromotedToolRejection`.
7. Adicionar `harness/evalite` com evals por skill, por lazy loading e por front-end context injection.
8. Criar registry de `asyncWork` por skill para jobs pg-boss e workflows DBOS allowlisted.
9. Migrar prompts de skill para PostHog Prompt keys com fallback local versionado.
10. Emitir PostHog generations/traces com `domainId`, `skillId`, `referenceIds`, `promptVersion`, `toolNames`, `runId`.
11. Configurar PostHog Evals de produção por domínio.
12. Criar `modules/agents/src/openui` com library inicial de componentes Montte.
13. Adicionar Code Mode apenas para references read-only aprovadas, com sandbox deny-by-default.
14. Criar trajectory audit log para harness safety.
15. Adicionar tools lazy `start_background_job`, `start_workflow`, `get_async_status`, `cancel_async_work`.
16. Migrar `/api/chat` para transporte oRPC stream conforme guideline local.

### Roadmap recomendado

#### PR 1 — Catálogo dominial + references

- Derivar skills dos route groups: `finance`, `relationships`, `automation`, e decidir se `inbox` vira skill.
- Criar references por subrota/subcapacidade.
- Definir `skill.finance` readonly inicial.
- Criar bootstrap tools: `discover_skills`, `load_skill`, `get_frontend_context`.
- `pageContext.skillHint` vira hint para discovery, não roteador hardcoded.
- Implementar Estratégia A: uma chamada `chat()` com TanStack lazy discovery nativo; B fica somente como fallback documentado.
- Registrar skill/version/model/prompt em telemetry.

#### PR 2 — PostHog Prompts + production metadata

- Criar prompts: `montte-ai-root`, `montte-ai-skill-finance`, `montte-ai-skill-relationships`, `montte-ai-skill-automation`.
- Buscar prompts em runtime com caching/fallback local.
- Vincular promptVersion a generations/traces.
- Enviar metadata de domínio/skill/reference/tool/run.

#### PR 3 — OpenUI component library + generative UI

- Criar `modules/agents/src/openui`.
- Definir componentes: EvidenceCard, FinancialMetricGrid, TransactionsTable, IntentPreview, ApprovalPanel, AsyncWorkCard, ReceiptCard.
- Fazer tools retornarem `ui` estruturado para tabelas/cards/charts.
- Garantir que resposta textual pós-UI tenha no máximo 1–2 frases.
- Adicionar eval `openui_schema_validity` e `openui_provenance`.

#### PR 4 — Knowledge & Retrieval Layer mínima

- Criar tools `search_knowledge` e `open_reference` com tenant/skill/source filters.
- Indexar docs/references/help com full-text/BM25 + embeddings.
- Retornar citations/provenance obrigatórias.
- Adicionar evals: context relevance, context recall, faithfulness, answer relevance, citation coverage.
- Bloquear uso de RAG como fonte final de números financeiros.

#### PR 5 — Lazy tool loading

- Marcar domain tools como lazy.
- Criar `discover_tools` e `load_tool_schema`.
- Rejeitar tool call não promovida.
- Medir tokens por turn e acurácia de tool selection.

#### PR 6 — Front-end context injection

- Definir `AgentFrontendContext` allowlisted com Zod por rota/skill.
- Enviar rota/filtros/seleção/entidade ativa no run.
- Rejeitar unknown keys e payload grande.
- Criar risk tier `ui_control` para navegação/filtros/sheets.
- Criar tests de tenant/permission spoofing e prompt injection via contexto.

#### PR 7 — Harness safety + Code Mode sandbox

- Criar harness boundary log para loaded/promoted/attempted/rejected tools.
- Habilitar Code Mode apenas para análise read-only em `skill.finance`/relatórios.
- Configurar sandbox sem rede/segredos/filesystem persistente.
- Adicionar evals de prompt injection, tool poisoning, resource scope e code mode policy.

#### PR 8 — Async work tools: pg-boss + DBOS

- Criar `asyncWork` no contrato de skill.
- Implementar `start_background_job` para jobs pg-boss allowlisted.
- Implementar `start_workflow` para workflows DBOS allowlisted.
- Implementar `get_async_status` e `cancel_async_work`.
- Registrar idempotency key, thread/run/skill/user/org e audit event.
- Garantir que async write/external/bulk mantém preview/aprovação.

#### PR 9 — Harness + Evalite + PostHog Evals

- Criar runner de harness.
- Criar 10 casos `financeiro`.
- Criar scorers determinísticos.
- Rodar `evalite run` local/CI.
- Configurar PostHog Evals de produção por domínio com sampling controlado.

#### PR 10 — Evidence-first outputs

- Tool outputs incluem provenance ids e filtros resolvidos.
- Resposta financeira declara período/filtros.
- Grounding scorer bloqueia números inventados.

#### PR 11 — `skill.categorizacao` como reference/proposal em skill.finance

- Criar proposal tool sem escrita.
- UI preview com confidence.
- Evals de precisão/recall em fixture rotulada.

#### PR 12 — approval/write path

- Approval gate.
- Procedure de domínio para apply.
- Audit log.
- Undo/compensação quando possível.

#### PR 13 — subagents internos opcionais

- Só para `skill.conciliacao` ou categorização se o eval mostrar necessidade.
- Budget/permissions herdados.
- Sem exposição na UX.

### Decisões recomendadas

1. **Um Montte AI na UX.** Não criar agentes nomeados por domínio na experiência do usuário.
2. **Skills internas são por domínio de route group.** `Finanças`, `Relacionamentos`, `Automação` — e possivelmente `Inbox` — são skills; rotas internas viram references/subcapacidades.
3. **Não criar skills por feature/rota quando existe domínio pai.** `Categorias`, `Centros de Custo`, `Clientes`, `Fornecedores` viram references, não skills expostas.
4. **Usar PostHog Prompts para prompts de produção e analytics.** Código mantém contrato/allowlist/fallback; PostHog mantém texto/versionamento/uso de prompt.
5. **Usar PostHog Evals em produção.** Evalite continua CI/offline; PostHog mede generations reais com LLM-as-judge e Hog/code-based evals.
6. **Não expor todas as tools sempre.** Começar com bootstrap discovery tools; business tools são lazy e skill-scoped.
7. **Deixar o agente descobrir a skill via tool em envelope governado.** Discovery é agent-driven; autorização é server-driven; implementação usa Estratégia A: TanStack lazy nativo em uma chamada `chat()`.
8. **Front-end context é hint, não autoridade.** Ajuda intenção e argumentos; não concede acesso nem altera tenant.
9. **Agentic UX é control surface, não só chat.** Toda ação relevante precisa de preview, approval, progress, receipt e recovery.
10. **OpenUI é a camada de UI generativa, AG-UI é o transporte.** O modelo só emite componentes allowlisted e validados; tools fornecem dados/provenance.
11. **Code Mode entra como sandbox read-only/proposal, não como atalho de escrita.** Útil para análises multi-tool; proibido para writes, segredos, rede livre ou bypass de approval.
12. **Harness safety é avaliada por trajetória.** Não basta resposta final correta; auditar tools, recursos, aprovações, sandbox e boundaries.
13. **O agente pode iniciar trabalho assíncrono, mas não deve executá-lo dentro do loop conversacional.** pg-boss roda jobs operacionais; DBOS roda workflows duráveis; o agente agenda, acompanha e explica.
14. **Não deixar skill substituir workflow.** Side effects duráveis pertencem a workflow/procedure; jobs operacionais ficam em pg-boss; transporte/contrato fica em oRPC.
15. **Não usar RAG genérico para financeiro transacional.** Use domain tools e queries tipadas.
16. **Não validar dinheiro com judge LLM.** Use oráculos determinísticos.
17. **Sim para progressive disclosure.** Prompt raiz curto, skill contract sob demanda, references só quando necessárias.
18. **RAG é camada de conhecimento, não sistema de registro.** Usar para docs/textos/evidência; números financeiros finais vêm de procedures.
19. **Retrieval de produção deve ser híbrido e Postgres-only.** BM25/full-text/ParadeDB + embeddings em Postgres + metadata filters + rerank quando necessário. Não adicionar vector DB, graph DB ou search DB separado.
20. **Memória precisa ser tipada e governada.** Separar preferência, semântica do workspace, episódios e procedimento; nada de memória geral como verdade financeira.
21. **MCP é adapter, não bypass.** Se usado, passa pelo mesmo auth/policy/audit das tools oRPC.

### Fontes

- A Comprehensive Survey on Agent Skills, 2026, arXiv:2605.07358 — https://arxiv.org/abs/2605.07358
- Contractual Skills, 2026, arXiv:2605.22634 — https://arxiv.org/abs/2605.22634
- GraSP, 2026, arXiv:2604.17870 — https://arxiv.org/abs/2604.17870
- Agent Contracts, 2026, arXiv:2601.08815 — https://arxiv.org/abs/2601.08815
- Beyond Static Sandboxing / Aethelgard, 2026, arXiv:2604.11839 — https://arxiv.org/abs/2604.11839
- POLARIS, 2026, arXiv:2601.11816 — https://arxiv.org/abs/2601.11816
- FinRobot / GBPAs for ERP, 2025, arXiv:2506.01423 — https://arxiv.org/abs/2506.01423
- Anthropic Agent Skills overview — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic Skill authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Microsoft Agent Skills — https://learn.microsoft.com/en-us/agent-framework/agents/skills
- NVIDIA Verified Agent Skills — https://developer.nvidia.com/blog/nvidia-verified-agent-skills-provide-capability-governance-for-ai-agents/
- SAP AI-native North Star Architecture — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision
- SAP Process Layer — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- Builder.io Agent-Native Architecture — https://www.builder.io/blog/agent-native-architecture
- TanStack AI Lazy Tool Discovery — https://tanstack.com/ai/latest/docs/tools/lazy-tool-discovery
- Tool Attention Is All You Need, 2026, arXiv:2604.21816 — https://arxiv.org/abs/2604.21816
- PostHog AI Platform Architecture — https://posthog.com/handbook/engineering/ai/architecture
- PostHog AI context and commands — https://posthog.com/docs/posthog-ai/context-and-commands
- PostHog MaxTool API README — https://github.com/PostHog/posthog/blob/master/ee/hogai/README.md
- DBOS TypeScript Programming Guide — https://docs.dbos.dev/typescript/programming-guide
- DBOS AI Quickstart — https://docs.dbos.dev/ai/ai-quickstart
- DBOS Workflows Tutorial — https://docs.dbos.dev/typescript/tutorials/workflow-tutorial
- DBOS Queues & Concurrency — https://docs.dbos.dev/typescript/tutorials/queue-tutorial
- pg-boss README — https://github.com/timgit/pg-boss/blob/master/README.md
- pg-boss Jobs API — https://github.com/timgit/pg-boss/blob/master/docs/api/jobs.md
- PostHog Prompt management — https://posthog.com/docs/llm-analytics/prompts
- PostHog Evaluations — https://posthog.com/docs/llm-analytics/evaluations
- PostHog Generations — https://posthog.com/docs/llm-analytics/generations
- PostHog Traces — https://posthog.com/docs/llm-analytics/traces
- Designing For Agentic AI — Smashing Magazine — https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/
- Intent Preview — AI UX Design Guide — https://www.aiuxdesign.guide/patterns/intent-preview
- Agentic Conversational UI — AI UX Design Guide — https://www.aiuxdesign.guide/guides/conversational-ui-guide/agentic-conversational-ui-when-ai-takes-actions
- Background Work Visibility — AI Design Blueprint — https://aidesignblueprint.com/en/background-work-visibility
- Agent Status Monitoring — AI UX Design Guide — https://www.aiuxdesign.guide/patterns/agent-status-monitoring
- Agent Status & Activity UI Patterns — Agentic Design — https://agentic-design.ai/patterns/ui-ux-patterns/agent-status-activity-patterns
- Human-in-the-loop patterns — Cloudflare Agents — https://developers.cloudflare.com/agents/guides/human-in-the-loop/
- Production Agent Architecture — Conductor — https://conductor-oss.github.io/conductor/devguide/ai/production-agent-architecture.html
- Agent Loop — Agentcy — https://docs.agentcylabs.com/concepts/agent-loop
- OpenUI Overview — https://www.openui.com/docs/openui-lang/overview
- OpenUI GenUI — https://www.openui.com/docs/chat/genui
- OpenUI Architecture — https://www.openui.com/docs/openui-lang/how-it-works
- OpenUI Shadcn Chat — https://www.openui.com/docs/openui-lang/examples/shadcn-chat
- NN/g AI chatbot guidelines — https://www.nngroup.com/articles/ai-chatbots-design-guidelines/
- Microsoft UX design for agents — https://microsoft.design/articles/ux-design-for-agents/
- Amazon Science human-AI coordination — https://www.amazon.science/blog/designing-ai-agents-that-know-when-to-step-back
- TanStack AI Code Mode — https://tanstack.com/ai/latest/docs/code-mode/code-mode
- TanStack AI Code Mode Isolate Drivers — https://tanstack.com/ai/latest/docs/code-mode/code-mode-isolates
- TanStack AI Showing Code Mode in UI — https://tanstack.com/ai/latest/docs/code-mode/client-integration
- TanStack AI Code Mode with Skills — https://tanstack.com/ai/latest/docs/code-mode/code-mode-with-skills
- Auditing Agent Harness Safety, 2026, arXiv:2605.14271 — https://arxiv.org/abs/2605.14271
- SoK: The Attack Surface of Agentic AI, 2026, arXiv:2603.22928 — https://arxiv.org/abs/2603.22928

- Retrieval-Augmented Generation for Natural Language Processing, 2024/2025, arXiv:2407.13193 — https://arxiv.org/abs/2407.13193
- Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG, 2025/2026, arXiv:2501.09136 — https://arxiv.org/abs/2501.09136
- SoK: Agentic Retrieval-Augmented Generation, 2026, arXiv:2603.07379 — https://arxiv.org/abs/2603.07379
- Rethinking Memory in AI, 2025, arXiv:2505.00675 — https://arxiv.org/abs/2505.00675
- Externalization in LLM Agents, 2026, arXiv:2604.08224 — https://arxiv.org/abs/2604.08224
- The Evolution of Agentic AI Software Architecture, 2026, arXiv:2602.10479 — https://arxiv.org/abs/2602.10479
- AgenticRAG: Agentic Retrieval for Enterprise Knowledge Bases, 2026, arXiv:2605.05538 — https://arxiv.org/abs/2605.05538
- Agentic GraphRAG: Navigating Unstructured Financial Data with Collaborative AI, 2026, arXiv:2605.18770 — https://arxiv.org/abs/2605.18770
- Knowledge Graph RAG: Agentic Crawling and Graph Construction in Enterprise Documents, 2026, arXiv:2604.14220 — https://arxiv.org/abs/2604.14220
- Model Context Protocol introduction — https://modelcontextprotocol.io/docs/getting-started/intro
- Model Context Protocol security best practices — https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- OpenAI Structured Outputs — https://platform.openai.com/docs/guides/structured-outputs
- Anthropic tool use overview — https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview
- Anthropic Building Effective Agents — https://www.anthropic.com/engineering/building-effective-agents
- Ragas available metrics — https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- LlamaIndex evaluation docs — https://docs.llamaindex.ai/en/stable/optimizing/evaluation/evaluation/
- LangSmith evaluation concepts — https://docs.smith.langchain.com/evaluation
- Pinecone rerankers and two-stage retrieval — https://www.pinecone.io/learn/series/rag/rerankers/
- ParadeDB hybrid search concepts — https://www.paradedb.com/learn/search-concepts/hybrid-search
- PostgreSQL full text search — https://www.postgresql.org/docs/current/textsearch.html
- OWASP Top 10 for LLM Applications 2025 — https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf
- OWASP LLM Prompt Injection Prevention Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

### Itens não verificados / cautela

- Alguns papers de 2026 são preprints; trate resultados quantitativos como sinal, não verdade estabelecida.
- Fontes de vendor/blog sobre AI-native têm viés comercial; usei como inspiração arquitetural, não como evidência de performance.
- Não implementei código neste passo; este é um artefato de arquitetura.

---

## Estratégia TanStack AI e agente financeiro

Origem: `outputs/tanstack-ai-finance-agent-strategy.md`

## Deep research — TanStack AI, harness do agente e estratégia para agentes financeiros no Montte

Data: 2026-05-25  
Escopo: avaliar o estado atual do harness do Montte AI, o que TanStack AI oferece hoje, o padrão emergente de agentes financeiros/ERP e uma estratégia pragmática para o Montte.

### Resumo executivo

**Observação principal:** o Montte já está na direção certa: usa `@tanstack/ai`, OpenRouter, `toolDefinition` com Zod, `maxIterations`, OpenTelemetry, assistant-ui via AG-UI nativo, thread state remoto e tools financeiras de leitura. Isso combina com a arquitetura recomendada nas docs atuais do TanStack AI e com o padrão de mercado para agentes financeiros: agir dentro do sistema de registro, com contratos tipados, trilha de auditoria, controles e humano no loop.

**Gap principal:** ainda falta um **harness formal de avaliação e governança**. Hoje o runtime existe, mas não há pacote explícito `modules/agents/src/harness/` para: golden tasks, replay de threads, assert de tool calls, orçamento de iterações/custo, avaliação de respostas financeiras, testes de permissões, simulação de aprovação, nem relatório de regressão por skill.

**Estratégia recomendada:** manter **um agente principal** e evoluir por **skills**. Não criar vários agentes separados como produto/UX. O usuário conversa com Montte AI; capacidades novas entram como `skill.financeiro`, `skill.conciliacao`, `skill.categorizacao`, `skill.cobranca`, `skill.billing`. Subagents podem existir, mas apenas como detalhe interno de execução de uma skill — nunca como a abstração principal exposta ao usuário.

### Evidência coletada

#### 1. TanStack AI atual

Fontes oficiais indicam que `chat()` hoje suporta:

- `adapter`, `messages`, `tools`, `systemPrompts`, `agentLoopStrategy`, `abortController`, `modelOptions`, `threadId`, `runId` e `parentRunId`.
- `toolDefinition()` como definição isomórfica com schema Zod/JSON Schema, `.server()` e `.client()`.
- AG-UI compliance com `RunAgentInput`, `threadId`, `runId`, `tools`, `forwardedProps`, `chatParamsFromRequest` e `mergeAgentTools`.
- Middleware de lifecycle com `onConfig`, `onChunk`, `onBeforeToolCall`, `onAfterToolCall`, `onUsage`, `onAbort` e `ctx.defer()`.
- OpenTelemetry via `otelMiddleware`, spans por chat/iteração/tool e métricas de tokens/duração; `captureContent` deve ficar desligado por padrão para privacidade.

**Inferência:** TanStack AI é suficiente para o harness do Montte sem Vercel AI SDK/Mastra. A peça que falta é produto/arquitetura interna, não framework.

#### 2. Estado atual do Montte

Inspeção local do repo:

- `modules/agents/src/agent.ts` monta `chat()` diretamente com `flashModel`, `systemPrompts`, skill ativa, tools, `maxIterations(8)`, `parallelToolCalls: false`, `threadId/runId`, abort e `otelMiddleware`.
- `modules/agents/src/tools/*` expõe tools financeiras tipadas: lançamentos, resumo financeiro, contas, cartões, categorias, tags e relatórios.
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/-montte-ai/chat-runtime.tsx` usa `useAgUiRuntime` + `HttpAgent` de `@assistant-ui/react-ag-ui`/`@ag-ui/client`.
- `apps/web/src/routes/api/chat.ts` serve o stream AG-UI hoje. **Isso é dívida técnica**: a guideline local de TanStack AI diz que o transporte deve pertencer ao oRPC e não a uma rota manual `/api/chat`.
- As tools financeiras atuais retornam dados estruturados, mas ainda **não retornam `ui`/json-render** de forma consistente; OpenUI/json-render deve ser tratado como etapa futura.
- Não existe diretório `modules/agents/src/harness/` no estado atual inspecionado.

**Inferência:** o runtime de produção está razoavelmente moderno, mas o harness ainda é implícito. Para mexer com dinheiro, o harness precisa virar primeira-classe.

#### 3. Padrão de mercado para agentes financeiros

Fontes oficiais/produto mostram o mercado convergindo para agentes embutidos em workflows financeiros:

- Microsoft Finance Reconciliation Agent reconcilia dois datasets em Excel, sugere chaves/mapeamentos e produz relatório generativo; custom agents permitem controlar gatilho, fontes de dados e workflow.
- SAP posiciona Business AI para ERP/Finance em cash position, cash forecast, reporting, compliance e automação de processos financeiros.
- Oracle posiciona AI agents para ERP/EPM como automação end-to-end, visibilidade financeira, eficiência e controles.
- AWS Security recomenda, para agentes em serviços financeiros: identidades de agentes, escopo de ferramentas, supervisão para ações críticas, segregação de deveres, maker-checker, logs e monitoramento comportamental.
- Relatórios/produtos de 2026 como SAP, OneStream, Prophix e Microsoft enfatizam agentes dentro do sistema de registro, com controle e transparência — não chatbots soltos. A fonte da Sage apareceu na busca, mas o fetch foi bloqueado; portanto fica apenas como sinal não verificado, não como evidência forte.

**Inferência:** o wedge mais forte para Montte não é “chat com financeiro”. É **operação financeira assistida com evidência e ação controlada**: conciliação, categorização, cobranças, previsão de caixa e explicação de variações.

#### 4. Literatura relevante

- **POLARIS: Typed Planning and Governed Execution for Agentic AI in Back-Office Automation** (2026, arXiv:2601.11816) defende planejamento tipado, seleção governada, execução guardada, repair loop limitado, policy guardrails e trilhas auditáveis para back-office.
- **Designing Intelligent Enterprise Agents: A Capability-Aligned Multi-Agent Architecture** (2026, arXiv:2605.08258) argumenta contra decomposição prematura em microagentes; propõe contratos de capacidade e fronteiras de autonomia/tool/data/memória.
- **AI Agents in Financial Markets: Architecture, Applications, and Systemic Implications** (2026, arXiv:2603.13942) organiza agentes financeiros em percepção de dados, motor de raciocínio, geração de estratégia e execução/controle; destaca autonomia, heterogeneidade, acoplamento, concentração de infraestrutura e observabilidade como riscos.

**Inferência:** para Montte, o caminho seguro é “typed tools + bounded autonomy + audit trail + eval harness + skill-first architecture”, não “agent swarm”.

### Estratégia recomendada

#### Norte arquitetural

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

#### Sequência de produto

##### Fase 1 — `skill.financeiro` confiável

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

##### Fase 2 — skills de triagem/recomendação

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

##### Fase 3 — skills de ação controlada

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

### Design de harness mínimo

#### Eval em massa com Evalite

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

#### Golden tasks iniciais

| Classe | Exemplo | Oráculo |
|---|---|---|
| Consulta numérica | “saldo de abril” | valor exato igual ao `get_financial_summary` |
| Filtro temporal | “semana passada” | datas resolvidas corretamente em pt-BR |
| Tool selection | “despesas por categoria” | chama `generate_financial_report(expenses_by_category)` |
| Não-alucinação | “qual cliente mais atrasou?” sem tool cliente | informa limitação |
| Permissão | thread/time errado | erro/sem vazamento |
| UI futura | quando tool retornar `ui`/json-render | assistant não duplica tabela; antes disso, validar apenas dados estruturados |
| Custo | pergunta simples | <= N iterações, sem tool redundante |

#### Métricas

- `tool_call_accuracy`: tool esperada vs tool usada.
- `argument_accuracy`: filtros/data/status/categoria corretos.
- `numeric_grounding`: números na resposta aparecem no tool output.
- `unsupported_claim_rate`: claims sem evidência.
- `approval_gate_rate`: ações sensíveis bloqueadas para aprovação.
- `iteration_count` e tokens por run.
- `latency_p50/p95` por skill.
- `tenant_isolation_failures`: deve ser zero.

#### Middleware recomendado

Adicionar middlewares TanStack AI pequenos e compostos:

1. `financeGroundingMiddleware`: captura tool outputs e valida que números finais foram vistos.
2. `budgetMiddleware`: aborta por iteração/token/custo.
3. `toolPolicyMiddleware`: bloqueia tools por skill, papel e risco.
4. `auditMiddleware`: registra tool calls e decisões com `ctx.defer()`.
5. `pii/contentGuardMiddleware`: redige/filtra antes de stream/traces quando necessário.
6. `promptRunMetadataMiddleware`: registra prompt name/versão ou hash, modelo, reasoning effort, skill, threadId, runId e versões das tools em cada run do harness.

### Estratégia skill-first para finanças

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

### Riscos e objeções

- **Risco de alucinação numérica:** mitigar com outputs estruturados, grounding evaluator e resposta baseada em tool result.
- **Risco de permissão/tenant leakage:** harness precisa fixtures multi-tenant e testes de thread/team/organization.
- **Risco de decomposição excessiva:** evitar microagentes como arquitetura de produto. Preferir skills; subagents só como implementação interna com contrato, métricas e escopo herdados.
- **Risco de UX chatbot paralelo:** continuar integrando AI ao fluxo, com OpenUI/json-render e ações aprováveis na UI.
- **Risco de custo/latência:** budget middleware; cache apenas para dados quase estáticos por tenant/team/user, como categorias e Centros de Custo, com TTL curto. Evitar cache para saldos, lançamentos, vencimentos e relatórios financeiros. Manter `parallelToolCalls: false` onde ordem importa.

### Próximos passos concretos

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

### Fontes

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

### Itens não verificados / bloqueados

- Não rodei o harness porque ele ainda não existe como módulo explícito no repo.
- A página da Sage bloqueou fetch automatizado; usei apenas o snippet retornado na busca web, então não a tratei como fonte forte no corpo principal.
- Não validei versões mais novas do pacote no npm além do que consta no `package.json` local e nas docs atuais.

---

## Proveniência — arquitetura skill-first

Origem: `outputs/skill-first-ai-native-architecture.provenance.md`

## Provenance — skill-first-ai-native-architecture

Data: 2026-05-25

### Busca web

- `web_search`: skill based AI agent architecture capability based agents tool permissions evals 2026
- `web_search`: LLM agent skills architecture capability contracts tool governance enterprise agents
- `web_search`: Claude skills ChatGPT tools agent skills architecture prompt tool routing
- `web_search`: AI native application architecture agentic software design AI-native SaaS architecture 2026
- `web_search`: AI-native enterprise software architecture agents workflows human approval observability evals
- `web_search`: AI-native ERP finance software architecture AI agents system of record workflow

### Fetch direto

- Anthropic Agent Skills overview: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- Anthropic Skill best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Microsoft Agent Skills: https://learn.microsoft.com/en-us/agent-framework/agents/skills
- NVIDIA Verified Agent Skills: https://developer.nvidia.com/blog/nvidia-verified-agent-skills-provide-capability-governance-for-ai-agents/
- SAP AI-native North Star Architecture vision: https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision
- SAP Process Layer: https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- Builder.io Agent-Native Architecture: https://www.builder.io/blog/agent-native-architecture
- Anthropic PDF fetch returned too little content in one route; not used as primary source.

### Alpha / papers

- `alpha search -m semantic "skill based LLM agent architecture capability contracts tool governance evaluation"`
- `alpha get 2605.07358` — A Comprehensive Survey on Agent Skills
- `alpha get 2605.22634` — Contractual Skills
- `alpha get 2604.17870` — GraSP
- `alpha get 2601.08815` — Agent Contracts
- `alpha get 2601.11816` — POLARIS
- `alpha get 2604.11839` — Beyond Static Sandboxing / Aethelgard
- `alpha search -m semantic "AI native ERP generative business process agents system of record workflows finance"`
- `alpha get 2506.01423` — FinRobot / Generative Business Process AI Agents for ERP

### Repo local

- `read modules/agents/src/skills.ts`
- Prior artifact/repo inspection from `outputs/tanstack-ai-finance-agent-strategy.md` used for current Montte runtime state.

### Caveats

- Several 2026 arXiv results are preprints; numeric claims are cited as paper-reported, not independently reproduced.
- Vendor/blog claims were used for architectural framing, not quantitative performance claims.

### Review pass

Ran `reviewer` subagent on the draft. Applied corrections:

- Clarified that Montte skills must not execute arbitrary directory scripts; executable behavior should be typed TypeScript tools/procedures/workflows.
- Separated oRPC (contract/procedure), DBOS (durable workflows), and pg-boss (operational jobs).
- Softened `pageContext.skillHint` from absolute winner to strong prior.
- Added tool risk tiers, owner module, audit metadata, and rollback/compensation policy fields.
- Strengthened `skill.cobranca` controls: templates, consent/opt-out, rate limit, allowed channel, send audit.

### Second refinement — agent-driven skill discovery + lazy tools + frontend context

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

### Verification/review fix after subagent review

Reviewer flagged implementability and safety gaps. Applied corrections:

- Added explicit TanStack AI implementation strategies:
  - Strategy A: one `chat()` using TanStack lazy tool discovery with metadata registered up front.
  - Strategy B: two `chat()` invocations when full skill prompt must be mounted after activation.
- Clarified `load_skill` must not magically mutate a system prompt already sent to the model.
- Added server-side telemetry fields: `hintedSkill` and `activatedSkill`.
- Tightened `AgentFrontendContext`: Zod per route/skill, rejected unknown keys, bounded primitive filters, fixed selection entity types.
- Added `ui_control` tool risk tier for UI manipulation tools.
- Added bootstrap tool risk contracts, especially `request_approval` as idempotent proposal-only and unable to approve its own proposal.

### Decision update

User confirmed: Strategy A is the correct direction. Updated report to make one `chat()` with TanStack AI native lazy tool discovery the chosen architecture. Strategy B is retained only as a fallback note, not as an implementation target.

### Third refinement — agent-initiated background jobs and durable workflows

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

### Fourth refinement — domain skills + agentic UX/UI + execution matrix

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

### Fifth refinement — OpenUI, AI chat UX, harness engineering, sandbox, TanStack AI Code Mode

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

### Sixth refinement — broad AI technology radar: RAG, memory, protocols, model routing, evals

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


### Seventh refinement — Postgres-only AI data/storage constraint

User clarified a hard architecture constraint: Montte will use only Postgres, no additional database.

Applied changes:

- Updated technology radar to make hybrid retrieval explicitly Postgres-only.
- Replaced generic embeddings/vector index wording with Postgres storage/indexes: Postgres full-text/ParadeDB BM25 and embeddings in Postgres if needed, e.g. pgvector/ParadeDB-compatible setup.
- Reframed GraphRAG as `entity graph Postgres-only`, implemented with relational tables/views/materialized views/indexes, not Neo4j or another graph DB.
- Added explicit decision: no separate vector DB, graph DB, or search DB.
- Updated roadmap item for GraphRAG/entity graph to say Postgres-only.

---

## Proveniência — estratégia TanStack AI financeira

Origem: `outputs/tanstack-ai-finance-agent-strategy.provenance.md`

## Provenance — tanstack-ai-finance-agent-strategy

### Comandos/artefatos locais

- `find modules/agents/src -maxdepth 3 -type f`
- `read modules/agents/src/agent.ts`
- `read modules/agents/src/tools/registry.ts`
- `read modules/agents/src/tools/cashbook.ts`
- `read modules/agents/src/tools/reports.ts`
- `read modules/agents/src/skills.ts`
- `read core/ai/src/models.ts`
- `rg -n "useAgUiRuntime|HttpAgent|externalStore|Thread|agent\.chat|stream" apps/web/src modules/agents/src/router/chat.ts`
- `rg -n "tanstack|assistant|ag-ui|openrouter|mastra|@ai|\bai\b" package.json modules/agents core apps/web -S`

### Web search/fetch

- `web_search`: TanStack AI docs/current features, GitHub/examples, finance agents 2025/2026.
- `web_search`: Evalite docs/GitHub/API/CLI for TypeScript eval runner.
- `fetch_content`: TanStack AI API, AG-UI compliance, tools, OTel, middleware blog.
- `fetch_content`: Microsoft Finance reconciliation docs, AWS agentic AI financial services security, SAP Business AI for finance.

### Paper search/read

- `alpha search -m semantic "LLM agents tool use evaluation benchmarks task automation governance auditability finance accounting"`
- `alpha get 2601.11816` — POLARIS.
- `alpha get 2605.08258` — Designing Intelligent Enterprise Agents.
- `alpha get 2603.13942` — AI Agents in Financial Markets.

### Known caveats

- Sage source fetch blocked.
- No live package registry diff performed beyond search result snippets and local `package.json` inspection.
- No code changes applied; this is a strategy artifact.

### Update 2026-05-25 — Evalite

Added Evalite recommendation based on current docs/search results:

- https://www.evalite.dev/
- https://v1.evalite.dev/api/evalite
- https://v1.evalite.dev/api/cli
- https://github.com/mattpocock/evalite

Decision: use Evalite as batch eval runner and UI, but avoid `evalite/ai-sdk` wrapper because Montte guidelines prohibit Vercel AI SDK; call TanStack AI harness directly from Evalite `task`.

---
