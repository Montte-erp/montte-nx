# Cohesive AI-Native Platform Architecture Plan — Montte

Data: 2026-05-25

## Goal

Transformar Montte em uma plataforma AI-native coesa, onde todos os domínios conversam por eventos, semântica comum, workflows determinísticos e um único Montte AI com skills dominiais governadas.

## Contexto e restrições

- `context.md` solicitado não estava disponível no caminho `/home/yorizel/Documents/montte-nx/context.md`; este plano usa o contexto da conversa, artefatos em `outputs/`, e leitura do repositório.
- Restrições obrigatórias:
  - Um único agente principal: **Montte AI**.
  - Skills por domínio, não agentes/produtos separados.
  - Subagents somente como detalhe interno de uma skill.
  - Runtime AI: **TanStack AI**.
  - Chat/contratos de API: **oRPC**.
  - Workflows duráveis: **DBOS**.
  - Jobs operacionais: **pg-boss**.
  - Prompts/evals de produção: **PostHog Prompts/Evals**.
  - Infra de dados AI: **Postgres-only**; sem vector DB, graph DB ou search DB separado.
  - Contratos: **PlateJS + TanStack AI** para escrita, revisão e análise.
  - Fiscal: **engine própria** para NF-e/NFC-e/NFS-e Nacional quando possível; providers externos apenas fallback/benchmark.

## Estado atual relevante

### Já existe

- Domínios ativos no schema:
  - `agents`, `auth`, `bank-accounts`, `categories`, `credit-cards`, `credit-card-statements`, `inbox`, `reports`, `relationships`, `workflows`, `settings-financial`, `tags`, `threads`, `messages`, `transactions`.
- Navegação atual por domínio:
  - `main` → Inbox.
  - `finance` → Lançamentos, Contas Bancárias, Cartões, Relatórios, Categorias, Centros de Custo.
  - `relationships` → Clientes, Fornecedores.
  - `automation` → Automações.
- `modules/agents` com TanStack AI, PostHog Prompts, tools financeiras de leitura e `pageContext.skillHint`.
- `modules/workflows` com v1 estreito: schedule trigger + criação de relatório via DBOS.
- `relationships.parties` já representa clientes e fornecedores.
- `transactions` já se liga a `relationshipId` e possui status, método de pagamento, vencimento, recorrência, parcelas e itens.
- Tauri existe como shell desktop, mas ainda sem capacidades de dispositivo.

### Lacunas principais

- Não há módulos fonte ativos para `contracts`, `billing`, `payments`, `vault`, `fiscal`, `open-finance`, `integrations` ou `extensions`.
- `modules/agents/src/skills.ts` possui apenas `financeiro` e metadata simples.
- Chat ainda usa modelo inicial de tools carregadas diretamente, sem skill contracts completos, lazy tool discovery formal, approval gates, async work tools ou OpenUI governado.
- Workflows ainda não são event-driven nem cross-domain.
- Não há event spine universal nem ledger de webhooks/provider events.
- PlateJS ainda não está declarado como dependência ativa em `apps/web/package.json`.

## Tese de arquitetura

Montte deve ser uma plataforma de operação recorrente AI-native, não um conjunto de features isoladas. O fluxo canônico é:

```text
party/customer/supplier
  -> contract/document/terms
  -> catalog/service/product/price
  -> subscription/entitlement/usage
  -> invoice/payment/fiscal document
  -> finance transaction/reconciliation
  -> inbox/workflow/notification
  -> audit/receipt/evaluation
  -> Montte AI context and suggestions
```

A regra de ouro:

```text
AI entende intenção, monta contexto, propõe plano e gera preview.
Domínio determinístico valida, executa e audita.
Usuário aprova ações financeiras/fiscais/jurídicas relevantes.
Eventos conectam tudo.
```

## Domain map recomendado

### 1. Platform Core

Responsável por tenant, auth, settings, permissões, audit, event spine, files e telemetry.

Capacidades:

