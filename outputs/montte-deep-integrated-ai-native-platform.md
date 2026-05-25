# Montte como plataforma deep-integrated e AI-native

Data: 2026-05-25  
Status: proposta arquitetural / deep research aplicado ao roadmap atual  
Escopo: conectar tudo que existe e tudo que está no roadmap para Montte funcionar como uma plataforma coesa, inspirada no padrão de plataforma do PostHog.

## Resumo executivo

Montte não deve evoluir como módulos isolados com IA colada em cada tela. O modelo correto é uma **plataforma deep-integrated**: cada módulo continua dono dos seus dados e invariantes, mas publica capacidades, eventos, contexto, receipts, aprovações e ações de forma padronizada. O Montte AI vira a interface inteligente única sobre essa malha, não um conjunto de agentes separados.

A referência prática mais próxima é o PostHog: uma plataforma única, com uma arquitetura AI compartilhada, capacidades reutilizáveis, contexto carregado dinamicamente e um único loop de agente que ativa modos/skills conforme necessário. Para Montte, isso significa:

- **um Montte AI principal**;
- **skills por domínio**;
- **Postgres como sistema de verdade e contexto**;
- **oRPC como contrato de capacidade**;
- **business events como idioma comum entre módulos**;
- **DBOS para processos de negócio duráveis**;
- **pg-boss para jobs operacionais**;
- **PostHog Prompts/Evals/Traces como control plane de qualidade**;
- **OpenUI/AG-UI/PlateJS como superfícies, não fontes de verdade**.

A regra central:

```text
AI entende intenção, monta contexto, propõe plano e gera preview.
Domínio determinístico valida, executa e audita.
Eventos conectam tudo.
Inbox mostra o que precisa de atenção.
Workflows dão continuidade.
Receipts fecham o ciclo.
```

## O que “deep integrated” significa no Montte

Deep integrated não é só “um módulo chama outro”. É cada feature nascer com contratos de integração explícitos:

```text
Feature profunda =
  schema próprio
  oRPC procedures
  business events emitidos
  context pack para AI
  permissões e approval policy
  receipts/audit
  inbox implications
  workflow hooks
  OpenUI cards quando útil
  evals de comportamento
```

Se uma feature não emite evento, não gera contexto, não aparece no Inbox quando quebra, não tem receipt e não pode ser explicada pelo Montte AI, ela ainda não está integrada de verdade.

## Princípios de plataforma

1. **Um produto, uma malha semântica.** Relacionamentos, contratos, billing, pagamentos, fiscal, financeiro, inbox e automação devem falar a mesma linguagem de entidades e eventos.
2. **Módulos são capability providers.** Cada módulo expõe verbos de negócio, read models, events, policies e approvals.
3. **AI é interface e orquestrador governado, não source of truth.** O modelo propõe; procedures/workflows executam.
4. **Eventos são o idioma comum.** `contract.activated`, `billing.invoice.issued`, `payment.charge.paid`, `fiscal.nfe.rejected`, `finance.transaction.reconciled` conectam tudo.
5. **Inbox é cockpit operacional.** Tudo que precisa de decisão, correção, aprovação ou follow-up vira item acionável.
6. **Workflows dão continuidade fora do chat.** Conversa não executa trabalho longo; DBOS/pg-boss executam e reportam status.
7. **Receipts fecham o ciclo.** Toda ação relevante precisa provar o que mudou, por quem, com qual aprovação e quais eventos foram emitidos.
8. **PostHog-like platform, não AI widgets.** Evitar “IA por tela”. Montte AI deve compartilhar runtime, skills, tools, traces, evals e UX.

## Arquitetura alvo

