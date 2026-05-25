# Research: ERP AI-native para PME brasileira e implicações para Montte

## Summary

A arquitetura AI-native de ERP mais consistente não é “chatbot no ERP”; é transformar módulos transacionais em **capability providers** com APIs/eventos estáveis, contexto governado, workflows determinísticos, agentes/skills por domínio e trilha de auditoria antes de qualquer efeito financeiro. Para Montte, o caminho pragmático é manter Postgres como sistema de registro, usar o Montte AI como camada única de intenção/orquestração, e evoluir módulos de relacionamento, contratos, billing, fiscal, open finance e extensões com preview, aprovação, observabilidade e execução assíncrona.

## Findings

1. **SAP define AI-native como sistema de contexto + sistema de registro, não só copiloto.** A tese da SAP é que ERPs tradicionais guardam transações/fatos, mas perdem o contexto de decisões; AI-native conecta dados, conhecimento de processo e histórico decisório para que agentes raciocinem com governança. A SAP também separa caminho determinístico para confiabilidade/compliance e caminho AI-native para raciocínio adaptativo. Implicação para Montte: Postgres/oRPC/workflows continuam como fonte de verdade; IA adiciona contexto, planejamento, preview e explicação, não substitui procedures determinísticas. [SAP Executive Summary](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/executive-summary)

2. **A Process Layer da SAP é o melhor padrão arquitetural para Montte: módulos viram capability providers.** No modelo AI-native, aplicações expõem APIs, eventos e dados que agentes descobrem/invocam; agentes são organizados por domínio de negócio, não por sistema/tela; skills são blocos reutilizáveis; produção precisa de runtime unificado, versão, teste e deployment. Implicação: `finance`, `relationships`, `automation`, `inbox`, `billing`, `fiscal` e `integrations` devem expor tools/procedures tipadas, eventos e jobs, e não “deixar o agente mexer em telas”. [SAP Process Layer](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer)

3. **Governança é parte do produto, não pós-processamento.** A SAP recomenda gateway governado único, policies finas até parâmetro de tool, catálogo unificado de tools, HITL para decisões críticas, identidade própria para agentes e autorização escopada. Implicação: Montte deve ter policy engine/harness antes dos writes: tool allowlist por skill, risk tier, aprovação, audit log, idempotency key, tenant/team validation e bloqueio de tool call não promovida. [SAP Integration, Security, Ethics & Governance](https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance)