- Organizations/teams/users/session.
- API keys e integrações.
- `business_events` append-only.
- `audit_entries` / receipts.
- `approval_requests`.
- `provider_event_ledger`.
- Files e documentos.
- PostHog metadata/traces/evals.

### 2. Relationships

Responsável por partes de negócio.

Entidades:

- `parties` existentes.
- contacts/addresses/tax identity complementares.
- relacionamento com cliente/fornecedor/parceiro.
- enrichment CNPJ.

AI-native:

- Criar party via CNPJ com preview.
- Detectar duplicados.
- Completar dados faltantes.
- Explicar histórico do relacionamento.
- Sugerir próximos passos.

### 3. Contracts

Responsável por acordos de negócio e ponte entre relacionamento, billing, fiscal e financeiro.

Entidades futuras:

- `contracts`.
- `contract_items`.
- `contract_terms`.
- `contract_documents`.
- `contract_document_versions`.
- `contract_extracted_terms`.
- `contract_suggestions`.
- `contract_comments`.
- `contract_approvals`.

PlateJS:

- Editor principal para redação de contrato.
- Comments/suggestions/diffs.
- Versões e snapshots (`plateValue`, Markdown e texto).
- Importação/análise de PDF/DOCX/texto como workflow/job separado.

AI-native:

- Gerar contrato a partir de template e contexto.
- Reescrever cláusula selecionada.
- Analisar contrato existente.
- Extrair valores, vigência, reajuste, multa, SLA, rescisão, obrigações e dados fiscais.
- Gerar preview de termos executáveis para `billing`.

Regra:

- Documento editável não é fonte executável automática.
- Termos extraídos viram candidatos com evidência.
- Ativação de contrato e geração de billing exigem aprovação.

### 4. Catalog / Products / Services

Responsável pelo que é vendido/prestado.

Entidades:

- `services`.
- `products` leves.
- `features`.
- `plans`.
- `prices`.
- `tax_profiles` vinculáveis.

AI-native:

- Sugerir estrutura de serviço a partir de contrato.
- Explicar preço/plano.
- Detectar plano sem preço, preço sem tax profile, feature sem entitlement.

### 5. Billing

Responsável por assinatura, uso, entitlement, invoice e lifecycle de cobrança.

Entidades:

- `subscriptions`.
- `subscription_items`.
- `usage_events` append-only.
- `meters`.
- `entitlement_snapshots`.
- `invoices`.
- `invoice_lines`.
- `billing_cycles`.

AI-native:

- Explicar composição de cobrança.
- Simular mudança de plano.
- Sugerir correções antes de faturar.
- Detectar clientes com contrato ativo sem assinatura/invoice.

Regra:

- Números financeiros finais vêm de procedures determinísticas, não de RAG/modelo.

### 6. Payments

Responsável por intenções, cobranças, provider adapters e conciliação.

Entidades:

- `payment_provider_accounts`.
- `payment_intents`.
- `payment_charges`.
- `payment_webhook_events`.
- `payment_reconciliation_matches`.

Adapters:

- AbacatePay v1 provável.
- Stripe/Outros como futuros adapters, não source of truth.

AI-native:

- Explicar status de pagamento.
- Preparar reenvio de cobrança.
- Sugerir matching com transação bancária.
- Nunca marcar pago sem evento/provider/procedure confiável.

### 7. Fiscal

Responsável por certificado, documentos fiscais, DFe e SEFAZ/Ambiente Nacional.

Entidades:

- `fiscal.companies`.
- `fiscal.digital_certificates`.
- `fiscal.fiscal_documents`.
- `fiscal.fiscal_document_events`.
- `fiscal.dfe_inbound_documents`.
- `fiscal.sefaz_authorizers`.
- `fiscal.sefaz_endpoints`.
- `fiscal.sefaz_requests`.
- `fiscal.sefaz_responses`.
- `fiscal.fiscal_schemas`.
- `fiscal.fiscal_validation_rules`.

Engine própria:

```text
FiscalEngine
  XmlBuilder
  XmlSchemaValidator
  XmlSigner/XMLDSig
  CertificateManager
  SefazSoapClient
  NFeAuthorizationFlow
  NFeEventFlow
  DFeDistributionFlow
  DanfeRenderer
  ContingencyPolicy
```

