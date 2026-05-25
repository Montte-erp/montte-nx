# Deep research — ERP AI-native, billing primitives e roadmap Montte

Data: 2026-05-25  
Escopo: ERPs AI-native, plataformas de billing como Autumn e Polar.sh, camada brasileira de pagamentos/fiscal/Open Finance/CRM, estado atual do Montte e roadmap integrado.

## Resumo executivo

Montte já tem a tese certa no próprio produto: **Autumn + Rillet para o Brasil**. O lado Autumn é a camada de recorrência/billing dev-facing; o lado Rillet é o ERP financeiro/ops AI-native. A pesquisa reforça que o caminho mais forte não é criar “um ERP genérico com chat”, nem plugar Autumn/Polar como dependência principal. O caminho é construir, em Postgres e oRPC, as **primitivas canônicas de operação recorrente**:

```text
clientes/fornecedores
  -> contratos
  -> serviços/produtos/preços
  -> assinaturas/itens/uso/benefícios
  -> invoices/cobranças/pagamentos
  -> fiscal/documentos/certificados
  -> financeiro/conciliação
  -> workflows/eventos
  -> Montte AI como camada de intenção, explicação, preview e automação governada
```

Decisão central: **billing é domínio do Montte, payment provider é adapter**. AbacatePay pode ser o primeiro provider de PIX/boleto/checkout, mas não deve ser fonte de verdade de assinatura, contrato, entitlement, invoice ou estado do cliente. O mesmo vale para Stripe, Polar, Autumn ou qualquer provider futuro.

A arquitetura AI-native precisa ter três propriedades:

1. **Sistema de registro determinístico:** Postgres, Drizzle, oRPC, DBOS/pg-boss, audit log e procedures tipadas.
2. **Sistema de contexto:** skills, references, histórico, eventos de negócio, evidência e PostHog traces/evals.
3. **Sistema de ação governada:** preview → aprovação → workflow/job/procedure → receipt → reconciliação.

## O que Montte tem hoje

### Observações verificadas no repositório

- `README.md` diz explicitamente que Montte é “a camada de billing que falta no SaaS brasileiro” e usa a régua mental **Autumn + Rillet**.
- `PRODUCT.md` define recorrência como sistema: cliente, serviço, uso, benefício, contrato, financeiro, inadimplência e ação.
- `core/database/src/schema.ts` exporta hoje schemas ativos de agents/auth/bank-accounts/categories/cards/inbox/reports/relationships/workflows/settings/tags/threads/messages/transactions. Não exporta billing/services/prices/meters/subscriptions/invoices como fonte ativa.
- `core/database/src/schemas/relationships.ts` tem `relationships.parties` com `customer | supplier`, `person | company`, nome, documento, email, telefone e arquivamento.
- `core/database/src/schemas/transactions.ts` já suporta `relationshipId`, `paymentMethod` incluindo PIX/boleto/cartões/transferência, status `pending | paid | cancelled`, vencimento, pago em, recorrência, parcelas e itens de transação.
- `modules/relationships/src/router/index.ts` suporta CRUD de clientes/fornecedores, lookup de CNPJ e bloqueia exclusão quando há transação vinculada.
- `modules/workflows` existe, mas o v1 é estreito: agendamento de relatórios e runtime DBOS, ainda sem eventos de negócio gerais, webhooks, ações de cobrança, aprovação ou integração.
- `modules/agents` existe com TanStack AI, PostHog prompts e tools de leitura financeira; skill catalog atual tem basicamente `financeiro`.
- `apps/web/src-tauri/tauri.conf.json` indica shell desktop Tauri existente, mas ainda sem integração real com dispositivo físico.
- Não há módulos fonte ativos para `billing`, `contracts`, `products`, `inventory`, `payments`, `vault`, `fiscal`, `nfe`, `open-finance`, `integrations` ou `extensions`.
- `apps/web/package.json` ainda não declara PlateJS/Slate como dependência ativa; a integração de Contract Writer exigirá adicionar os pacotes PlateJS necessários ao catálogo/workspace.

### Inferência

O Montte tem uma boa base financeira e de relacionamento, mas o próximo ciclo grande deve criar a ponte que falta: **relationship → contract → billing → payment/fiscal/finance**. Sem essa ponte, AI-native vira apenas chat sobre transações existentes; com essa ponte, AI-native vira operação recorrente assistida.

## Pesquisa: ERPs AI-native

### Rillet como norte de produto financeiro

Rillet posiciona ERP financeiro AI-native em torno de **continuous close**: transações processadas quando chegam, bills/invoices gerando schedules e lançamentos, reconciliação contínua, anomalias/accruals sinalizados por IA e fechamento diário em vez de fechamento mensal tardio. A lição para Montte não é copiar um GL enterprise completo agora; é trazer o princípio para PMEs brasileiras:

- pendências aparecem no Inbox quando ainda são pequenas;
- cobranças, invoices, recebimentos e transações ficam ligadas por evidência;
- o usuário aprova correções antes de o financeiro ser alterado;
- a IA explica diferenças, inconsistências e próximos passos;
- cada ação deixa receipt e trilha de auditoria.

### SAP AI-native North Star / Process Layer

A arquitetura AI-native da SAP diferencia o ERP tradicional como sistema de registro e uma camada AI-native como sistema de contexto/processo. O ponto útil para Montte é o padrão de **capability providers**: módulos expõem APIs, eventos e ferramentas governadas; agentes/skills consomem essas capacidades sem mexer diretamente em telas ou banco.

Tradução para Montte:

```text
Módulo Montte
  schema Postgres
  oRPC procedures
  eventos de negócio
  jobs/workflows
  AI tools allowlisted
  OpenUI previews/receipts
  evals e audit
```

### NetSuite, Korp Brain e mercado

NetSuite Next e SuiteCloud Agent Skills reforçam duas ideias: AI como interface operacional com citações/fontes, e skills como pacotes governados de instruções, referências e guardrails. Korp Brain é o exemplo brasileiro de ERP autônomo com “colaboradores virtuais”, validação humana e conexão com WhatsApp/e-mail/planilhas. Para Montte, o insight de UX é forte, mas a implementação deve preservar a decisão já tomada: **um Montte AI único com skills internas**, não vários agentes expostos ao usuário.