```text
Surfaces
  Web app
  Montte AI shell
  Inbox
  PlateJS Contract Writer
  Dashboards
  Automation builder
  Tauri/desktop bridge futuro

AI platform
  TanStack AI single-loop agent
  PostHog Prompts/Evals/Traces
  skill contracts
  lazy tool discovery
  OpenUI previews/receipts

Capability layer
  oRPC routers por módulo
  typed tools por skill
  approvals
  deterministic procedures

Process layer
  DBOS workflows
  pg-boss jobs
  event outbox
  recovery/compensation

Semantic/data layer — Postgres-only
  domain schemas
  business_events
  provider ledgers
  audit_entries
  semantic concepts/metrics
  entity graph relational
  retrieval in Postgres

Domains
  Relationships
    -> Contracts
      -> Catalog/Products/Services
        -> Billing
          -> Payments
          -> Fiscal
          -> Finance/Reconciliation
            -> Inbox
            -> Automation
            -> Integrations
```

## O fluxo canônico da plataforma

```text
Cliente/fornecedor
  -> contrato/documento/termos
  -> serviço/produto/preço
  -> assinatura/uso/entitlement
  -> invoice/cobrança
  -> pagamento
  -> documento fiscal
  -> lançamento financeiro/conciliação
  -> relatório/inbox/workflow
  -> auditoria/receipt
  -> contexto para Montte AI
```

Esse fluxo deve ser visível em todos os níveis:

- no banco, via relações e eventos;
- no produto, via timeline e Inbox;
- no AI, via context packs e tools;
- nos workflows, via triggers e correlation IDs;
- na observabilidade, via PostHog traces/evals.

## Shared event spine

A primeira peça estrutural para “tudo conversar” é uma espinha dorsal de eventos de negócio.

### Tabelas base

```text
platform.business_events
  id
  organizationId
  teamId
  actorType: user | system | ai | provider | workflow
  actorId
  domain
  eventType
  subjectType
  subjectId
  correlationId
  causationId
  idempotencyKey
  occurredAt
  payload jsonb
  summary
  schemaVersion

platform.event_outbox
  id
  businessEventId
  target: pg-boss | dbos | webhook | posthog | inbox
  status
  attempts
  nextAttemptAt
  lastError

platform.provider_event_ledger
  id
  provider
  providerEventId
  receivedAt
  headersHash
  payloadRaw/fileKey
  parsedPayload jsonb
  verificationStatus
  idempotencyKey
  mappedBusinessEventId

platform.audit_entries
  id
  teamId
  actorType
  actorId
  action
  domain
  entityType
  entityId
  before jsonb
  after jsonb
  approvalId
  workflowRunId
  aiRunId
  createdAt

platform.approval_requests
  id
  teamId
  requestedByType: user | ai | workflow
  requestedById
  domain
  action
  riskTier
  preview jsonb
  evidence jsonb
  status
  approvedBy
  approvedAt
  expiresAt
```

### Eventos mínimos por domínio

```text
relationship.party.created.v1
relationship.party.updated.v1
contract.document.imported.v1
contract.terms.extracted.v1
contract.activated.v1
billing.subscription.created.v1
billing.invoice.drafted.v1
billing.invoice.issued.v1
payment.intent.created.v1
payment.charge.paid.v1
fiscal.nfe.validated.v1
fiscal.nfe.authorized.v1
fiscal.nfe.rejected.v1
finance.transaction.created.v1
finance.reconciliation.suggested.v1
finance.reconciliation.applied.v1
inbox.item.created.v1
workflow.run.started.v1
workflow.run.failed.v1
integration.sync.completed.v1
```

## Context packs: como a AI entende a plataforma sem sugar tabela inteira

Cada módulo deve expor um `ContextPack`, compacto e governado:

```text
ContextPack
  subject
  summary
  keyFacts
  openRisks
  recentEvents
  relatedEntities
  availableActions
  requiredApprovals
  evidenceRefs
```

Exemplos:

### Party ContextPack

```text
Cliente: ACME Ltda
Resumo: cliente ativo, 2 contratos, 1 invoice vencida, último pagamento há 38 dias.
Riscos: dados fiscais incompletos; contrato principal sem regra de reajuste.
Ações disponíveis: revisar contrato, gerar cobrança, abrir pendência, atualizar CNPJ.
Evidências: partyId, contractIds, invoiceIds, events recentes.
```

### Contract ContextPack