AI-native:

- Explicar rejeição SEFAZ.
- Preparar correção com evidência.
- Alertar certificado vencendo.
- Sugerir vínculo DFe → supplier/transaction/invoice.
- Não acessar segredo/certificado diretamente.

### 8. Finance

Responsável pelo livro financeiro operacional já existente.

Entidades atuais/futuras:

- `transactions`.
- `transaction_items`.
- bank accounts.
- credit cards/statements.
- categories.
- tags/cost centers.
- reports.
- reconciliation records.

AI-native:

- Consulta e explicação financeira.
- Categorização assistida.
- Conciliação com Open Finance/payments/invoices.
- Reports e insights.
- Preview antes de escrita/correção.

### 9. Inbox

Responsável por pendências operacionais cross-domain.

Fontes:

- DFe recebido.
- Webhook de pagamento falho.
- Contrato com termo ambíguo.
- Invoice vencida.
- Transação sem categoria.
- Certificado vencendo.
- Workflow com falha.
- Integração com conflito.

AI-native:

- Triagem.
- Agrupamento de pendências.
- Propor resolução.
- Transformar pendência em workflow/job/aprovação.

### 10. Workflows / Automation

Responsável por processos duráveis, template-first, event-aware.

Deve evoluir de schedule-only para:

- triggers por evento de negócio;
- triggers manuais;
- webhooks internos;
- waits/approvals;
- branches limitadas por template;
- ações allowlisted por domínio.

### 11. Integrations

Responsável por conexões externas e sync.

Adapters futuros:

- AbacatePay.
- Open Finance/Pluggy/Polp-like.
- Twenty.
- PostHog Workflows/CDP.
- E-mail/WhatsApp/notificações.

Regra:

- Providers entram como adapters e ledgers; Postgres Montte é source of truth.

### 12. Extensions / SDK

Responsável por extensibilidade somente após demanda real.

Capacidades iniciais:

- Webhooks outbound.
- API keys.
- Manifest de extension allowlisted.
- Tool adapters internos governados.

## Shared event spine

### Objetivo

Criar uma espinha dorsal append-only para os domínios conversarem sem acoplamento frágil.

### Tabelas base

```text
platform.business_events
  id
  teamId
  organizationId
  actorType: user | system | ai | provider | workflow
  actorId
  domain: relationships | contracts | billing | payments | fiscal | finance | inbox | workflows | integrations
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
  status: pending | approved | rejected | expired | cancelled
  approvedBy
  approvedAt
  expiresAt
```

### Event naming

Usar nomes estáveis e versionados:

```text
relationship.party.created.v1
contract.document.imported.v1
contract.terms.extracted.v1
contract.activated.v1
billing.subscription.created.v1
billing.invoice.issued.v1
payment.charge.paid.v1
fiscal.nfe.authorized.v1
finance.transaction.created.v1
finance.reconciliation.suggested.v1
inbox.item.created.v1
workflow.run.failed.v1
integration.sync.completed.v1
```

### Como domínios usam eventos

- Escrita de domínio em transação cria registro principal + `business_events`.
- `event_outbox` agenda handlers via pg-boss quando o efeito é operacional.
- DBOS workflows usam eventos como marcos/checkpoints de processo.
- Inbox consome eventos para criar pendências.
- Montte AI usa eventos como contexto, trilha e memória episódica.
- PostHog recebe eventos de produto/AI, sem virar source of truth.

### Acceptance inicial

- Toda nova escrita relevante em `contracts`, `billing`, `payments`, `fiscal` e `finance` emite evento.
- Todo provider webhook fica em ledger antes de mapear para domínio.
- Todo approval e workflow deixa `correlationId` ligando intenção → preview → aprovação → execução → receipt.

## Semantic layer Postgres-only

### Objetivo

Dar ao Montte AI e às UIs uma linguagem de negócio comum sem consultar tabelas cruas aleatoriamente.

