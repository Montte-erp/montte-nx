# Research: camadas brasileiras para roadmap ERP do Montte

## Summary
Montte deve tratar pagamentos, fiscal, Open Finance e CRM/workflows como **camadas de integração governadas**, não como features soltas. A ordem mais segura é: contratos/relacionamentos como base de dados mestre → billing/payments com AbacatePay Pix/webhooks → fiscal/NFe/NFSe/certificados → Open Finance para conciliação real → CRM/PostHog/Twenty e extensões por demanda.

## Findings

1. **AbacatePay é boa primeira camada de pagamento BR para Pix/checkout/webhooks, mas não substitui billing domain.** A API suporta checkout transparente com `PIX`/`BOLETO`, retornando QR Code/base64 e copia-e-cola; webhooks notificam eventos como pagamento aprovado, e há eventos específicos como `transparent.completed`. Para Montte, modele internamente `payment_provider`, `payment_intent`, `payment_charge`, `payment_webhook_event` e idempotência; AbacatePay fica como provider inicial. [Criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create), [referência checkout transparente](https://docs.abacatepay.com/pages/transparents/reference), [webhooks](https://docs.abacatepay.com/pages/webhooks), [evento transparent.completed](https://docs.abacatepay.com/pages/webhooks/events/transparent)

2. **Risco principal da AbacatePay: webhooks e reconciliação financeira.** Webhooks devem ser verificados por assinatura/HMAC, persistidos como eventos brutos, processados de forma idempotente e reconciliados contra cobranças internas antes de liberar serviço/atualizar status. Também é preciso modelar estados intermediários, expiração, reprocessamento, divergência de valor, ambiente `devMode` e chargebacks/estornos se aplicável. [Referência webhooks](https://docs.abacatepay.com/pages/webhooks/reference)

3. **NFe.io cobre bem a camada fiscal: NFe/NFCe/NFSe, CNPJ/CPF/CTe, webhooks e certificados digitais.** A documentação posiciona a API REST para emissão/gestão de documentos fiscais, cálculo de tributos, consultas cadastrais, distribuição de NF-e e gestão de certificados digitais. Para Montte, ela encaixa como provider fiscal atrás de contracts/procedures próprios: `fiscal_company`, `digital_certificate`, `fiscal_document`, `fiscal_event`, `dfe_inbound_document`. [Introdução REST NFE.io](https://nfe.io/docs/rest-api/), [API de contribuintes/empresas](https://nfe.io/docs/documentacao/gerenciamento-empresas/visao-geral/)

4. **Certificado digital é um vault/regulatory feature, não cadastro simples.** NFe.io documenta que emissão de NF-e/NFC-e/NFS-e exige certificado ICP-Brasil A1 vinculado à empresa; certificados A3 não são suportados nesse fluxo. Montte deve guardar apenas metadados e referências seguras, com upload/rotação/revogação/auditoria e segregação por tenant/time; nunca expor o certificado ao agente AI ou ao cliente depois do upload. [API de certificados digitais ICP-Brasil](https://nfe.io/docs/documentacao/gerenciamento-empresas/api-certificados/), [Companies Certificates](https://nfe.io/docs/desenvolvedores/rest-api/contribuintes-v2/companies-certificates/)

5. **DFe Inbound é valioso para monitorar CNPJ e alimentar Inbox/contas a pagar, mas cria alto volume e obrigações fiscais.** NFe.io DFe Inbound monitora SEFAZ e captura NF-e/CT-e emitidos contra o CNPJ da empresa, com XML disponível via API. Para Montte, use como fonte para Inbox: baixar XML, extrair fornecedor/valor/vencimento/chave, sugerir transação/conta a pagar, exigir aprovação antes de lançar. [DFe Inbound técnico](https://nfe.io/docs/documentacao/distribuicao/dfe-inbound-documentacao-tecnica-desenvolvedores/), [DFe Inbound funcional](https://nfe.io/docs/documentacao/distribuicao/dfe-inbound-documentacao-funcional-clientes/)

6. **Focus NFe e TecnoSpeed/PlugNotas são alternativas fiscais relevantes; mantenha provider interface.** Focus NFe expõe emissão de NF-e, DPS/NFSe Nacional e webhooks; TecnoSpeed/PlugNotas oferece API REST para NF-e/NFS-e/NFC-e/MDF-e e notificações via webhook. Não acople Montte diretamente a um único fiscal provider: crie `FiscalProvider` com capability matrix por UF/município/documento. [Focus webhooks](https://doc.focusnfe.com.br/reference/webhooks), [Focus emitir NF-e](https://doc.focusnfe.com.br/reference/emitir_nfe), [Focus DPS/NFSe Nacional](https://doc.focusnfe.com.br/reference/emitir_dps_nacional), [PlugNotas docs](https://docs.plugnotas.com.br/), [PlugNotas NF-e](https://plugnotas.com.br/nfe/)

7. **Open Finance via Pluggy deve entrar para contas/transações e conciliação, não como substituto de livro-caixa.** Pluggy suporta conectores Open Finance, contas, transações e cartões; transações podem recuperar até 12 meses e são paginadas. Montte deve importar para uma tabela de `external_account`/`external_transaction`, mapear para bank accounts/transactions existentes e manter deduplicação por provider id, data, valor e descrição. [Pluggy Open Finance Connectors](https://docs.pluggy.ai/docs/open-finance-regulated), [Accounts](https://docs.pluggy.ai/docs/accounts), [Transactions](https://docs.pluggy.ai/docs/transactions)

8. **Open Finance tem lacunas de dados de contraparte; AI não deve prometer categorização perfeita.** A própria Pluggy documenta que disponibilidade de CPF/CNPJ da contraparte depende do tipo da transação e da instituição. Isso afeta matching fornecedor/cliente, classificação e conciliação. Use confidence score, evidência e fallback manual. [Payment Data Open Finance coverage](https://docs.pluggy.ai/docs/payment-data-open-finance-coverage)

9. **Pluggy Payments pode ser explorado depois de AbacatePay, mas não deve confundir cobrança Pix com Open Finance payment initiation.** Pluggy Payments modela recipient, payment request e payment intent usando infraestrutura de iniciação de pagamentos Open Finance. Para Montte, priorize AbacatePay como primeiro provider simples; avalie Pluggy Payments depois se precisar pagamento via conta conectada/Open Finance. [Pluggy Payments Overview](https://docs.pluggy.ai/docs/payments-overview-1)

10. **Polp-like providers devem ser avaliados por modelo de dados, cobertura e SLA, não só API.** Polp expõe listagem de transações de conta com IDs externos, conta, fatura e campos transacionais; isso sugere compatibilidade com um adapter similar ao Pluggy. O risco é lock-in/qualidade de conectores/cobertura institucional; mantenha `OpenFinanceProvider` com normalização própria. [Polp List Transactions](https://polp.com.br/docs/accounts/transactions)

11. **Twenty é bom CRM confirmado porque API/webhooks são schema-aware, mas a integração deve ser event-driven.** Twenty oferece APIs REST/GraphQL geradas por workspace e webhooks em create/update/delete para objetos, além de workflows acionáveis por webhook. Montte deve sincronizar `customers/suppliers/contracts/subscriptions` com Twenty por eventos assíncronos, com mapeamento de IDs e DLQ; não fazer sync síncrono em tela crítica. [Twenty APIs](https://docs.twenty.com/developers/extend/api), [Twenty Webhooks](https://docs.twenty.com/developers/extend/webhooks), [Twenty Extend](https://docs.twenty.com/developers/extend/extend), [Webhook trigger workflows](https://docs.twenty.com/user-guide/workflows/how-tos/connect-to-other-tools/set-up-a-webhook-trigger)

12. **Twenty Workflows pode enviar e-mails, mas Montte precisa decidir ownership de comunicação.** Twenty documenta envio de e-mails por workflows após conectar conta de e-mail. Para Montte, use inicialmente para CRM/sales/customer success; para cobranças fiscais/financeiras críticas, prefira workflow interno auditável ou PostHog/notifications com trilha de auditoria. [Send Emails from Workflows](https://docs.twenty.com/user-guide/workflows/capabilities/send-emails-from-workflows)

13. **PostHog Workflows/CDP é útil para growth, onboarding, e-mails e automações de produto, não para escrituração financeira.** PostHog Workflows permite triggers por evento, schedule, audience, webhook/tracking pixel e dispatch por e-mail, Slack, SMS, webhook ou destinos CDP. Montte pode emitir eventos de lifecycle (`customer.created`, `invoice.paid`, `trial.ending`, `open_finance_connected`) para acionar comunicação e experimentos. Não use PostHog como fonte de verdade de billing/fiscal. [PostHog Workflows](https://posthog.com/docs/workflows), [Workflow builder](https://posthog.com/docs/workflows/workflow-builder.md), [configure channels](https://posthog.com/docs/workflows/configure-channels), [webhook destination](https://posthog.com/docs/cdp/destinations/webhook)

14. **Estado atual do Montte já tem base para relações e financeiro, mas faltam camadas de provider/integration.** O repo tem `relationships.parties` com `customer/supplier`, documento/email/telefone e validação CPF/CNPJ; transações já têm `relationshipId`, `paymentMethod`, `status`, anexos e datas; CNPJ hoje consulta BrasilAPI diretamente. Não há ainda módulos claros para billing provider, fiscal documents, digital certificates, Open Finance adapters ou provider webhooks. Referências locais: `core/database/src/schemas/relationships.ts`, `core/database/src/schemas/transactions.ts`, `modules/relationships/src/router/index.ts`, `modules/account/src/router/cnpj.ts`.

## Roadmap recomendado para essas camadas

1. **Base mestre:** fortalecer clientes/fornecedores, contratos e vínculo com transações; normalizar documento fiscal, endereço, contatos, dados bancários e status cadastral.
2. **Integration kernel:** criar tabelas/provider abstractions para `provider_connection`, `provider_webhook_event`, `external_id_map`, `integration_job`, `sync_cursor`, `provider_secret_ref`.
3. **Payments v1 — AbacatePay:** Pix/checkout/webhook/idempotência/reconciliação; gerar cobranças a partir de contrato/serviço/produto.
4. **Billing primitives:** produtos, serviços, preços, planos, assinatura/contrato, item recorrente, uso/medição, invoice interna, entitlement, status financeiro.
5. **Fiscal v1:** certificados digitais A1 via vault/provider, cadastro fiscal da empresa, emissão NFS-e/NF-e via provider interface, webhooks e eventos fiscais.
6. **DFe/CNPJ monitoring:** DFe inbound para documentos recebidos, Inbox fiscal, sugestão de conta a pagar/receber, aprovação humana.
7. **Open Finance v1:** Pluggy ou Polp-like adapter para contas/transações; conciliação assistida por AI com score/evidência.
8. **CRM/workflows:** Twenty sync por eventos; PostHog workflows para comunicação de produto/growth; e-mails financeiros críticos permanecem auditáveis no Montte.

## Risks

- **Regulatório/fiscal:** NF-e/NFS-e varia por UF/município; reforma tributária e NFS-e nacional aumentam risco de mudança de layout/regra.
- **Certificados digitais:** vazamento de A1 é crítico; exige vault, rotação, controle de acesso, auditoria e segregação tenant.
- **Webhook correctness:** pagamentos/fiscal/CRM precisam HMAC/signature, raw payload, replay protection, idempotency key e DLQ.
- **Provider lock-in:** AbacatePay/NFe.io/Pluggy/Twenty podem mudar API/cobertura/preço; usar adapters e capability matrix.
- **Dados incompletos:** Open Finance pode não trazer contraparte/CNPJ; categorização e matching devem ser probabilísticos com aprovação.
- **Conciliação:** cobrança paga no provider não equivale automaticamente a lançamento correto no livro-caixa; precisa matching e diferenças de valor/taxa.
- **AI-native safety:** agente pode sugerir/explicar/monitorar, mas emissão fiscal, cobrança, cancelamento, baixa financeira e sync externo precisam preview, aprovação, audit log e procedures determinísticas.

## Sources

- AbacatePay checkout transparente/Pix/webhooks — primary docs for first payment provider.
- NFe.io REST/certificates/DFe inbound — primary docs for fiscal provider and CNPJ/NFe monitoring.
- Focus NFe and TecnoSpeed/PlugNotas — alternative fiscal providers for provider abstraction.
- Pluggy/Open Finance and Polp docs — Open Finance account/transaction/payment data providers.
- Twenty/PostHog docs — CRM/workflow/event integrations.
- Montte local repo files — current relationship, CNPJ and transaction baseline.