```text
Contrato: Prestação SaaS ACME 2026
Resumo: vigência anual, R$ 2.000/mês, reajuste IPCA, multa 2%, SLA não estruturado.
Riscos: cláusula de cancelamento ambígua.
Ações: reescrever cláusula, extrair termos, preparar billing, solicitar aprovação.
```

### Fiscal ContextPack

```text
NF-e: draft #123
Resumo: XML validado localmente, aguardando autorização SEFAZ homologação.
Riscos: CFOP incompatível com operação sugerida.
Ações: explicar rejeição, corrigir perfil fiscal, reenviar após aprovação.
```

## Domain map deep-integrated

### 1. Relationships

Fonte de clientes, fornecedores e parceiros.

Integrações obrigatórias:

- gera eventos para contratos, billing, fiscal, inbox e AI memory;
- aparece no entity graph;
- fornece contexto para contrato, invoice, cobrança, DFe e conciliação;
- expõe tools de leitura para Montte AI.

AI-native:

- criar party via CNPJ com preview;
- detectar duplicados;
- explicar histórico;
- sugerir dados faltantes;
- abrir pendência no Inbox.

### 2. Contracts

Ponte entre relacionamento, billing, fiscal e financeiro.

Inclui:

- contrato estruturado;
- documento editável;
- versões;
- termos extraídos;
- sugestões/comentários;
- aprovações.

PlateJS + TanStack AI:

- escrever contrato novo;
- reescrever cláusula selecionada;
- analisar contrato existente;
- extrair valores, vigência, reajuste, multas, SLA, rescisão e obrigações;
- transformar termos em preview de billing.

Regra:

```text
Documento editável != termo executável.
Termo executável só nasce via extração/edição estruturada + aprovação.
```

### 3. Catalog / Products / Services

Define o que é vendido/prestado.

Integrações:

- contrato referencia serviço/produto;
- billing referencia preço/plano;
- fiscal referencia perfil tributário;
- AI usa catálogo para gerar contrato e invoice coerentes.

### 4. Billing

Source of truth de cobrança, assinatura, uso, invoice e entitlement.

Integrações:

- nasce de contrato aprovado ou criação manual;
- emite eventos para pagamento, fiscal, finance e inbox;
- gera previews antes de mudar plano, emitir invoice ou cobrar;
- mantém usage events append-only.

AI-native:

- explicar invoice;
- simular upgrade/downgrade;
- detectar contrato ativo sem cobrança;
- sugerir invoice draft;
- nunca inventar número final.

### 5. Payments

Adapters de pagamento, não source of truth.

Integrações:

- recebe invoice do billing;
- cria intent/charge;
- webhook entra no provider ledger;
- evento pago/falhou alimenta finance, inbox e workflows.

Regra:

```text
AbacatePay/Stripe/etc. são adapters.
Montte/Postgres é source of truth.
```

### 6. Fiscal

Engine própria para NF-e/NFC-e/NFS-e Nacional quando possível.

Integrações:

- consome billing/invoice/customer/tax profile;
- gera XML/status/eventos;
- rejection vira Inbox item;
- DFe inbound sugere supplier/transaction/invoice;
- AI explica rejeições e prepara correções, sem tocar certificado direto.

### 7. Finance

Livro financeiro operacional.

Integrações:

- recebe candidatos de payments, open finance, fiscal e manual imports;
- reconcilia charges/invoices/transactions;
- alimenta reports, inbox e AI summaries.

AI-native:

- explicar fluxo de caixa;
- sugerir categorização;
- sugerir conciliação;
- gerar preview antes de escrita.

### 8. Inbox

Cockpit de operações.

Fontes:

- invoice vencida;
- pagamento falhou;
- contrato com termo ambíguo;
- NF-e rejeitada;
- DFe sem vínculo;
- transação sem categoria;
- workflow falhou;
- certificado vencendo.

Cada item deve ter:

```text
subject
cause event
evidence
risk tier
suggested actions
approval requirement
async status
receipt after resolution
```

### 9. Workflows / Automation

Process layer, não só automação visual.

Deve evoluir de schedule→report para:

- triggers por business events;
- waits/aprovações;
- templates cross-domain;
- retries;
- compensation/recovery;
- receipts.

### 10. Integrations / Extensions

Adapters governados.

Integrações devem sempre passar por:

- provider ledger;
- idempotência;
- event mapping;
- audit;
- tool policy quando expostas ao AI;
- Postgres source of truth.

## Montte AI como cola de produto

### Skills alvo

```text
skill.inbox
skill.finance
skill.relationships
skill.contracts
skill.billing
skill.payments
skill.fiscal
skill.automation
skill.integrations
skill.platform
```

### Bootstrap tools

```text
discover_skills
load_skill
discover_tools
load_tool_schema
get_frontend_context
request_approval
get_async_status
```

### Tool risk tiers

```text
read_only
analysis
ui_control
preview
approval_request
write_low_risk
write_financial
write_fiscal
provider_call
background_job
durable_workflow
code_mode_readonly
```

### Regra de execução

```text
Read/analysis: AI pode executar com permissão normal.
Preview: AI pode gerar, sem side effect.
Write financeiro/fiscal/legal: precisa approval.
Long-running: AI inicia DBOS/pg-boss, não roda no loop.
Provider/certificado: sempre através de adapter/procedure governado.
```

## Deep integration patterns

### Pattern A — Contract-to-billing-to-payment-to-finance

```text
contract.document.saved
  -> extract terms job
  -> contract.terms.extracted
  -> AI/user reviews terms
  -> approval requested
  -> DBOS activate contract
  -> billing.subscription.created
  -> billing.invoice.issued
  -> payment.intent.created
  -> payment.charge.paid via webhook ledger
  -> finance.reconciliation.suggested
  -> approval/apply
  -> receipt + reports update
```

### Pattern B — Fiscal rejection recovery

```text
billing.invoice.ready_for_fiscal
  -> fiscal XML preview
  -> approval
  -> DBOS authorize NFe
  -> SEFAZ rejects
  -> fiscal.nfe.rejected event
  -> Inbox item
  -> Montte AI explains cStat/xMotivo
  -> user approves correction
  -> retry workflow
  -> fiscal.nfe.authorized
  -> receipt
```

### Pattern C — Open Finance reconciliation

```text
open_finance.transaction.imported
  -> staging record
  -> match against invoice/payment/transaction
  -> AI summarizes match evidence
  -> low-risk auto-rule or approval
  -> finance.transaction.linked
  -> business event
  -> Inbox item resolved
```

### Pattern D — Relationship cockpit

```text
party opened in UI
  -> frontend context says active party
  -> server builds Party ContextPack
  -> Montte AI sees contracts, invoices, payments, fiscal docs, events
  -> suggests next best actions
  -> any action goes through preview/approval/workflow
```

## UX: PostHog-like platform behavior

PostHog é forte porque o produto parece uma plataforma única: eventos, analytics, sessions, feature flags, surveys, CDP, AI e workflows se alimentam. Montte deve buscar o mesmo efeito:

- abrir um cliente deve mostrar contratos, invoices, pagamentos, fiscal, financeiro, inbox e timeline;
- abrir um contrato deve mostrar termos, billing, fiscal, pagamentos e riscos;
- abrir uma invoice deve mostrar origem contratual, cobrança, pagamento, NF-e e lançamento financeiro;
- abrir o Inbox deve mostrar o motivo, a evidência, o impacto e a ação possível;
- conversar com Montte AI deve funcionar em qualquer tela com o mesmo contexto e mesmas regras.


## Pricing e self-billing: pay-as-you-go + addon

Decisão de produto: Montte deve ter dois mecanismos de preço, inspirado no PostHog:

1. **Free plan generoso** — bom o suficiente para o founder usar de verdade sem cartão.
2. **Pay-as-you-go** — cobrança por uso depois dos limites gratuitos, sem plano fixo obrigatório.
3. **Addon único de R$ 400/mês** — pacote opcional para capacidades avançadas, sem multiplicar SKUs cedo.