### Camadas

#### 1. Domain glossary

```text
semantic.concepts
  id
  key: customer_mrr | overdue_invoice | active_contract | cash_runway
  label
  description
  domain
  ownerModule
  version
  status
```

#### 2. Metrics definitions

```text
semantic.metrics
  key
  label
  grain
  dimensions
  procedureName/viewName
  allowedFilters
  ownerDomain
  numericSourcePolicy
```

Regra: métricas financeiras importantes devem vir de views/procedures determinísticas, não de SQL gerado pelo modelo.

#### 3. Entity graph em Postgres

Sem graph DB. Usar tabelas relacionais/materialized views:

```text
semantic.entity_nodes
  teamId, entityType, entityId, label, searchText, metadata

semantic.entity_edges
  teamId, fromType, fromId, toType, toId, edgeType, confidence, sourceEventId
```

Exemplos de edges:

```text
party -> contract
contract -> subscription
subscription -> invoice
invoice -> payment_intent
payment_charge -> transaction
fiscal_document -> invoice
external_transaction -> transaction
contract_document_version -> extracted_term
```

#### 4. Knowledge/retrieval

Postgres-only:

- Full-text/BM25/ParadeDB quando disponível.
- Embeddings dentro do Postgres se necessário.
- Metadata filters em SQL.
- Rerank opcional sem novo datastore.

Escopos:

- Docs do produto.
- Contratos/documentos importados.
- DFe/XML/texto extraído.
- Mensagens/inbox.
- Receipts/audits resumidos.

Regra: RAG responde sobre documentos/evidências; números finais vêm de tools/procedures.

#### 5. Context packs

Cada domínio expõe `ContextPack` compacto para o agente:

```text
ContextPack
  subject
  summary
  keyFacts
  openRisks
  recentEvents
  availableActions
  requiredApprovals
  evidenceRefs
```

Isso evita despejar tabelas inteiras no prompt e cria uma forma comum de UI, tools e skills conversarem.

## Skill/tool layer

### Skill catalog alvo

Substituir o skill único `financeiro` por skills dominiais estáveis:

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

A ativação deve ser por hint + decisão do agente, não roteamento rígido.

### Skill contract

Cada skill deve declarar:

```text
id
label
ownerModule
promptName
description
appliesWhen
contextSources
references
allowedToolGroups
riskPolicy
approvalPolicy
asyncWorkPolicy
openUiComponents
metrics/evals
```

### Bootstrap tools sempre disponíveis

```text
discover_skills
load_skill
discover_tools
load_tool_schema
get_frontend_context
request_approval
get_async_status
```

### Lazy tool discovery

Estratégia:

- Um único `chat()` TanStack AI.
- Tools perigosas como lazy; schema completo só carregado sob demanda.
- Tool call rejeitado se schema não foi carregado/promovido.
- Tool policy filtra por skill, tenant, usuário, risco e aprovação.

### Tool groups por risco

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

### Exemplos de tools por domínio

Contracts:

```text
contract.generate_draft
contract.rewrite_selection
contract.analyze_document
contract.extract_terms
contract.compare_versions
contract.preview_activate
contract.activate_after_approval
```

Billing:

```text
billing.preview_subscription
billing.create_subscription_after_approval
billing.preview_invoice
billing.issue_invoice_after_approval
billing.explain_invoice
billing.record_usage_event
```

Payments:

```text
payments.create_checkout_after_approval
payments.get_payment_status
payments.reconcile_charge
payments.parse_provider_event_status
```

Fiscal:

```text
fiscal.validate_company_profile
fiscal.validate_nfe_xml_preview
fiscal.check_sefaz_status
fiscal.authorize_nfe_after_approval
fiscal.explain_rejection
fiscal.import_dfe
```

Finance:

```text
finance.search_transactions
finance.summarize_cashflow
finance.preview_categorization
finance.apply_categorization_after_approval
finance.preview_reconciliation
finance.apply_reconciliation_after_approval
```

Automation:

```text
automation.discover_templates
automation.preview_workflow
automation.create_workflow_after_approval
automation.run_workflow
automation.get_run_status
```