### Princípio extraído

AI-native ERP não significa “o modelo decide e escreve no banco”. Significa:

```text
intenção em linguagem natural
  -> contexto correto
  -> plano estruturado
  -> preview com evidência
  -> aprovação quando necessário
  -> execução determinística
  -> receipt/audit
  -> observação contínua
  -> recuperação quando falha
```

## Pesquisa: billing primitives — Autumn, Polar.sh e Stripe

### Autumn

Autumn é uma camada open-source de pricing/billing entre a aplicação e Stripe. O modelo público é útil porque organiza billing como pipeline:

```text
features
  -> plans
  -> plan items
  -> subscriptions
  -> balances/entitlements
```

A app consulta se o cliente pode fazer algo (`check`) e registra uso (`track`). A lição é que Montte precisa ter **entitlements/balances** como primitiva própria, não apenas faturas e pagamentos.

### Polar.sh

Polar organiza usage billing como:

```text
usage events
  -> meters
  -> metered prices
  -> products
  -> charges/subscriptions
  -> webhooks/customer portal
```

A lição é que o Montte deve guardar eventos de uso append-only primeiro em Postgres, depois agregar/cobrar/reconciliar. Meters são definições de agregação, não só colunas soltas.

### Stripe Billing como referência madura

Stripe Billing tem produtos, preços, assinaturas, usage meters, entitlements, customer portal e webhooks. A lição não é usar Stripe como core, mas copiar o padrão de integração: provider objects são mapeados para objetos internos, webhooks são ledger de integração, e o domínio interno não depende do provider.

### Modelo recomendado para Montte

```text
relationships.parties
  cliente/fornecedor mestre

contracts
  acordo de negócio, vigência, escopo, termos, obrigações, dados fiscais

billing catalog
  serviços, produtos, features, planos, preços, regras

entitlements
  benefícios, permissões, limites, saldos, créditos, estado efetivo do cliente

usage
  eventos append-only, meters, agregados por ciclo

billing lifecycle
  assinaturas, itens, invoices, linhas, status, vencimento

payments
  payment intents, charges, provider accounts, webhooks, reconciliação

finance
  contas a receber/pagar/transações/baixa/conciliação
```

## Pesquisa: camada brasileira — pagamentos, fiscal, Open Finance, CRM e workflows

### AbacatePay

AbacatePay é um bom primeiro provider brasileiro porque cobre checkout, PIX transparente, boleto e webhooks. Mas ela deve entrar como `PaymentProvider`, não como billing core.

Provider abstraction inicial:

```text
PaymentProvider
  createCheckout(invoiceId)
  createTransparentPix(invoiceId)
  cancelPaymentIntent(providerPaymentId)
  parseWebhook(headers, rawBody)
  mapProviderStatusToDomainStatus(status)
```

Requisitos obrigatórios:

- armazenar webhook raw;
- verificar assinatura/HMAC quando suportado;
- idempotência;
- comparar valor/currency/status/provider id;
- reconciliar contra invoice/payment intent interno;
- nunca marcar invoice como paga só porque o modelo disse.

### Fiscal: certificados, NFe/NFSe, DFe inbound e CNPJ

Atualização de decisão: a preferência é **não depender de API fiscal externa para NF-e/NFSe se for viável**. Isso muda a recomendação: NFe.io, Focus NFe e TecnoSpeed/PlugNotas viram referências, fallback temporário ou benchmark de comportamento, não a arquitetura-alvo. A arquitetura-alvo passa a ser um **Fiscal Engine próprio** do Montte, falando diretamente com SEFAZ/Ambiente Nacional quando tecnicamente possível.

A primeira etapa de menor risco continua incremental:

1. metadados fiscais da empresa e party;
2. vault para certificado A1 e política para A3/local quando necessário;
3. motor XML/schema/assinatura/validação interno;
4. status service e homologação por UF/autorizador;
5. DFe inbound/distribuição e Inbox fiscal;
6. emissão NF-e/NFC-e;
7. NFS-e Nacional;
8. NFS-e municipal fora do padrão nacional só sob demanda real.

Certificado digital é feature de vault/regulatória. O agente nunca deve acessar segredo/certificado; ele pode apenas alertar expiração, explicar status e preparar ações.

### Open Finance

Pluggy e Polp-like providers devem entrar como adapters para contas, cartões e transações. Open Finance não substitui livro-caixa; é fonte externa para importação/reconciliação.

Pipeline recomendado:

```text
consentimento/conexão
  -> external accounts
  -> external transactions
  -> normalização
  -> staging/import inbox
  -> matching com bank account/transaction/invoice/payment
  -> sugestões AI com confidence/evidência
  -> aprovação/baixa/conciliação
```

Cuidado: dados de contraparte podem ser incompletos; IA deve trabalhar com confiança e evidência, não promessa de categorização perfeita.

### Twenty, PostHog e comunicação

Twenty é bom como CRM externo confirmado porque tem API, webhooks e workflows. Montte deve sincronizar por eventos, não por chamada síncrona em tela crítica.

PostHog Workflows/CDP é bom para comunicação de produto, onboarding, lifecycle e e-mails/growth. Não deve ser fonte de verdade financeira. Para cobranças críticas, usar workflow interno auditável no Montte ou notification module com receipt.

### Desktop e mundo físico

Tauri deve ser bridge para capacidades físicas reais quando houver demanda:

- certificado A3, se necessário;
- impressora fiscal/etiqueta;
- scanner;
- leitor/balança;
- pasta local monitorada;
- integração com dispositivos de loja/farmácia/mercado.

Não deve virar segundo produto. É extensão controlada do web app.


## Pricing do Montte: Free + PAYG + addon único

Decisão adicionada: Montte deve ter um modelo inspirado no PostHog, com **Free generoso**, **pay-as-you-go** e **um addon único de R$ 400/mês**. Não criar billing público real antes de integrar AbacatePay como primeiro provider, porque a meta é usar o próprio Montte para cobrar o Montte.