A regra de implementação é importante: **Montte só deve ativar billing integrado para cobrar o próprio Montte depois que AbacatePay estiver integrado como primeiro provider**. Isso permite o padrão “Montte no Montte”: a própria plataforma usa seus módulos de billing, payments, finance, inbox, workflows e Montte AI para cobrar seus clientes.

### Modelo de preço recomendado

```text
Free
  sem cartão
  limites generosos
  bom onboarding
  ideal para founder validar operação recorrente

Pay-as-you-go
  usa os mesmos produtos/features do Free
  cobra apenas uso acima dos limites gratuitos
  mantém free allowance mensal mesmo após upgrade
  exige billing limits/alerts para evitar susto

Addon Montte Pro — R$ 400/mês
  opcional
  habilita capacidades avançadas/profundas
  cobrado como subscription item fixo
  pode coexistir com PAYG
```

### Free plan “bem legal”

A proposta é o Free ser útil, não uma demo quebrada. Sugestão inicial — ajustar antes de lançar com base em custo real:

```text
Free plan
  1 organização
  1 time/projeto principal
  usuários: até 2 ou 3
  clientes/fornecedores: limite generoso inicial
  transações/importações: limite mensal suficiente para empresa pequena
  contratos: drafts e análise básica
  billing primitives: catálogo, preços e invoices draft
  Montte AI: cota mensal baixa/média, com limite visível
  Inbox e relatórios básicos
  sem cartão
```

O Free deve permitir sentir o loop completo:

```text
criar cliente
  -> criar contrato/draft
  -> gerar invoice draft
  -> ver pendências no Inbox
  -> usar Montte AI para explicar e corrigir
```

Mas deve restringir side effects caros/sensíveis até upgrade ou aprovação explícita:

- emissão fiscal real;
- volume alto de AI;
- automações recorrentes avançadas;
- Open Finance contínuo;
- múltiplos projetos/times;
- integrações avançadas;
- white-label/SSO/controles avançados se existirem no futuro.

### O addon único de R$ 400

Nome provisório: **Montte Pro** ou **Montte Operações**.

Deve ser simples:

```text
Addon R$ 400/mês
  capacidades avançadas de operação
  automações cross-domain
  limites maiores de AI/workflows
  Contract Writer avançado
  análises avançadas e recomendações
  integrações avançadas quando maduras
  suporte/prioridade se fizer sentido
```

Não criar vários addons agora. O PostHog tem muitos produtos/addons porque já é plataforma madura; Montte deve copiar o princípio — pagar só pelo que precisa — sem copiar a complexidade cedo.

### Pay-as-you-go como billing interno

Metering inicial deve ser pequeno e auditável. Possíveis meters:

```text
ai_message_units
ai_document_analysis_units
contract_documents_analyzed
workflow_runs
billing_usage_events_processed
payment_charges_processed
fiscal_documents_processed
open_finance_sync_items
```

Mas o MVP não deve medir tudo. Começar com poucos meters que tenham custo real e valor claro:

1. AI usage;
2. documentos analisados;
3. workflows/automações;
4. cobranças/pagamentos processados, se fizer sentido comercial.

Cada meter precisa de:

- evento append-only;
- idempotency key;
- customer/team/org;
- período de cobrança;
- fonte/correlationId;
- regra de free allowance;
- preview de custo;
- billing limit/alert.

### Montte no Montte: dogfooding obrigatório

Quando AbacatePay estiver integrado, Montte deve configurar a si mesmo como cliente interno:

```text
Montte customer account
  -> plan Free/PAYG/Add-on
  -> usage events emitidos pela própria plataforma
  -> invoice gerada pelo modules/billing
  -> cobrança criada pelo modules/payments via AbacatePay
  -> webhook AbacatePay entra no provider ledger
  -> payment.charge.paid event
  -> finance transaction/reconciliation
  -> receipt/audit
  -> Inbox se falhar
  -> Montte AI consegue explicar o ciclo inteiro
```

Isso valida a tese do produto melhor que qualquer demo. Se Montte não consegue cobrar o próprio Montte com seu billing, o billing ainda não está pronto para clientes.