## Workflow layer

### Separação obrigatória

```text
oRPC = contratos/procedures/transport
TanStack AI = loop conversacional/tool calls
pg-boss = jobs operacionais em Postgres
DBOS = processos de negócio duráveis
PostHog = prompt/eval/analytics, não fonte de verdade operacional
```

### Quando usar o quê

- oRPC direto:
  - CRUD curto.
  - Preview.
  - Consulta.
  - Validação.
- pg-boss:
  - OCR/parse de contrato.
  - Reprocessamento de importação.
  - Fan-out de sync.
  - Geração de relatório pesado.
  - Retry de provider/webhook.
- DBOS:
  - Ativar contrato e criar assinatura/invoice inicial.
  - Autorizar NF-e com etapas e retries.
  - Régua de cobrança.
  - Conciliação aprovada.
  - Open Finance sync com staging/aprovação.
  - Workflow de fechamento assistido.

### Workflow patterns

#### Contract-to-billing

```text
contract_document_version.created
  -> pg-boss extract_terms
  -> contract.terms.extracted
  -> user/Montte AI reviews preview
  -> approval requested
  -> DBOS activateContractWorkflow
       create contract terms
       create subscription preview/effective records
       emit events
       create receipt
```

#### Invoice-to-payment-to-finance

```text
billing.invoice.issued
  -> payment intent created
  -> provider checkout/pix requested
  -> provider webhook ledger
  -> payment.charge.paid
  -> finance transaction candidate
  -> reconciliation preview
  -> approval or auto-rule if low-risk and configured
  -> finance.transaction.created/linked
```

#### Fiscal issue

```text
invoice ready for fiscal
  -> fiscal XML preview/validation
  -> approval if required
  -> DBOS nfeAuthorizationWorkflow
       sign XML
       send SEFAZ
       poll protocol
       persist XML/protocol/status
       emit fiscal.nfe.authorized or rejected
  -> inbox item if rejected
```

#### Inbox resolution

```text
business event creates inbox item
  -> Montte AI summarizes cause and options
  -> user approves action
  -> domain workflow/job executes
  -> inbox item resolved with receipt
```

## UI surfaces

### 1. Global Montte AI shell

- Assistant UI/AG-UI transport for the main conversation.
- Available everywhere.
- Uses frontend context as hint:
  - route;
  - active entity;
  - selected rows;
  - filters;
  - visible period;
  - UI capabilities.
- Server revalidates all IDs/permissions.

### 2. Domain side panels

- Relationship detail: AI summary, missing data, contracts, invoices, open issues.
- Contract workspace: PlateJS editor + right AI panel.
- Billing detail: invoice/subscription explanation and actions.
- Fiscal document detail: XML/status/rejection explanation.
- Workflow detail: run timeline and repair suggestions.

### 3. Inbox as operations hub

Inbox deve ser o cockpit de plataforma:

- cards de pendência;
- evidence;
- suggested action;
- approval panel;
- async work status;
- receipt after completion.

### 4. OpenUI/generative UI

Allowlisted components:

```text
EvidenceCard
IntentPreview
ApprovalPanel
AsyncWorkCard
ReceiptCard
RelationshipCard
ContractRiskPanel
ContractDiffPreview
BillingPreview
InvoiceBreakdown
PaymentStatusCard
FiscalStatusCard
ReconciliationPreview
WorkflowRunTimeline
```

Regra:

- Tools retornam `ui` quando houver visual structured output.
- Assistente responde em 1–2 frases depois de tool UI.
- Não duplicar tabelas/contagens em Markdown.

### 5. PlateJS Contract Writer

Superfície:

```text
left/main: PlateJS editor
right: Montte AI contract panel
top: status, versão, aprovação, vínculo com party/contract
inline: suggestions, comments, risk marks, extracted-term evidence
```

Fluxos:

- Generate draft.
- Rewrite selection.
- Analyze existing contract.
- Extract terms.
- Compare versions.
- Prepare billing preview.

## Governance