Modelo:

```text
Free
  sem cartão
  suficiente para founder testar operação real
  limites claros e generosos

Pay-as-you-go
  cobra uso acima do free allowance
  mantém allowance gratuito mensal
  exige spending limits/alerts

Addon R$ 400/mês
  opcional
  capacidades avançadas
  subscription item fixo
```

Gate obrigatório:

```text
AbacatePay integrado
  -> provider ledger/idempotência
  -> invoices/subscriptions/usage no billing interno
  -> cobrança real do Montte via Montte
  -> webhook pago/falhou alimenta finance/inbox/audit
```

Se Montte ainda não consegue cobrar o próprio Montte usando `modules/billing` + `modules/payments` + AbacatePay, o billing público ainda deve ficar em modo preview/sandbox.

## Arquitetura alvo: ERP + billing + AI-native em Postgres

Constraint assumida: **somente Postgres como banco**. Sem vector DB, graph DB, search DB, billing DB ou integration DB separado.

```text
Postgres
  schemas
    relationships
    contracts
    billing
    payments
    fiscal
    open_finance
    integrations
    workflows/platform
    agents
    finance

  ledgers/eventos
    business_events
    provider_webhook_events
    usage_events
    audit_events
    agent_trajectory_events

Runtime
  oRPC: contratos/procedures de domínio
  Drizzle: schema e queries
  DBOS: workflows duráveis de negócio
  pg-boss: jobs operacionais/retries/DLQ
  TanStack AI: loop conversacional e tool calls
  PostHog: prompts, traces, analytics, evals subjetivos
  OpenTelemetry/logs: operação e debugging

UX
  TanStack Start
  assistant-ui/AG-UI
  OpenUI cards/previews/receipts
  tabelas/forms/sheets determinísticos
```

## Modelo de domínio proposto

### `relationships` — clientes e fornecedores

Evoluir `parties` sem explodir escopo:

- endereço estruturado;
- contatos adicionais;
- dados fiscais mínimos: IE/IM, CNAE, regime quando disponível;
- status cadastral, origem, score de completude;
- timeline/eventos;
- vínculo com contratos, invoices, transações, documentos fiscais.

AI-native:

- criar/atualizar party via CNPJ com preview;
- detectar duplicados;
- explicar pendências cadastrais;
- sugerir enrich/normalização;
- preparar contrato a partir do cadastro.

### `contracts` — ponte entre relação e recorrência

Contracts devem vir antes de billing avançado porque são a linguagem de negócio.

Tabelas iniciais:

```text
contracts.contracts
contracts.contract_items
contracts.contract_terms
contracts.contract_events
contracts.contract_attachments
```

Campos conceituais:

- partyId;
- tipo: serviço, produto, misto, fornecedor;
- status: draft, active, paused, ended, cancelled;
- vigência;
- periodicidade de cobrança;
- termos de reajuste;
- moeda;
- dados fiscais/pagamento;
- anexos;
- approval state.

AI-native:

- rascunhar contrato simples;
- transformar conversa/documento em termos estruturados;
- comparar contrato vs cobrança gerada;
- listar contratos sem cobrança, vencendo ou divergentes;
- sugerir alteração com preview.

#### Contract Writer: PlateJS + TanStack AI

Para contratos, a melhor UX não é só formulário nem só chat. O formato recomendado é um **editor rich-text AI-native** usando PlateJS no front-end e TanStack AI no backend/harness. PlateJS traz o editor, seleção por bloco, comments/suggestions, streaming de Markdown/MDX e affordances de revisão; TanStack AI continua sendo o runtime oficial do Montte para geração, análise, tools, structured outputs, telemetry e policy.

Arquitetura:

```text
Contract Workspace
  left/main: PlateJS editor
  right/side: Montte AI contract panel
  top: status, versão, aprovação, assinatura, vínculo com cliente/contrato
  bottom/inline: suggestions, comments, riscos e placeholders

TanStack AI endpoints/tools
  contract.generate_draft
  contract.rewrite_clause
  contract.summarize
  contract.extract_terms
  contract.detect_risks
  contract.compare_versions
  contract.link_terms_to_billing
  contract.prepare_approval
```

Fluxos principais:

1. **Escrever contrato novo**
   - usuário escolhe cliente/fornecedor, tipo de serviço/produto e template;
   - Montte AI gera estrutura inicial como Markdown/Plate nodes;
   - Plate mostra streaming/preview;
   - usuário aceita, edita ou rejeita.

2. **Reescrever cláusula selecionada**
   - usuário seleciona trecho/bloco;
   - ação “melhorar”, “deixar mais objetivo”, “adaptar para recorrência”, “adicionar SLA”;
   - AI retorna sugestão como diff/suggestion, não sobrescreve direto.

3. **Analisar contrato existente**
   - upload/import PDF/DOCX/Markdown ou colar texto;
   - parser transforma em texto/nodes;
   - AI extrai partes, valores, vigência, reajuste, multa, SLA, rescisão, dados fiscais e obrigações;
   - resultado vira `contract_terms` estruturado com evidência por trecho.

4. **Contrato → billing**
   - AI identifica termos cobraveis: recorrência, valor, reajuste, uso, franquia, multa, vencimento;
   - mostra preview de `contract_items`, `prices`, `subscription_items` e `invoice_schedule`;
   - só cria billing real após aprovação.

5. **Revisão e risco**
   - comentários/suggestions no Plate;
   - flags: cláusula ausente, valor ambíguo, vencimento indefinido, multa sem regra, SLA sem métrica, reajuste sem índice, dados fiscais incompletos;
   - nunca apresentar como “parecer jurídico”; tratar como análise operacional/financeira.

Modelo de dados adicional:

```text
contracts.contract_documents
  id, teamId, contractId, title, format, currentVersionId, status

contracts.contract_document_versions
  id, documentId, plateValue/json, markdownSnapshot, textSnapshot, createdBy, createdAt

contracts.contract_extracted_terms
  id, contractId, versionId, termType, value, confidence, sourceRange, evidenceText

contracts.contract_suggestions
  id, documentId, versionId, type, status, sourceRange, proposedPatch, rationale

contracts.contract_comments
  id, documentId, versionId, sourceRange, authorId, body, status
```

