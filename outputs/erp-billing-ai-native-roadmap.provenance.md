# Provenance — erp-billing-ai-native-roadmap

Data: 2026-05-25

## Pedido

Usuário pediu pesquisa profunda sobre ERPs, plataformas de billing como Autumn e Polar.sh, integração dessas camadas para um produto AI-native, comparação com Rillet como referência conhecida, leitura do estado atual do Montte e montagem de roadmap a partir de um esboço com clientes/fornecedores, contratos, billing primitives, produtos/estoque, vault, AbacatePay, fiscal/NFe/CNPJ, Open Finance, extensões, Twenty/PostHog e desktop.

## Skills/regras carregadas

- `/home/yorizel/.feynman/agent/skills/deep-research/SKILL.md`
- `/home/yorizel/Documents/montte-nx/.agents/skills/implementation/SKILL.md`

## Comandos locais

- `find modules -maxdepth 3 -type f ...`
- `find core/database/src modules apps/web/src ...`
- `rg` sobre módulos e schemas relevantes.
- Leitura de arquivos locais com `read`:
  - `README.md`
  - `PRODUCT.md`
  - `core/database/src/schema.ts`
  - `core/database/src/schemas/relationships.ts`
  - `core/database/src/schemas/transactions.ts`
  - `modules/relationships/src/router/index.ts`

## Subagents

Usei execução paralela com quatro subagents:

1. `researcher` → ERP AI-native, Rillet, SAP, NetSuite, Korp, POLARIS.
   - output: `notes/erp-ai-native-research.md`
2. `researcher` → billing primitives: Autumn, Polar, Stripe, AbacatePay como provider.
   - output: `notes/billing-primitives-research.md`
3. `researcher` → Brasil: AbacatePay, NFe/fiscal/certificados, Open Finance, Twenty/PostHog.
   - output: `notes/brazil-erp-integrations-research.md`
4. `scout` → estado atual do código Montte.
   - output: `notes/montte-current-state-scout.md`

## Web searches

Usei `web_search` com conteúdo incluído para:

- `AI native ERP architecture finance operations billing subscriptions contracts NFe open finance Brazil 2026`
- `Autumn pricing/billing platform primitives entitlements usage metering subscriptions docs open source`
- `Polar.sh billing platform products benefits metering webhooks customer portal checkout docs`
- `Rillet AI native ERP accounting platform features architecture billing payments audit close`
- `AbacatePay API Pix billing payments checkout docs webhook`
- `Pluggy Open Finance API Brazil transactions accounts payments docs 2026 Polp Open Finance API`
- `Brazil NFe API certificate digital CNPJ monitoring API docs NFe.io Tecnospeed Focus NFe`
- `Twenty CRM open source API webhooks integration docs PostHog workflows email docs desktop device integration Tauri ERP`

## Principais fontes usadas

### ERP AI-native

- SAP AI-Native North Star Architecture — https://architecture.learning.sap.com/assets/ai-native-north-star-architecture-public-q2-2026.pdf
- SAP Executive Summary — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/executive-summary
- SAP Process Layer — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- SAP Integration/Security/Governance — https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance
- Rillet Continuous Close — https://www.rillet.com/continuous-close
- Rillet Aura AI — https://www.rillet.com/product/aura-ai
- Rillet Automated General Ledger — https://www.rillet.com/product/automated-general-ledger
- Rillet Native Integrations — https://www.rillet.com/product/native-integrations
- NetSuite Next — https://www.netsuite.com/portal/products/netsuite-next.shtml
- NetSuite SuiteCloud Agent Skills — https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0331025334.html
- NetSuite AI Connector Service — https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_3200541651.html
- Korp Brain — https://www.korp.com.br/erp-autonomo-brain/
- Korp Flow — https://www.korp.com.br/erp/flow/
- POLARIS — https://arxiv.org/html/2601.11816v1

### Billing

- Autumn overview — https://docs.useautumn.com/documentation/concepts/overview
- Autumn docs — https://docs.useautumn.com/welcome
- Autumn GitHub — https://github.com/useautumn/autumn
- Autumn per-unit pricing — https://docs.useautumn.com/documentation/modelling-pricing/per-unit-pricing
- Polar homepage — https://polar.sh/
- Polar usage billing — https://polar.sh/docs/features/usage-based-billing/introduction
- Polar meters — https://polar.sh/docs/features/usage-based-billing/meters
- Polar checkout API — https://polar.sh/docs/features/checkout/session
- Polar webhooks — https://polar.sh/docs/integrate/webhooks/events
- Polar customer portal — https://polar.sh/docs/features/customer-portal/introduction
- Stripe Entitlements — https://docs.stripe.com/billing/entitlements
- Stripe usage billing — https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide
- Stripe webhooks — https://docs.stripe.com/webhooks

### Brasil/integrations