### Gates antes de cobrar usuários reais

Não ativar billing real de Montte antes de:

1. `modules/billing` ter source of truth de produtos, preços, subscriptions, invoices e usage events;
2. `modules/payments` ter AbacatePay adapter com checkout/PIX/webhook/idempotência;
3. provider webhook ledger estar funcionando;
4. event spine e audit/receipt existirem;
5. billing limits/alerts existirem para PAYG;
6. invoice preview estar claro;
7. Inbox mostrar falha de pagamento/cobrança;
8. Montte AI conseguir explicar uso, cobrança e pagamento com evidência;
9. ambiente interno “Montte no Montte” rodar primeiro.

### Roadmap específico de pricing

```text
PR Pricing 1 — Pricing catalog interno
  definir Free, PAYG e Addon R$400 como registros internos de produto/preço
  sem cobrança real ainda

PR Pricing 2 — Usage meter mínimo
  ai usage + document analysis ou workflow runs
  append-only usage events
  preview de consumo por organização

PR Pricing 3 — Billing limits/alerts
  limite de gasto PAYG
  alertas antes/depois do free allowance
  bloqueio governado quando limite estourar

PR Pricing 4 — AbacatePay provider v1
  checkout/PIX/webhook/idempotência/provider ledger

PR Pricing 5 — Montte no Montte sandbox
  organização interna cobrada pelo próprio Montte em ambiente controlado

PR Pricing 6 — Billing público controlado
  liberar PAYG + addon para primeiros usuários, com kill switch e suporte manual
```

### Implicação AI-native

Montte AI precisa saber responder:

- “Por que estou pagando isso?”
- “Quanto usei este mês?”
- “O que está incluso no Free?”
- “O que ativa o addon de R$400?”
- “Como reduzir custo?”
- “O que acontece se eu colocar limite de R$ X?”

Mas a resposta deve vir de tools determinísticas de billing/usage, não de chute do modelo.


## Roadmap de PRs coesos

### PR 0 — ADR da plataforma deep-integrated

Criar documentação oficial:

- `docs/project/ai-native-platform-architecture.md`
- `docs/project/adr/deep-integrated-platform.md`

Acceptance:

- domain map, event spine, skills, approvals e Postgres-only formalizados.

### PR 1 — Event spine base

Criar:

- `business_events`
- `event_outbox`
- `audit_entries`
- `approval_requests`
- `provider_event_ledger`

Acceptance:

- helper transacional emite evento + audit.

### PR 2 — Eventos nos módulos existentes

Adicionar eventos em:

- relationships;
- finance/cashbook;
- workflows;
- agents run lifecycle quando aplicável.

Acceptance:

- criar party/transaction/workflow gera evento com correlationId.

### PR 3 — ContextPack v1

Criar context packs para:

- party;
- transaction/finance summary;
- workflow run;
- inbox item.

Acceptance:

- Montte AI lê resumo governado, não tabela crua.

### PR 4 — Skill contracts v1

Migrar de `financeiro` para:

- `finance`;
- `relationships`;
- `automation`;
- `inbox`.

Acceptance:

- skillHint é prior, não roteador rígido.

### PR 5 — Lazy tool discovery + tool policy

Implementar bootstrap tools, lazy schema loading e deny-by-default.

Acceptance:

- tool não autorizada é rejeitada mesmo que o modelo tente chamar.

### PR 6 — Approvals + receipts

Criar approval flow compartilhado e OpenUI:

- `ApprovalPanel`
- `ReceiptCard`

Acceptance:

- AI solicita aprovação sem executar side effect.

### PR 7 — Inbox como operations hub

Vincular Inbox a business events, risk tier, suggested actions e receipts.

Acceptance:

- evento de domínio cria item acionável.

### PR 8 — Contracts skeleton

Criar módulo contracts ligado a relationships e event spine.

Acceptance:

- contrato básico ligado a party emite eventos.

### PR 9 — PlateJS Contract Writer MVP

Adicionar editor, versões e painel AI.

Acceptance:

- salvar versão de contrato e usar AI para draft/rewrite sem ativar billing.

### PR 10 — Contract extraction to billing preview

Extrair termos com evidência e gerar preview de billing.

Acceptance:

- nenhum billing real nasce sem approval.

### PR 11 — Billing primitives

Criar source of truth de billing.

Acceptance:

- invoice draft explica origem contratual/preço/uso.

### PR 12 — Contract activation workflow

DBOS workflow contrato→billing.

Acceptance:

- aprovação ativa contrato e cria registros com receipt.

### PR 13 — Payments adapter + webhook ledger

AbacatePay como adapter inicial/fallback; ledger obrigatório.

Acceptance:

- webhook idempotente vira event, não mutação solta.

### PR 14 — Fiscal engine foundation

Certificado metadata, schema registry, XML validator, SEFAZ status homologação.

Acceptance:

- status service em homologação persiste request/response.

### PR 15 — Workflows event-based v2

Automation passa a reagir a business events com templates.

Acceptance:

- workflow dispara por invoice overdue ou fiscal rejected.

### PR 16 — PostHog Prompts/Evals operationalizado

Persistir prompt/model/tool versions e ligar evals.

Acceptance:

- run de AI tem trace, versão e evals básicas.

## Critérios de aceite globais

Uma feature nova só está “deep integrated” se responder sim:

1. Tem owner module claro?
2. Tem schema e invariantes determinísticas?
3. Expõe oRPC procedures/read models?
4. Emite business events?
5. Gera audit/receipt quando muda estado relevante?
6. Tem ContextPack ou summary governado para AI?
7. Define tool policy e risk tier?
8. Se tem write sensível, exige approval?
9. Se é async, roda em DBOS/pg-boss com status?
10. Aparece no Inbox quando precisa de atenção?
11. Pode ser explicado pelo Montte AI com evidência?
12. Tem evals mínimos de comportamento?

## Sources

- PostHog AI platform — https://posthog.com/handbook/engineering/ai/ai-platform
- PostHog AI platform architecture — https://posthog.com/handbook/engineering/ai/architecture
- PostHog AI products — https://posthog.com/handbook/engineering/ai/products
- PostHog agent-first product engineering — https://posthog.com/newsletter/agent-first-product-engineering
- PostHog Evaluations — https://posthog.com/docs/llm-analytics/evaluations.md
- PostHog pricing — https://posthog.com/pricing
- PostHog add-ons — https://posthog.com/addons
- PostHog billing limits and alerts — https://posthog.com/docs/billing/limits-alerts
- PostHog estimating usage and costs — https://posthog.com/docs/billing/estimating-usage-costs
- SAP AI-native North Star Architecture — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/vision
- SAP Process Layer — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- SAP Integration, Security, Ethics & Governance — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance
- SAP Event-Driven Applications reference — https://architecture.learning.sap.com/docs/ref-arch/fbdc46aaae
- Microsoft Fabric Business Events overview — https://learn.microsoft.com/en-us/fabric/real-time-hub/business-events/business-events-overview
- PlateJS AI docs — https://platejs.org/docs/ai
- PlateJS Suggestions — https://platejs.org/docs/suggestion
- TanStack AI Structured Outputs with Tools — https://tanstack.com/ai/latest/docs/structured-outputs/with-tools
- Local artifact: `outputs/skill-first-ai-native-architecture.md`
- Local artifact: `outputs/erp-billing-ai-native-roadmap.md`
- Local scout note: `notes/cohesive-ai-platform-current-state.md`
- Local research note: `notes/cohesive-ai-platform-external-research.md`
- Local planning note: `notes/cohesive-ai-platform-architecture-plan.md`

## Unverified / not implemented

- Nenhum código foi implementado nesta etapa.
- Não foram executados spikes de provider fiscal, AbacatePay, Open Finance ou PlateJS.
- O modelo de eventos/tabelas ainda precisa virar migration real e passar por typecheck/testes.
- A disponibilidade exata de ParadeDB/pgvector no ambiente de produção precisa ser verificada antes de prometer retrieval híbrido avançado.