Regra importante: o documento editável e o contrato estruturado são coisas diferentes. O PlateJS guarda a redação/versionamento; `contracts`/`billing` guardam os termos executáveis. O agente pode sugerir a ponte, mas a ativação de contrato e criação de cobrança continuam passando por preview/aprovação/procedure.

### `billing` — primitives inspiradas em Autumn/Polar

Tabelas iniciais:

```text
billing.products
billing.services
billing.features
billing.plans
billing.plan_items
billing.prices
billing.subscriptions
billing.subscription_items
billing.entitlement_balances
billing.usage_events
billing.meters
billing.meter_aggregates
billing.invoices
billing.invoice_lines
```

Ordem de implementação:

1. serviço/produto e preço fixo recorrente;
2. invoice preview;
3. assinatura simples derivada de contrato;
4. entitlement boolean/non-consumable;
5. uso medido;
6. overage/créditos;
7. customer state agregado.

`customers.state` interno deve responder em uma chamada:

```text
cliente
contratos ativos
assinaturas
invoices abertas/vencidas/pagas
benefícios/limites
uso do ciclo
status de pagamento
pendências operacionais
últimos eventos
```

### `payments` — provider abstraction + AbacatePay

Tabelas iniciais:

```text
payments.provider_accounts
payments.payment_intents
payments.charges
payments.provider_object_mappings
payments.provider_webhook_events
payments.reconciliation_events
```

Fluxo:

```text
invoice aprovada
  -> create payment intent
  -> AbacatePay checkout/PIX
  -> webhook raw salvo
  -> validação/idempotência
  -> status de charge atualizado
  -> invoice paid/partially_paid/failed/expired
  -> transação financeira ou conta a receber atualizada
  -> receipt
```

AI-native:

- “crie uma cobrança PIX para este contrato” gera preview;
- usuário aprova;
- procedure cria invoice/payment intent;
- provider retorna QR code/link;
- OpenUI mostra cobrança e receipt;
- webhook fecha o ciclo.

### `vault`

Vault precisa existir antes de certificados digitais e integrações sensíveis.

Primitivas:

```text
vault.secrets
vault.secret_versions
vault.secret_access_events
vault.provider_credentials
vault.digital_certificate_refs
```

Mesmo que storage físico use serviço seguro/criptografia externa, a governança fica em Postgres: owner, scope, version, status, expiresAt, audit.

### `fiscal` — Fiscal Engine próprio, sem API fiscal externa por padrão

Tabelas iniciais:

```text
fiscal.companies
fiscal.digital_certificates
fiscal.fiscal_documents
fiscal.fiscal_document_events
fiscal.dfe_inbound_documents
fiscal.sefaz_authorizers
fiscal.sefaz_endpoints
fiscal.sefaz_requests
fiscal.sefaz_responses
fiscal.fiscal_schemas
fiscal.fiscal_validation_rules
fiscal.tax_profiles
```

Componentes técnicos:

```text
FiscalEngine
  XmlBuilder
  XmlSchemaValidator
  XmlSigner / XMLDSig
  CertificateManager
  SefazSoapClient
  NFeAccessKeyGenerator
  NFeAuthorizationFlow
  NFeEventFlow
  DFeDistributionFlow
  DanfeRenderer
  ContingencyPolicy
  FiscalAuditLog
```

Ordem sugerida:

1. CNPJ enrichment melhorado;
2. fiscal profile de empresa/party;
3. certificado A1/vault metadata;
4. biblioteca interna de XML NF-e/NFC-e com schemas oficiais versionados;
5. assinatura XMLDSig com certificado ICP-Brasil;
6. client SOAP SEFAZ por autorizador/UF, começando por status service e homologação;
7. fluxo de autorização NF-e/NFC-e em homologação;
8. eventos: cancelamento, carta de correção, inutilização, manifestação do destinatário;
9. DFe inbound/distribuição;
10. DANFE;
11. NFS-e Nacional;
12. NFS-e municipal fora do padrão nacional apenas por demanda real.

AI-native:

- alertar certificado vencendo;
- explicar rejeição fiscal;
- sugerir correção;
- cruzar NF recebida com fornecedor/transação/contrato;
- preparar lançamento, mas exigir aprovação.

### `open_finance`

Tabelas:

```text
open_finance.provider_connections
open_finance.external_accounts
open_finance.external_transactions
open_finance.sync_cursors
open_finance.reconciliation_candidates
open_finance.consent_events
```

AI-native:

- sugerir match com invoice/transaction;
- explicar divergência de valor/data/taxa;
- criar regras de categorização propostas;
- mostrar confidence e evidências.

### `integrations`

Kernel genérico:

```text
integrations.providers
integrations.connections
integrations.external_id_mappings
integrations.webhook_events
integrations.sync_jobs
integrations.sync_cursors
integrations.dead_letters
```

Twenty e PostHog devem usar esse kernel.

### `extensions`

Não começar com marketplace. Começar com framework para verticalização sob demanda.

```text
extension manifest
permissions
schema migrations controladas
routes/ui slots
orpc procedures
workflow templates
agent references/skills
provider connections
observability/evals
```

Mercado/farmácia/etc. só com parceiro e demanda real.

## Como implementar NFe/NFSe própria sem virar buraco negro

Implementar fiscal próprio é possível, mas deve ser tratado como produto de infraestrutura regulatória, não como “integração rápida”. O escopo precisa ser fatiado.

### NF-e/NFC-e própria — recorte técnico