4. **Rillet mostra um norte de produto financeiro: continuous close, dados em tempo real e controles upstream.** Rillet posiciona o ERP financeiro em torno de fechamento contínuo: contas fechadas todo dia, bills processadas quando chegam, amortização/alocação/accrual/reconciliação em tempo real, IA sinalizando accruals/anomalias e auditoria construída durante a execução. Implicação: para Montte PME, o análogo é “operação financeira sempre revisável”: inbox de pendências, conciliação contínua, classificação/categorias assistidas, aging/fluxo de caixa atual e alertas de exceção. [Rillet Continuous Close](https://www.rillet.com/continuous-close)

5. **Rillet integra billing, pagamentos e ledger em vez de tratar billing como módulo isolado.** A página de GL/integrations mostra contratos, invoices e bills gerando journal entries/schedules, e integrações com Stripe, Chargebee, Sequence, Tabs, Hyperline, Maxio etc. para levar quote-to-cash/billing ao ledger. Implicação: Montte deve desenhar billing primitives como camada operacional integrada ao financeiro: contrato → produto/serviço → preço → medição/uso → invoice/cobrança → pagamento → lançamento/receita/contas a receber → cobrança/receipts. [Rillet Automated GL / integrations](https://www.rillet.com/product/automated-general-ledger)

6. **Rillet Aura reforça que “AI in GL” precisa aplicar lógica contábil primeiro e só depois responder.** A proposta é conversar com o ledger, executar reports, apontar anomalias e rotear perguntas para agentes especializados, mas sempre apoiado no GL e na lógica contábil. Implicação: Montte AI deve usar tools de domínio para números e status; texto/RAG pode explicar, mas não calcular saldos finais. [Rillet Aura AI](https://www.rillet.com/product/aura-ai)

7. **NetSuite Next confirma a direção de mercado: AI como UI, mas com fonte única de verdade e citações.** NetSuite Next fala em Ask Oracle como interface conversacional para buscar, analisar e agir no sistema, com source citations em respostas, AI embutida em accounting, close, analytics, customer management e inventory, e plataforma extensível. Implicação: Montte deve evitar “chat isolado”: a IA precisa estar em cada tela com contexto, ações, evidências/citações e componentes UI estruturados. [NetSuite Next](https://www.netsuite.com/portal/products/netsuite-next.shtml)

8. **NetSuite SuiteCloud Agent Skills valida o modelo skill-first.** A documentação descreve skills como pacotes reutilizáveis em markdown com propósito, escopo, inputs, workflow, regras/guardrails, referências e requisitos de saída; também destaca source-of-truth references, least privilege e revisão em ambiente não produtivo. Implicação: Montte deve formalizar skill contracts por domínio e references versionadas; isso casa diretamente com a arquitetura já proposta para Montte AI. [NetSuite SuiteCloud Skills](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0331025334.html)

9. **NetSuite também está abrindo o ERP para agentes externos via MCP, mas isso deve ser tratado com cautela em Montte.** A documentação oficial fala em AI Connector Service com MCP para permitir que clientes conectem assistentes a dados/funcionalidades NetSuite. Implicação: Montte pode estudar MCP como adapter interno/parceiros, mas não como bypass de oRPC/policy/audit; para PME brasileira, segurança/tenant isolation é mais importante que abertura prematura. [NetSuite AI Connector Service](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_3200541651.html)

10. **Korp Brain é o exemplo brasileiro mais direto de “ERP autônomo”, mas os detalhes públicos ainda são majoritariamente conceituais.** A Korp afirma que o Brain não é assistente acoplado, mas o ERP em novo formato: usuários criam colaboradores virtuais por linguagem natural, definem responsabilidades, limites e validação humana; o Brain conecta ERP, WhatsApp, Telegram, e-mails, Excel e Google Sheets. Implicação: Montte deve absorver o insight de UX — usuário como orquestrador — sem replicar multiagentes expostos; manter um Montte AI único com skills internas e autonomia graduada. [Korp Brain](https://www.korp.com.br/erp-autonomo-brain/)

11. **Korp Flow mostra que AI-native precisa coexistir com workflow visual/no-code.** O Flow tem interface drag-and-drop, blocos, condições, agendamentos, mensagens, aprovações, eventos de vendas/compras/faturamento, histórico e indicadores. Implicação: Montte deve evoluir seu módulo `workflows` de “relatório agendado” para engine operacional: triggers por evento, ações de domínio, aprovações, mensagens e execuções observáveis; IA pode criar/propor workflows, mas runtime precisa ser determinístico. [Korp Flow](https://www.korp.com.br/erp/flow/)

12. **Pesquisa acadêmica recente converge para typed planning + validated execution em back-office.** POLARIS propõe automação agentic governada como síntese de planos tipados em DAG, seleção por rubrica, execução validada, repair loop limitado e policy guardrails que bloqueiam/roteiam efeitos antes de ocorrerem. Implicação: Montte deve representar planos de ações sensíveis como objetos estruturados, não só texto: `plan -> preview -> approval -> workflow/job -> receipt`, com validators e audit trail. [POLARIS](https://arxiv.org/html/2601.11816v1)

13. **Para PME brasileira, o diferencial AI-native não é “GL enterprise completo”; é reduzir fricção operacional local.** O mercado brasileiro exige CNPJ, certificados digitais, NF-e/NFS-e, PIX/boleto, Open Finance, conciliação bancária, WhatsApp/e-mail e reforma tributária. Implicação: Montte deve priorizar fluxos que viram trabalho real: cadastrar cliente/fornecedor pelo CNPJ, contrato simples, cobrança PIX, recebimento automático, emissão/monitoramento fiscal, conciliação e alertas.

14. **Estado atual do Montte já tem a base certa, mas ainda incompleta.** No repo atual há: `relationships.parties` para clientes/fornecedores, `finance.transactions` com relação opcional a party, categorias/tags, contas/cartões, relatórios, inbox, workflows simples, agent settings, TanStack AI com PostHog prompts/tool calls e nav groups `finance`, `relationships`, `automation`, `inbox`. Não há ainda módulos fonte para billing/contratos/produtos/estoque/vault/fiscal/open finance/extensões. Implicação: roadmap deve expandir em camadas sem quebrar a tese: um ERP Postgres-first, oRPC-first, AI-native por skill/domain, com dados e effects governados.

## Roadmap implications for Montte

### Princípios de arquitetura

1. **Postgres é o único sistema de registro.** Sem vector DB/graph DB/search DB separado. Billing, contratos, fiscal, open finance, entity graph e memória operacional ficam em Postgres.
2. **Módulos são capability providers.** Cada módulo expõe oRPC procedures, eventos, jobs/workflows e tools AI com schemas.
3. **Montte AI único, skills internas.** Não criar vários agentes na UX; usar skills por domínio: `relationships`, `contracts`, `billing`, `finance`, `fiscal`, `automation`, `integrations`, `extensions`.
4. **Efeito financeiro sempre passa por preview/aprovação/audit.** IA pode propor; execução real é procedure/workflow determinístico.
5. **AI-native = fluxo completo, não feature isolada.** Cada nova camada precisa vir com: context injection, OpenUI/preview, receipts, PostHog traces/evals, audit log, e automações sugeridas.

### Roadmap sugerido

#### Fase 0 — Fundação AI-native e limpeza

- Formalizar skill contracts e references por domínio.
- Criar policy/harness: risk tiers, tool allowlist, approval gates, trajectory audit.
- Evoluir workflows para aceitar ações tipadas além de `createReport`.
- Criar `business_events` em Postgres: `party.created`, `contract.signed`, `invoice.issued`, `payment.confirmed`, `transaction.reconciled`, etc.
- Padronizar receipts/audit para ações do agente.

#### Fase 1 — Clientes/fornecedores → contratos

- Expandir `relationships.parties` para dados fiscais/comerciais mínimos: endereço, IE/IM quando aplicável, contatos, status, origem, tags.
- Criar módulo `contracts`: contrato por party, termos, recorrência, itens contratados, anexos, vigência, reajuste, status.
- AI-native:
  - criar cliente/fornecedor a partir de CNPJ + revisão;
  - detectar duplicados;
  - sugerir contrato simples a partir de conversa/documento;
  - explicar riscos/pendências;
  - gerar checklist de onboarding do cliente/fornecedor.

#### Fase 2 — Billing primitives + AbacatePay como primeiro provider

- Criar módulo `billing` inspirado em Autumn/Polar, mas integrado ao ERP:
  - `products`, `services`, `prices`, `plans`, `features/entitlements`, `meters`, `usage_events`, `subscriptions`, `subscription_items`, `invoices`, `charges`, `payment_intents`, `payment_providers`, `webhook_events`.
- Começar com serviços/produtos digitais e cobrança simples, não estoque completo.
- Provider inicial: AbacatePay para PIX/boleto/checkout.
- Gerar lançamento financeiro a partir de invoice/payment confirmado.
- AI-native:
  - “crie uma cobrança PIX para este contrato”;
  - “quais clientes estão atrasados?”;
  - “sugira plano/preço para este serviço”;
  - “explique diferença entre contratado, faturado e recebido”.

#### Fase 3 — Produtos/estoque mínimo como billing primitive

- Se usuários demandarem, adicionar catálogo de produtos/itens e estoque leve:
  - SKU, unidade, custo, preço, movimentações, saldo, reserva simples.
- Não construir MRP/WMS cedo; focar em cobrança, fiscal e fluxo financeiro.
- AI-native:
  - detectar inconsistência entre produto vendido, cobrança, fiscal e estoque;
  - sugerir reposição simples;
  - explicar margem por produto/serviço.

#### Fase 4 — Vault + fiscal: certificados, NF-e/NFS-e, monitorar CNPJ

- Criar `vault` para credenciais/certificados A1 com rotação, expiração, permissões e audit.
- Integrar provider fiscal depois de comparar NFE.io/Tecnospeed/Focus/Nuvem Fiscal.
- Começar por monitoramento/recebimento fiscal e dados cadastrais antes de emissão completa, se isso reduzir risco.
- AI-native:
  - alertar certificado vencendo;
  - explicar nota rejeitada;
  - sugerir correção antes de reemitir;
  - cruzar NF recebida com fornecedor/transação/contrato.

#### Fase 5 — Open Finance

- Integrar Pluggy ou Polp para contas, cartões e transações.
- Pipeline: conexão consentida → sync → normalização → import staging → sugestões → conciliação → lançamento.
- AI-native:
  - explicar divergências;
  - sugerir categorização/relacionamento;
  - destacar cobranças recebidas sem invoice;
  - alertar saldo/fluxo de caixa.

#### Fase 6 — Integrações e CRM

- Twenty confirmado como CRM externo: sincronizar companies/people/opportunities com parties/contracts quando houver demanda real.
- PostHog confirmado: usar workflows para eventos de produto, e-mail lifecycle e analytics operacional.
- Criar integration framework interno:
  - auth credentials no vault;
  - webhook inbox;
  - event mapping;
  - retries/DLQ;
  - sync state;
  - audit por provider.
- AI-native:
  - assistente explica falhas de sync;
  - propõe mapeamentos;
  - cria workflow de follow-up/cobrança com aprovação.

#### Fase 7 — Desktop e mundo físico

- Usar app desktop/Tauri apenas quando houver necessidade concreta de dispositivo local: certificado A3, impressora, scanner, leitor, balança, automação local.
- Desktop não deve virar segundo produto; é bridge controlada para capacidades físicas.

#### Fase 8 — Extensions / verticalização sob demanda

- Criar `extensions` como framework, não marketplace prematuro:
  - extension manifest;
  - permissions;
  - database migrations controladas;
  - oRPC/tools/events;
  - UI slots;
  - workflow templates;
  - eval/audit requirements.
- Verticalizar só com parceiro/demanda real: mercado, farmácia etc.
- AI-native:
  - skills/references verticais carregadas sob demanda;
  - templates de workflows;
  - glossário e regras específicas do setor.

## Suggested priority order

1. Bugs e integridade de dados — sempre prioridade máxima.
2. Fundação AI-native: harness/policy/audit/workflow/eventos.
3. Relationships polish + contracts.
4. Billing primitives + AbacatePay.
5. Fiscal/vault/CNPJ/NFe monitoramento.
6. Open Finance.
7. Integrações CRM/PostHog.
8. Extensions/SDK.
9. Melhorias de UX com impacto de fluxo.
10. Melhorias puramente visuais por último.

## Sources

- Kept: SAP Executive Summary — define system of context, deterministic + AI-native paths, governance/observability. https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/executive-summary
- Kept: SAP Process Layer — capability providers, agents by domain, skills, unified runtime. https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/process-layer
- Kept: SAP Integration/Security/Governance — governed gateway, agent identity, policy and HITL. https://architecture.learning.sap.com/docs/ai-native-north-star-architecture/integration-security-ethics-governance
- Kept: Rillet Continuous Close — real-time finance architecture and continuous controls. https://www.rillet.com/continuous-close
- Kept: Rillet Aura AI — AI embedded in GL/accounting workflows. https://www.rillet.com/product/aura-ai
- Kept: Rillet Automated GL / integrations — contracts/invoices/bills to journal entries and billing/payments integrations. https://www.rillet.com/product/automated-general-ledger
- Kept: NetSuite Next — AI as UI, source citations, embedded ERP workflows. https://www.netsuite.com/portal/products/netsuite-next.shtml
- Kept: NetSuite SuiteCloud Agent Skills — skill files, references, guardrails, least privilege. https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_0331025334.html
- Kept: NetSuite AI Connector Service — MCP-style ERP access for external AI, useful as cautionary pattern. https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/article_3200541651.html
- Kept: Korp Brain — Brazilian ERP autonomous UX pattern. https://www.korp.com.br/erp-autonomo-brain/
- Kept: Korp Flow — workflow/no-code + approvals/events pattern. https://www.korp.com.br/erp/flow/
- Kept: POLARIS — typed planning and governed execution for back-office automation. https://arxiv.org/html/2601.11816v1
- Dropped: generic vendor AI blog posts and SEO-heavy ERP pages — useful for market language, not strong enough for architecture decisions.
- Dropped: small GitHub ERP clones — useful for local SME feature lists, not credible AI-native architecture references.

## Gaps

- Rillet and Korp publish product architecture signals but not internal implementation details; conclusions infer architecture from public product/docs.
- NetSuite Brazil AI announcements are partly press/marketing; official docs support skills/MCP/AI release capabilities, but Brazil-specific AI roadmap details are less technical.
- This note focuses ERP AI-native architecture; billing-platform-specific deep dive over Autumn/Polar/AbacatePay should be a separate companion note.