- AbacatePay webhooks — https://docs.abacatepay.com/pages/webhooks
- AbacatePay checkout — https://docs.abacatepay.com/pages/payment/create
- AbacatePay PIX transparente — https://docs.abacatepay.com/pages/transparents/create
- NFe.io REST API — https://nfe.io/docs/rest-api/
- NFe.io certificados — https://nfe.io/docs/documentacao/gerenciamento-empresas/api-certificados/
- NFe.io DFe inbound — https://nfe.io/docs/documentacao/distribuicao/dfe-inbound-documentacao-tecnica-desenvolvedores/
- Focus NFe webhooks — https://doc.focusnfe.com.br/reference/webhooks
- TecnoSpeed PlugNotas — https://atendimento.tecnospeed.com.br/hc/pt-br/articles/23715383551767-Primeiros-Passos-com-o-Plugnotas
- Pluggy Open Finance — https://docs.pluggy.ai/docs/open-finance-regulated
- Pluggy accounts — https://docs.pluggy.ai/docs/accounts
- Pluggy transactions — https://docs.pluggy.ai/docs/transactions
- Pluggy payments — https://docs.pluggy.ai/docs/payments-overview-1
- Polp transactions docs — https://polp.com.br/docs/accounts/transactions
- Twenty APIs — https://docs.twenty.com/developers/extend/api
- Twenty webhooks — https://docs.twenty.com/developers/extend/webhooks
- PostHog Workflows — https://posthog.com/docs/workflows

## Output gerado

- `outputs/erp-billing-ai-native-roadmap.md`
- `outputs/erp-billing-ai-native-roadmap.provenance.md`

## Verificações realizadas

- Arquivo principal escrito com sucesso via `write`.
- Provenance escrito com sucesso via `write`.
- A verificação final de existência/tamanho foi executada após escrita.

## Caveats

- Não houve implementação de código.
- Não houve spike real de provider AbacatePay/NFe.io/Pluggy.
- Rillet/Korp/NetSuite foram usados como fontes públicas de produto/arquitetura; detalhes internos não são verificáveis.
- A decisão fiscal foi atualizada depois: mirar engine própria, com providers externos apenas como fallback/benchmark; ainda exige investigação por UF/município, NFS-e Nacional, certificado, XMLDSig, homologação e operação.

## Update — preferência por NFe/NFSe própria, sem API fiscal externa por padrão

Usuário esclareceu: “eu nao quero se possivel usar api externa para nfe, eu quero implementar a minha”.

Web search adicional:

- `portal nacional NF-e documentos técnicos schemas web services manual integração contribuinte 2026`
- `NF-e webservices SEFAZ autorização protocolo eventos inutilização manifestação destinatário distribuição DFe documentação oficial`
- `NFS-e Nacional API documentação emissão integração contribuintes Ambiente Nacional 2026`
- `ICP-Brasil certificado A1 assinatura XML NF-e XMLDSig canonicalization requisitos técnicos`

Fontes oficiais/primárias adicionadas:

- Portal Nacional da NF-e — https://www.nfe.fazenda.gov.br/portal/principal.aspx
- Portal NF-e Webservices — http://www.nfe.fazenda.gov.br/PORTAL/WebServices.aspx?AspxAutoDetectCookieSupport=1
- SVRS documentos técnicos NF-e/NFC-e — https://dfe-portal.svrs.rs.gov.br/NFe/Documentos
- Sistema Nacional NFS-e — Manual dos Contribuintes API — https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf
- ICP-Brasil central de documentos — https://www.gov.br/iti/pt-br/central-de-conteudo

Applied changes:

- Reframed fiscal roadmap from provider-first to `Fiscal Engine próprio`.
- NFe.io/Focus/TecnoSpeed/PlugNotas now positioned as references, benchmark, fallback, or temporary support, not architecture target.
- Added technical breakdown for NF-e/NFC-e own implementation: official docs, certificate, XML builder, XSD validation, XMLDSig, SEFAZ SOAP clients, persistence, events, DANFE, operation.
- Added caution that NFS-e is more fragmented; recommended starting with NFS-e Nacional and implementing municipal adapters only with real demand.
- Added phased roadmap F0–F8 for fiscal engine.


## Update — Contract Writer com PlateJS + TanStack AI

Usuário esclareceu que quer usar PlateJS com TanStack AI para escrever contratos, analisar contratos existentes, reescrever cláusulas etc.

Research/tools:

- `code_search`: PlateJS AI plugin / TanStack AI editor integration.
- `web_search`: PlateJS AI plugin docs, comments/suggestions, TanStack AI structured outputs/tool calling/editor integration.
- `rg`: checked current repo/package usage of PlateJS/Slate/editor/contract. Active `apps/web/package.json` does not declare PlateJS yet.

Sources added:

- PlateJS AI docs — https://platejs.org/docs/ai
- PlateJS Copilot docs — https://platejs.org/docs/copilot
- PlateJS Comment docs — https://platejs.org/docs/comment
- PlateJS Suggestion docs — https://platejs.org/docs/suggestion
- PlateJS AI Menu docs — https://platejs.org/docs/components/ai-menu
- PlateJS GitHub — https://github.com/udecode/plate
- TanStack AI structured outputs with tools — https://tanstack.com/ai/latest/docs/structured-outputs/with-tools
- TanStack AI streaming structured outputs — https://tanstack.com/ai/latest/docs/structured-outputs/streaming
- TanStack AI client tools — https://tanstack.com/ai/latest/docs/tools/client-tools

Applied changes:

- Added `Contract Writer: PlateJS + TanStack AI` under the contracts domain.
- Added product architecture for PlateJS editor + side Montte AI panel + contract tools.
- Added workflows: new contract draft, rewrite selected clause, analyze existing contract, contract-to-billing extraction, review/risk flags.
- Added data model additions: `contract_documents`, `contract_document_versions`, `contract_extracted_terms`, `contract_suggestions`, `contract_comments`.
- Added rule: editable document and executable contract terms are separate; PlateJS owns drafting/versioning, contracts/billing owns executable state.
- Updated roadmap Phase 1 with Contract Writer, document versions, extracted terms, suggestions/comments.