```text
1. Documentos oficiais
   MOC NF-e/NFC-e, notas técnicas, schemas XML, tabela de webservices, regras de validação.

2. Certificado
   upload/import A1, armazenamento seguro, expiração, rotação, uso para assinatura e autenticação TLS quando aplicável.

3. XML
   builder tipado por versão, access key, totais, itens, impostos, destinatário, transporte, pagamento.

4. Validação
   XSD oficial + validações de domínio antes de transmitir.

5. Assinatura
   XMLDSig/canonicalization correta no elemento exigido pela NF-e.

6. Comunicação SEFAZ
   SOAP clients por autorizador/UF/ambiente: status, autorização, recibo/protocolo, consulta, inutilização, eventos.

7. Persistência
   XML enviado, XML autorizado, protocolo, status, cStat/xMotivo, retries, correlation id, ambiente, versão schema.

8. Eventos
   cancelamento, carta de correção, manifestação, inutilização, distribuição DFe.

9. DANFE
   renderer próprio ou biblioteca interna auditada, sempre derivado do XML autorizado.

10. Operação
   homologação, contingência, retry, rate limits, monitoramento de disponibilidade SEFAZ.
```

### NFS-e própria — cautela maior

NFS-e é mais fragmentada. O Sistema Nacional NFS-e reduz parte do problema com APIs nacionais, mas municípios fora/atrasados no padrão ainda criam variações. Recomendação:

1. Implementar **NFS-e Nacional** primeiro, usando documentação oficial do gov.br.
2. Não prometer cobertura municipal universal no começo.
3. Para município fora do padrão nacional, só implementar adapter quando houver cliente real e volume.
4. Manter interface interna `FiscalDocumentIssuer`, mas com implementação própria como default.

### Roadmap fiscal próprio

| Etapa | Entrega | Ambiente | Critério de saída |
|---|---|---|---|
| F0 | fiscal docs watcher | pesquisa/docs | lista versionada de MOC, NTs, XSDs, endpoints |
| F1 | vault/certificado A1 | local/test | importar certificado, validar expiração, assinar payload teste |
| F2 | XML builder + XSD | local | XML NF-e mínimo validando contra schema oficial |
| F3 | status service SEFAZ | homologação | consulta status por UF/autorizador com certificado |
| F4 | autorização NF-e mínima | homologação | NF-e autorizada em homologação e XML/protocolo persistidos |
| F5 | eventos essenciais | homologação | cancelamento/inutilização/consulta funcionando |
| F6 | DFe inbound | homologação/prod controlado | documentos recebidos viram Inbox fiscal |
| F7 | produção controlada | produção | 1 UF + 1 tipo de operação + cliente piloto |
| F8 | NFS-e Nacional | homologação/prod controlado | emissão/cancelamento no padrão nacional |

### O que ainda pode usar API externa

Mesmo com engine própria, pode fazer sentido usar APIs externas temporariamente para:

- consulta/enriquecimento CNPJ quando a fonte pública for suficiente;
- benchmark de XML/status contra um provider;
- fallback operacional em município NFS-e fora do padrão nacional;
- validação paralela durante piloto.

Mas a fonte de verdade continua no Montte/Postgres, e a arquitetura-alvo não depende do provider.

## AI-native por camada

### Skills iniciais

```text
skill.relationships
skill.contracts
skill.billing
skill.payments
skill.fiscal
skill.open_finance
skill.integrations
skill.extensions
skill.finance
skill.automation
```

Ainda deve existir **um Montte AI único** na UX. Skills são internas.

### Tools exemplos

```text
relationships.lookup_cnpj
relationships.preview_create_party
relationships.detect_duplicates

contracts.draft_contract
contracts.preview_contract_change
contracts.activate_contract

billing.preview_invoice
billing.explain_customer_state
billing.record_usage_event
billing.preview_plan_change

payments.create_payment_checkout
payments.create_pix_charge
payments.reconcile_provider_webhook

fiscal.check_certificate_status
fiscal.preview_issue_invoice
fiscal.explain_fiscal_rejection
fiscal.match_dfe_to_transaction

open_finance.sync_account
open_finance.suggest_reconciliation
open_finance.explain_cash_gap

integrations.preview_twenty_sync
integrations.retry_failed_webhook
```

### Risco por ação

| Ação | Risco | Política |
|---|---:|---|
| Buscar CNPJ | baixo/médio | tool read/provider, cache/audit |
| Criar cliente rascunho | médio | preview + validação |
| Ativar contrato | alto | aprovação |
| Gerar invoice | alto | preview + aprovação |
| Criar cobrança PIX | alto | aprovação + idempotência |
| Marcar pago | crítico | somente webhook/procedure/reconciliação, nunca LLM direto |
| Emitir NF-e/NFS-e | crítico | preview + aprovação + provider + audit |
| Baixar/usar certificado | crítico | agente sem acesso ao segredo |
| Conectar Open Finance | alto | consentimento explícito |
| Conciliar transação | alto | confidence + aprovação |

## Roadmap recomendado

### Ordem global de prioridade

1. **Bugs e integridade de dados** — prioridade máxima sempre.
2. **Fundação AI-native/governança** — audit, events, approval, workflows, tool policy.
3. **Clientes/fornecedores polidos** — dados mestre confiáveis.
4. **Contratos** — ponte de negócio.
5. **Billing primitives + serviços/produtos leves** — cobrança recorrente real.
6. **Payments v1 com AbacatePay** — PIX/boleto/checkout/webhooks. Billing real do próprio Montte só depois deste gate.
7. **Vault + fiscal/CNPJ/DFe** — compliance local.
8. **Open Finance** — sync e conciliação.
9. **Integrações Twenty/PostHog** — fluxo comercial/comunicação.
10. **Extensions/SDK** — verticalização por demanda.
11. **Melhorias gerais por demanda real.**
12. **UX média prioridade; UI visual por último**, exceto quando bloquear fluxo.

### Fase 0 — limpeza, source-of-truth e base AI-native

Objetivo: preparar o chão antes de expandir domínio.

Entregas:

- Resolver mismatch entre README e source: billing schemas citados em README existem só como dist/stale ou direção; decidir restaurar ou redesenhar.
- Criar `business_events` Postgres:
  - `party.created`
  - `contract.activated`
  - `invoice.approved`
  - `payment.confirmed`
  - `fiscal_document.received`
  - `open_finance.transaction_synced`