### Approval gates

Obrigatórios para:

- Criar/alterar cobrança real.
- Baixar/marcar pagamento.
- Emitir/cancelar documento fiscal.
- Ativar contrato.
- Enviar comunicação de cobrança crítica.
- Alterar dados financeiros em lote.

Possíveis low-risk auto-actions:

- Aplicar filtro UI.
- Gerar resumo.
- Criar draft.
- Criar inbox suggestion.
- Rodar análise sem side effect.

### Audit and receipts

Cada ação governada deve registrar:

- quem pediu;
- prompt/model/tool version;
- skill ativa;
- contexto usado;
- preview mostrado;
- aprovação;
- procedure/workflow/job chamado;
- resultado;
- eventos emitidos;
- receipt final.

### Tenant and permissions

- Frontend context é hint, nunca autoridade.
- Toda tool revalida `organizationId`, `teamId`, user permissions e ownership.
- Tool policy deve negar por padrão.
- Providers e certificados nunca expostos ao modelo.

### Evals

Evalite CI/offline:

- skill selection;
- tool boundary compliance;
- approval required;
- structured output validity;
- financial number source;
- retrieval citation;
- memory write policy;
- fiscal engine policy;
- contract extraction evidence.

PostHog Evals produção:

- helpfulness/tom;
- policy adherence;
- hallucination/citation checks;
- missing approval flags;
- UI schema validity;
- unsafe tool attempt alerts.

Regra: LLM judge não valida correção numérica financeira/fiscal; usar checks determinísticos.

## Phased PR roadmap

### PR 0 — Architecture docs and ADR

- Files:
  - `docs/project/ai-native-platform-architecture.md`
  - `docs/project/adr/ai-native-event-spine.md`
- Changes:
  - Formalizar domain map, event spine, skill contracts, approval gates e Postgres-only semantic layer.
- Acceptance:
  - Docs revisados e usados como fonte para PRs seguintes.

### PR 1 — Platform event spine base

- Files:
  - `core/database/src/schemas/platform-events.ts`
  - `core/database/src/schema.ts`
  - `core/database/src/relations.ts`
  - `core/database/migrations/*`
- Changes:
  - Criar `business_events`, `event_outbox`, `audit_entries`, `approval_requests`, `provider_event_ledger`.
  - Helpers mínimos de emissão transacional.
- Acceptance:
  - Teste cria evento + outbox em transação.
  - Nenhum handler externo ainda obrigatório.

### PR 2 — Event emission in existing domains

- Files:
  - `modules/relationships/src/router/index.ts`
  - finance/cashbook routers existentes
  - `modules/workflows/src/router.ts`
- Changes:
  - Emitir eventos em create/update/delete relevantes.
  - Adicionar `correlationId` opcional em inputs internos quando aplicável.
- Acceptance:
  - Criar party/transaction/workflow gera business event.

### PR 3 — Agent skill contracts v1

- Files:
  - `modules/agents/src/skills.ts`
  - `modules/agents/src/skill-contracts/*`
  - `modules/agents/src/tools/registry.ts`
- Changes:
  - Introduzir schema de skill contract.
  - Skills: `finance`, `relationships`, `automation`, `inbox`.
  - Mapear `financeiro` para `finance` ou migrar com compatibilidade.
- Acceptance:
  - Root prompt recebe catálogo dominial.
  - `pageContext.skillHint` continua hint, não router duro.

### PR 4 — Lazy tool discovery and policy middleware

- Files:
  - `modules/agents/src/tools/discovery.ts`
  - `modules/agents/src/tools/policy.ts`
  - `modules/agents/src/agent.ts`
- Changes:
  - Bootstrap tools: discover/load skill/tool, approval, async status.
  - Lazy schema loading.
  - Deny-by-default por skill/risk/permission.
- Acceptance:
  - Tool perigosa não aparece antes de descoberta/aprovação.
  - Evals de boundary passam.

### PR 5 — Approval and receipt primitives