- Criar `provider_webhook_events` genérico ou por provider.
- Criar padrão de audit/receipt.
- Expandir workflows para event triggers e actions tipadas, ainda com escopo pequeno.
- Implementar approval gate reutilizável.
- Formalizar skills/references por domínio.

Não fazer ainda:

- marketplace de extensões;
- fiscal full;
- Open Finance full;
- cobrança usage-based complexa;
- app desktop com device real.

### Fase 1 — Clientes e fornecedores → contratos

Base no esboço: “Clientes e fornecedores -> contratos -> rodada de polimento -> deixar ai native”.

Entregas:

- Polir `relationships`:
  - endereço;
  - contatos;
  - dados fiscais;
  - timeline;
  - status cadastral;
  - origem;
  - dedupe.
- Criar `modules/contracts`:
  - contracts;
  - contract items;
  - terms;
  - attachments;
  - statuses;
  - contract documents;
  - document versions;
  - extracted terms;
  - suggestions/comments.
- UI:
  - detalhe de cliente/fornecedor;
  - aba contratos;
  - Contract Writer com PlateJS;
  - painel lateral Montte AI;
  - checklist de pendências.
- AI-native:
  - criar party via CNPJ com preview;
  - rascunhar contrato;
  - reescrever cláusula selecionada;
  - analisar contrato existente;
  - extrair termos executáveis com evidência;
  - vincular termos a billing primitives;
  - detectar duplicados;
  - explicar pendências.

Critério de sucesso:

- usuário consegue cadastrar cliente/fornecedor, validar CNPJ, criar contrato simples e ver vínculo com transações existentes.

### Fase 2 — Billing primitives + serviços/produtos leves + AbacatePay

Inclui também o modelo comercial do próprio Montte: Free generoso, pay-as-you-go e addon único de R$ 400/mês. A implementação de cobrança real deve ser bloqueada até AbacatePay estar funcionando como provider.

Base no esboço: “Gestão de serviços (billing primitive igual Autumn) -> gestão de produtos e estoque (billing primitive) -> vault -> abacate pay”.

Sugestão de recorte: começar com **serviços e cobrança recorrente**, depois produto/estoque.

Entregas:

- `modules/billing`:
  - services/products;
  - prices/plans;
  - subscriptions;
  - invoices;
  - invoice lines;
  - entitlement snapshot simples;
  - customer state.
- `modules/payments`:
  - provider abstraction;
  - AbacatePay checkout/PIX;
  - webhook ingestion;
  - reconciliation;
  - payment status.
- Fluxo:
  - contrato ativo gera invoice preview;
  - usuário aprova;
  - cria cobrança;
  - webhook confirma;
  - baixa financeira/transaction ou receivable.
- AI-native:
  - criar cobrança por linguagem natural;
  - explicar status do cliente;
  - mostrar OpenUI `CustomerStateCard`, `InvoicePreview`, `PixChargeCard`, `PaymentReceipt`.

Critério de sucesso:

- cliente com contrato recorrente pode receber cobrança PIX via AbacatePay; pagamento confirmado atualiza invoice e financeiro com audit.

### Fase 3 — Produto/estoque mínimo

Não construir ERP de estoque completo cedo. Fazer só o necessário para billing/fiscal.

Entregas:

- catálogo de produto/SKU;
- unidade;
- preço/custo;
- movimentação simples;
- vínculo com invoice line;
- alerta de saldo negativo se aplicável.

AI-native:

- explicar margem por produto;
- detectar invoice sem produto/SKU;
- sugerir reposição simples.

Critério de sucesso:

- produto pode ser cobrado e, se necessário, movimentar estoque simples.

### Fase 4 — Vault + certificados + fiscal/CNPJ/NFe

Base no esboço: “Certificados digitais de parceiros -> nfe e monitorar cnpj”.

Entregas:

- `modules/vault` para referências seguras, rotação, expiração e audit.
- `modules/fiscal`:
  - fiscal company;
  - digital certificate metadata;
  - provider interface;
  - fiscal document;
  - fiscal events;
  - DFe inbound.
- Spikes com NFe.io, Focus NFe, TecnoSpeed/PlugNotas ou Nuvem Fiscal servem como benchmark/fallback, não como dependência-alvo.
- CNPJ monitoring:
  - enriquecimento cadastral;
  - status Receita;
  - alterações relevantes;
  - alerta no Inbox.

AI-native:

- explicar nota rejeitada;
- alertar certificado vencendo;
- cruzar DFe recebido com fornecedor/transação;
- preparar conta a pagar com preview.

Critério de sucesso:

- Montte consegue monitorar documentos fiscais recebidos e alimentar Inbox/financeiro com aprovação.

### Fase 5 — rodada forte de polimento e limpeza

Base no esboço: “Rodada de polimento forte e limpeza total da codebase + ai native”.

Entregas:

- Revisão dos boundaries dos módulos.
- Remover dist/stale/confusões de schema.
- Consolidar patterns de provider/webhook/job/workflow.
- Evals por domínio.
- Trajectory audit do Montte AI.
- Testes de integração para billing/payment/fiscal.
- UX de erro/recovery.

Critério de sucesso:

- a próxima rodada grande não multiplica dívida técnica.

### Fase 6 — Open Finance

Base no esboço: “Open finance (ou Pluggy ou Polp) -> polimento + ai native”.

Entregas:

- provider interface Pluggy/Polp-like;
- conexão/consentimento;
- external accounts;
- external transactions;
- sync jobs;
- staging import;
- reconciliação assistida.

AI-native:

- explicar divergência;
- sugerir match;
- criar regra de categorização proposta;
- mostrar confiança/evidência.

Critério de sucesso:

- transações bancárias reais entram com dedupe e viram sugestões/reconciliações auditáveis.

### Fase 7 — integrações confirmadas: Twenty e PostHog

Base no esboço: “CRM (Twenty confirmado), PostHog confirmado, principalmente workflows para mandar e-mails”.

Entregas:

- `modules/integrations` kernel.
- Twenty sync:
  - companies/people/opportunities ↔ parties/contracts;
  - webhooks;
  - DLQ;
  - mapping UI.
- PostHog workflows:
  - enviar eventos de lifecycle;
  - acionar e-mails/growth/onboarding;
  - webhooks controlados.
- Comunicação financeira crítica fica no Montte quando exigir audit forte.

AI-native:

- explicar falha de sync;
- sugerir mapeamento;
- criar workflow de follow-up/cobrança com aprovação.

Critério de sucesso:

- CRM e produto/analytics conversam sem virar fonte de verdade financeira.

### Fase 8 — desktop e dispositivos físicos

Base no esboço: “app desktop para integrações com dispositivos reais do mundo físico”.

Entregas sob demanda:

- comandos Tauri seguros;
- policy de permissões locais;
- integração com impressora/scanner/certificado A3/dispositivo;
- logs locais + audit remoto.

Critério de entrada:

- demanda real de cliente/vertical que não dá para resolver via web/provider.

### Fase 9 — extensions + SDK

Base no esboço: “Extensions para fluxos específicos, mercado, farmácia, parceiros; SDK com melhor DX do mercado”.

Entregas:

- extension manifest;
- permissions/capabilities;
- migrations controladas;
- oRPC extension procedures;
- workflow templates;
- UI slots;
- AI references/skill pack;
- SDK TypeScript;
- sandbox/test harness.

Estratégia:

- não construir marketplace antes de demanda;
- co-desenvolver vertical com parceiro real;
- cada extensão precisa provar valor operacional, não só “ter integração”.

Critério de sucesso:

- parceiro consegue criar fluxo vertical sem quebrar core, permissões ou AI-native governance.

## Roadmap condensado por trimestre/sprint macro

| Macro | Tema | Por quê agora | Sai com |
|---|---|---|---|
| 0 | Fundação e limpeza | evitar empilhar dívida antes do billing | events, audit, approval, workflow/action pattern |
| 1 | Relationships polish | dados mestre antes de contrato/billing | clientes/fornecedores confiáveis |
| 2 | Contracts | contrato é ponte de negócio | contratos ativos ligados a parties |
| 3 | Billing MVP | tese central do produto | serviço/preço/invoice/subscription/customer state |
| 4 | AbacatePay | primeira monetização/cobrança BR real | PIX/checkout/webhook/reconciliação |
| 5 | Fiscal/vault | Brasil como padrão | certificados, DFe, fiscal inbox |
| 6 | Open Finance | conciliação real | sync/staging/matching assistido |
| 7 | Integrations | conectar go-to-market e ops | Twenty/PostHog via integration kernel |
| 8 | Extensions/SDK | verticalização sob demanda | manifest, permissions, SDK, templates |

## O que evitar

- Não acoplar Montte a Autumn/Polar/Stripe como fonte de verdade.
- Não criar billing antes de contratos mínimos.
- Não deixar webhooks mutarem domínio sem ledger/idempotência.
- Não marcar pagamento/fiscal/baixa por decisão direta do LLM.
- Não construir estoque completo antes de validar necessidade.
- Não construir marketplace de extensões antes de parceiro real.
- Não transformar desktop em produto paralelo.
- Não criar vários agentes expostos ao usuário.
- Não adicionar outro banco: Postgres-only.

## Decisões recomendadas

1. **Manter a tese Autumn + Rillet, mas implementar primitives próprias.** Autumn/Polar/Stripe são referências de modelo, não dependências centrais.
2. **Contratos antes de billing avançado.** Contrato conecta cliente/fornecedor, serviço/produto, cobrança, fiscal e financeiro.
3. **AbacatePay primeiro como payment provider.** Bom recorte para Brasil: PIX/boleto/checkout/webhooks.
4. **Provider abstraction desde o dia 1.** Payments, fiscal, Open Finance, CRM e PostHog entram via adapters com webhook ledger.
5. **Fiscal deve mirar engine própria.** Começar por CNPJ/vault/schema/assinatura/status/homologação e DFe Inbox antes de emissão completa em produção; providers externos ficam como fallback/benchmark.
6. **Open Finance depois de billing/payment/fiscal patterns.** Precisa de sync, dedupe, reconciliation e aprovação.
7. **Extensions só com demanda real.** Framework primeiro, verticalizações depois.
8. **AI-native em todos os módulos novos.** Cada módulo novo nasce com skill/reference, tools, OpenUI preview, approval, audit e eval.
9. **Postgres-only.** Retrieval, entity graph, billing, integrations, events e audit ficam em Postgres.
10. **Bugs e integridade continuam prioridade máxima.** Roadmap novo não deve passar por cima de correções que protegem confiança.

## Fontes

### Produto/repositório Montte

- `README.md` — tese Autumn + Rillet, estado atual, ausência de `@modules/billing` ativo.
- `PRODUCT.md` — propósito, usuários, “recorrência é sistema”.
- `core/database/src/schema.ts` — schemas fonte exportados hoje.
- `core/database/src/schemas/relationships.ts` — parties clientes/fornecedores.
- `core/database/src/schemas/transactions.ts` — transações, pagamentos, vínculo com relationship.
- `modules/relationships/src/router/index.ts` — CRUD, CNPJ lookup, guard de exclusão.
- `modules/workflows/PLAN.md`, `modules/workflows/src/router.ts`, `modules/workflows/src/runtime.ts` — workflow atual e limites.
- `modules/agents/src/agent.ts`, `modules/agents/src/skills.ts`, `modules/agents/src/tools/registry.ts` — TanStack AI, skill atual e tools.
- `apps/web/src-tauri/tauri.conf.json` — shell desktop.

### ERP AI-native

- SAP AI-Native North Star Architecture — https://architecture.learning.sap.com/assets/ai-native-north-star-architecture-public-q2-2026.pdf
- SAP Executive Summary — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/executive-summary
- SAP Process Layer — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- SAP Integration/Security/Governance — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance
- Rillet Continuous Close — https://www.rillet.com/continuous-close
- Rillet Aura AI — https://www.rillet.com/product/aura-ai
- Rillet Automated General Ledger — https://www.rillet.com/product/automated-general-ledger
- Rillet Native Integrations — https://www.rillet.com/product/native-integrations
- Rillet Flexible GAAP Reporting — https://www.rillet.com/product/flexible-gaap-reporting
- NetSuite Next — https://www.netsuite.com/portal/products/netsuite-next.shtml
- NetSuite SuiteCloud Agent Skills — https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0331025334.html
- NetSuite AI Connector Service — https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_3200541651.html
- Korp Brain — https://www.korp.com.br/erp-autonomo-brain/
- Korp Flow — https://www.korp.com.br/erp/flow/
- POLARIS, 2026 — https://arxiv.org/html/2601.11816v1