- Files:
  - `modules/agents/src/tools/approval.ts`
  - `modules/platform/src/router/approvals.ts` ou módulo owner equivalente
  - UI shared approval components
- Changes:
  - Criar requests de aprovação.
  - OpenUI `ApprovalPanel` e `ReceiptCard`.
- Acceptance:
  - AI consegue pedir aprovação e receber status sem executar side effect.

### PR 6 — Semantic layer v1

- Files:
  - `core/database/src/schemas/semantic.ts`
  - `modules/semantic/src/*` ou `modules/agents/src/context/*`
- Changes:
  - `concepts`, `metrics`, `entity_nodes`, `entity_edges`.
  - ContextPack builders para relationships/finance/workflows.
- Acceptance:
  - AI usa ContextPack para party/finance summary sem query arbitrária.

### PR 7 — Inbox as cross-domain operations hub

- Files:
  - `core/database/src/schemas/inbox.ts`
  - `modules/inbox/src/*`
  - `apps/web/src/routes/.../inbox/*`
- Changes:
  - Inbox item vinculado a `businessEventId`, `subjectType`, `subjectId`, `riskTier`, `suggestedActions`.
- Acceptance:
  - Evento de domínio cria pendência demonstrável.

### PR 8 — Contracts module skeleton

- Files:
  - `modules/contracts/package.json`
  - `modules/contracts/src/router/*`
  - `core/database/src/schemas/contracts.ts`
  - router agregador oRPC
- Changes:
  - `contracts`, `contract_items`, `contract_terms`, status e events.
- Acceptance:
  - CRUD contrato básico ligado a party e event spine.

### PR 9 — PlateJS Contract Writer MVP

- Files:
  - `apps/web/package.json`
  - `apps/web/src/routes/.../contracts/*`
  - `packages/ui/src/components/editor/*` se aplicável
  - `modules/contracts/src/router/documents.ts`
- Changes:
  - Adicionar PlateJS dependencies via catalog.
  - Editor com document versions e save.
  - AI panel stub conectado a TanStack AI.
- Acceptance:
  - Criar/editar versão de contrato e salvar snapshot.

### PR 10 — Contract AI tools

- Files:
  - `modules/agents/src/tools/contracts.ts`
  - `modules/contracts/src/services/extraction.ts`
- Changes:
  - `generate_draft`, `rewrite_selection`, `analyze_document`, `extract_terms`.
  - Suggestions com evidence ranges.
- Acceptance:
  - AI gera draft e extrai termos com evidência; não ativa billing automaticamente.

### PR 11 — Billing primitives skeleton

- Files:
  - `core/database/src/schemas/billing.ts`
  - `modules/billing/src/router/*`
- Changes:
  - catalog/service/product/price/subscription/invoice/usage/meter base.
- Acceptance:
  - Criar invoice draft a partir de contract terms em preview.

### PR 12 — Contract-to-billing DBOS workflow

- Files:
  - `modules/contracts/src/workflows/activate-contract.ts`
  - `modules/billing/src/workflows/create-subscription.ts`
  - worker setup
- Changes:
  - Workflow durável para ativação aprovada.
- Acceptance:
  - Aprovação ativa contrato e cria billing records com receipt/eventos.

### PR 13 — Payments adapter and provider ledger

- Files:
  - `modules/payments/src/*`
  - `core/database/src/schemas/payments.ts`
- Changes:
  - PaymentProvider interface.
  - AbacatePay adapter spike.
  - Webhook ledger/idempotência.
- Acceptance:
  - Invoice gera payment intent; webhook mapeia para event sem corromper domínio.

### PR 14 — Fiscal engine foundation

- Files:
  - `modules/fiscal/src/*`
  - `core/database/src/schemas/fiscal.ts`
- Changes:
  - Certificado metadata/vault interface.
  - Fiscal schema registry.
  - XML builder/validator PoC.
  - SEFAZ status service homologação.
- Acceptance:
  - Consulta status SEFAZ em homologação e persiste request/response.

### PR 15 — Fiscal DFe Inbox

- Files:
  - `modules/fiscal/src/workflows/dfe-distribution.ts`
  - `modules/inbox/src/*`