### Contract editor / AI writing

- PlateJS AI docs — https://platejs.org/docs/ai
- PlateJS Copilot docs — https://platejs.org/docs/copilot
- PlateJS Comment docs — https://platejs.org/docs/comment
- PlateJS Suggestion docs — https://platejs.org/docs/suggestion
- PlateJS AI Menu docs — https://platejs.org/docs/components/ai-menu
- PlateJS GitHub — https://github.com/udecode/plate
- TanStack AI structured outputs with tools — https://tanstack.com/ai/latest/docs/structured-outputs/with-tools
- TanStack AI streaming structured output — https://tanstack.com/ai/latest/docs/structured-outputs/streaming
- TanStack AI client tools — https://tanstack.com/ai/latest/docs/tools/client-tools

### Billing primitives

- Autumn overview — https://docs.useautumn.com/documentation/concepts/overview
- Autumn docs welcome — https://docs.useautumn.com/welcome
- Autumn GitHub — https://github.com/useautumn/autumn
- Autumn per-unit pricing — https://docs.useautumn.com/documentation/modelling-pricing/per-unit-pricing
- Polar homepage — https://polar.sh/
- Polar usage-based billing — https://polar.sh/docs/features/usage-based-billing/introduction
- Polar meters — https://polar.sh/docs/features/usage-based-billing/meters
- Polar checkout API — https://polar.sh/docs/features/checkout/session
- Polar webhooks — https://polar.sh/docs/integrate/webhooks/events
- Polar customer portal — https://polar.sh/docs/features/customer-portal/introduction
- Stripe Entitlements — https://docs.stripe.com/billing/entitlements
- Stripe usage-based billing — https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide
- Stripe Customer Portal — https://docs.stripe.com/customer-management
- Stripe webhooks — https://docs.stripe.com/webhooks

### Brasil: pagamentos, fiscal, Open Finance, CRM/workflows

- AbacatePay webhooks — https://docs.abacatepay.com/pages/webhooks
- AbacatePay criar checkout — https://docs.abacatepay.com/pages/payment/create
- AbacatePay cobrança PIX transparente — https://docs.abacatepay.com/pages/transparents/create
- AbacatePay referência checkout transparente — https://docs.abacatepay.com/pages/transparents/reference
- Portal Nacional da NF-e — https://www.nfe.fazenda.gov.br/portal/principal.aspx
- Portal NF-e webservices — http://www.nfe.fazenda.gov.br/PORTAL/WebServices.aspx?AspxAutoDetectCookieSupport=1
- SVRS documentos técnicos NF-e/NFC-e — https://dfe-portal.svrs.rs.gov.br/NFe/Documentos
- Sistema Nacional NFS-e — Manual dos Contribuintes API — https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf
- ICP-Brasil documentos de assinatura digital — https://www.gov.br/iti/pt-br/central-de-conteudo
- NFe.io REST API — https://nfe.io/docs/rest-api/
- NFe.io certificados digitais — https://nfe.io/docs/documentacao/gerenciamento-empresas/api-certificados/
- NFe.io DFe Inbound técnico — https://nfe.io/docs/documentacao/distribuicao/dfe-inbound-documentacao-tecnica-desenvolvedores/
- NFe.io gerenciamento de empresas — https://nfe.io/docs/documentacao/gerenciamento-empresas/visao-geral/
- Focus NFe webhooks — https://doc.focusnfe.com.br/reference/webhooks
- Focus emitir NF-e — https://doc.focusnfe.com.br/reference/emitir_nfe
- TecnoSpeed PlugNotas primeiros passos — https://atendimento.tecnospeed.com.br/hc/pt-br/articles/23715383551767-Primeiros-Passos-com-o-Plugnotas
- Pluggy Open Finance connectors — https://docs.pluggy.ai/docs/open-finance-regulated
- Pluggy accounts — https://docs.pluggy.ai/docs/accounts
- Pluggy transactions — https://docs.pluggy.ai/docs/transactions
- Pluggy payments overview — https://docs.pluggy.ai/docs/payments-overview-1
- Pluggy institutions coverage — https://docs.pluggy.ai/docs/open-finance-institutions-coverage
- Polp transactions docs — https://polp.com.br/docs/accounts/transactions
- Twenty APIs — https://docs.twenty.com/developers/extend/api
- Twenty webhooks — https://docs.twenty.com/developers/extend/webhooks
- Twenty workflows — https://docs.twenty.com/user-guide/workflows/capabilities/workflow-triggers
- PostHog Workflows — https://posthog.com/docs/workflows
- PostHog Workflow Builder — https://posthog.com/docs/workflows/workflow-builder.md
- PostHog webhook destination — https://posthog.com/docs/cdp/destinations/webhook

## Itens não verificados / cautela

- Rillet, Korp e NetSuite publicam bastante material de produto/marketing; detalhes internos de implementação não são públicos. Usei esses materiais como sinais arquiteturais, não como prova de implementação interna.
- A decisão fiscal agora é mirar engine própria; providers fiscais externos devem ser tratados como fallback/benchmark temporário. Ainda é necessário spike técnico com SEFAZ/NFS-e Nacional, certificado, XMLDSig, homologação e cobertura municipal.
- A escolha Pluggy vs Polp exige avaliação comercial/técnica separada e testes de qualidade de dados com contas reais.
- AbacatePay foi avaliada como primeiro provider por simplicidade e fit Brasil, mas precisa spike de webhooks, idempotência, status e chargeback/estorno antes de produção.
- Não rodei testes ou implementei código; este é um artifact de pesquisa/roadmap.