- Changes:
  - Importar/armazenar DFe e criar pendências.
- Acceptance:
  - DFe recebido vira Inbox item com sugestão de vínculo.

### PR 16 — Automation event-based v2

- Files:
  - `modules/workflows/src/*`
- Changes:
  - Triggers por `business_events`.
  - Templates cross-domain.
  - Approval/wait node limitado.
- Acceptance:
  - Workflow dispara por invoice overdue ou fiscal rejected.

### PR 17 — Open Finance staging/reconciliation

- Files:
  - `modules/integrations/src/open-finance/*`
  - `modules/finance`/`modules/cashbook` reconciliation
- Changes:
  - External transactions staging.
  - Matching suggestions.
  - Approval apply.
- Acceptance:
  - Transação externa sugere conciliação com invoice/payment/transaction.

### PR 18 — PostHog Prompts/Evals operationalization

- Files:
  - `core/posthog/src/*`
  - `modules/agents/src/harness/*`
  - eval fixtures
- Changes:
  - Prompt version metadata on runs.
  - Production eval hooks.
  - Evalite CI harness calling real TanStack AI path.
- Acceptance:
  - Runs têm prompt/model/tool versions e evals básicas.

### PR 19 — Extensions/SDK foundation only after demand

- Files:
  - `modules/extensions/src/*`
- Changes:
  - API keys, outbound webhooks, extension manifest.
- Acceptance:
  - Sem marketplace/verticalização antes de parceiro/cliente real.

## Dependencies

- PR 1 é base para PRs 2, 5, 7, 12, 13, 14, 16.
- PR 3 precede PR 4, 10 e 18.
- PR 5 precede qualquer write financeiro/fiscal/billing via AI.
- PR 6 melhora PR 4/10/16, mas pode começar em paralelo ao PR 8.
- PR 8 precede PR 9/10/12.
- PR 11 precede PR 12/13.
- PR 14 precede PR 15 e emissão fiscal real.
- PR 16 depende de event spine e workflows v1 estável.

## Risks and decisions needed

1. **Escopo fiscal próprio é grande.** Começar por certificado/schema/status/homologação, não prometer emissão completa em produção cedo.
2. **NFS-e municipal é fragmentado.** Implementar NFS-e Nacional primeiro; adapters municipais apenas com cliente real.
3. **PlateJS dependency/catalog.** Precisa decidir catalog/dependency strategy e component ownership em `apps/web` vs `packages/ui`.
4. **Skill naming migration.** Atual `financeiro` deve migrar para `finance` com compatibilidade ou alias.
5. **Event schema versioning.** Definir padrão antes de muitos eventos nascerem.
6. **Approval UX.** Sem boa UX de aprovação/receipt, AI writes ficam perigosos e confusos.
7. **Postgres-only retrieval.** Confirmar ParadeDB/pgvector disponibilidade antes de prometer hybrid retrieval avançado.
8. **Provider webhooks.** Webhook raw payload pode exigir estratégia de storage/file se payload grande/sensível.
9. **Legal positioning.** Análise de contrato deve ser operacional/financeira, não parecer jurídico.
10. **AI evals.** Não usar LLM judge para números, pagamentos ou fiscal correctness.

## Final architecture in one diagram

```text
Surfaces
  Web app routes + Inbox + PlateJS Contract Writer + Montte AI shell + Tauri bridge

Montte AI
  TanStack AI single loop
  PostHog Prompts/Evals
  skill contracts
  lazy tool discovery
  OpenUI previews/receipts

Capability APIs
  oRPC routers per module
  typed tools per skill
  approval gates

Process Runtime
  DBOS workflows for durable business processes
  pg-boss for operational async jobs
  event outbox for fan-out

System of Record
  Postgres schemas
  business_events
  audit_entries
  provider ledgers
  semantic layer
  entity graph and retrieval in Postgres

Domains
  Relationships -> Contracts -> Catalog/Billing -> Payments/Fiscal -> Finance -> Inbox/Automation -> Integrations
```
