# Research: billing primitives para um ERP Postgres-first

## Summary

Billing moderno não deve ser tratado como “tabela de assinatura + gateway”. Autumn, Polar.sh e Stripe Billing convergem em um modelo de primitives: **customers, products/plans, features/benefits, entitlements, balances/credits, subscriptions, meters, usage events, invoices, customer portal e webhooks**. Para o Montte, a melhor arquitetura é Postgres-first: manter catálogo, contratos, serviços/produtos, eventos de uso, entitlement snapshots, provider mappings, webhooks e audit log no Postgres; usar AbacatePay/Stripe/outros como payment providers plugáveis, não como fonte única do domínio.

## Findings

1. **Autumn modela billing como camada de controle entre app e provider de pagamento** — Autumn descreve um pipeline: features → plans → plan items → subscriptions → balances. A app interage principalmente por `/check` para gate de acesso e `/track` para registrar uso; balances refletem grants, uso e saldo restante. Isso é útil para Montte porque separa “o cliente tem direito a quê?” de “como cobraremos/pagaremos?”. [Autumn overview](https://docs.useautumn.com/documentation/concepts/overview)

2. **A primitive central do Autumn é entitlement/balance, não invoice** — Features podem ser boolean, consumable ou non-consumable; plans agrupam features com preço; plan items definem incluído vs cobrado, prepaid ou usage-based; balances são provisionados por plano/add-on/top-up. Implicação: Montte deve ter `features`, `plans`, `plan_items`, `entitlement_balances` e `usage_events` próprios, mesmo que o provider gere cobrança. [Autumn balances](https://docs.useautumn.com/documentation/concepts/balances), [Autumn plan items](https://docs.useautumn.com/documentation/concepts/plan-items)

3. **Polar.sh organiza usage billing por eventos → meters → metered prices → products** — Polar ingere eventos com `name`, `customer_id`/`external_customer_id` e `metadata`; meters filtram/agregam eventos; metered prices cobram a partir do meter; meter credits dão créditos recorrentes por ciclo. Implicação: Montte deve registrar eventos append-only no Postgres primeiro e depois reconciliar com provider; nunca depender só do provider para auditoria. [Polar usage billing](https://polar.sh/docs/features/usage-based-billing/introduction)

4. **Polar também unifica produto, assinatura, compra única, benefícios e portal** — Products podem ser one-time ou recurring, com pricing/billing diferentes sob o mesmo modelo; webhooks incluem customer/subscription state changes e “granted benefits”; customer portal permite autoatendimento para assinaturas, invoices e billing details. Implicação: Montte deve separar `product_catalog` de `service_contracts`, e manter `provider_webhook_events` idempotentes para atualizar entitlement snapshots. [Polar products](https://polar.sh/docs/features/products), [Polar webhooks](https://polar.sh/docs/integrate/webhooks/events), [Polar customer portal](https://polar.sh/docs/features/customer-portal/introduction)

5. **Stripe Billing agora cobre entitlements e usage meters nativamente** — Stripe Entitlements mapeia features internas a Stripe Products e notifica provision/deprovision conforme subscription status; Stripe usage-based billing usa Meters, Meter Events, Products e Prices para cobrar pay-as-you-go. Implicação: Stripe é referência madura de provider contract, mas o Montte não deve acoplar domínio a objetos Stripe; deve criar `billing_provider_accounts` e `provider_object_mappings`. [Stripe Entitlements](https://docs.stripe.com/billing/entitlements), [Stripe usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide)

6. **Customer portal é uma boundary de UX e suporte, não o domínio principal** — Stripe e Polar oferecem portal hospedado para clientes gerenciarem assinatura, invoices, payment methods e billing details. Para Montte, portal externo pode acelerar MVP, mas o ERP precisa refletir estado em Postgres para relatórios, permissões, contratos e AI. [Stripe customer portal](https://docs.stripe.com/customer-management), [Polar customer portal](https://polar.sh/docs/features/customer-portal/introduction)

7. **Webhooks precisam ser tratados como ledger de integração** — Stripe enfatiza endpoints de webhook para receber eventos; Polar expõe eventos de billing/customer/subscription; AbacatePay também envia notificações de pagamentos aprovados/saques. Implicação: criar `provider_webhook_events` com idempotency key, raw payload, signature status, processing status, retry count e resulting domain event. Webhook nunca deve mutar direto várias tabelas sem transação/audit. [Stripe webhooks](https://docs.stripe.com/webhooks), [Polar webhooks](https://polar.sh/docs/integrate/webhooks/events), [AbacatePay webhooks](https://docs.abacatepay.com/pages/webhooks)

8. **Payment provider deve ser plugável e menor que billing** — AbacatePay é bom primeiro provider brasileiro para checkout/PIX/boleto e webhooks, mas ele não substitui subscription/entitlement/metering. Implicação: implementar `PaymentProvider` para criar checkout/cobrança, receber webhook e reconciliar pagamento; billing primitives continuam no Montte. [AbacatePay criar checkout](https://docs.abacatepay.com/pages/payment/create), [AbacatePay PIX transparente](https://docs.abacatepay.com/pages/transparents/create)

9. **Para ERP, contratos devem ficar acima de subscriptions** — Billing platforms falam em customer/product/subscription; ERP precisa de parties, contracts, service terms, billing schedule, fiscal/tax metadata, delivery obligations e lifecycle. Implicação: `contracts` deve ser a primitive de negócio; `subscriptions`/`invoices`/`payments` são efeitos financeiros derivados do contrato e de eventos de uso.

10. **Estado atual do Montte favorece essa arquitetura, mas ainda não tem billing domain no código-fonte atual** — O repo tem `relationships.parties` para clientes/fornecedores, `finance.transactions` com `relationshipId`, workflows, inbox, agents, cashbook/cards/classification. O agregador oRPC atual expõe account, bankAccounts, creditCards, categories, cnpj, financialSettings, inbox, reports, relationships, workflows, transactions e threads; não há router/schemas fonte de billing em `core/database/src/schema.ts` ou `apps/web/src/integrations/orpc/router/index.ts`. Existem declarações antigas em `core/database/dist` para services/subscriptions/meters/usage/invoices, mas dist não deve guiar arquitetura. Implicação: criar billing como novo domínio fonte, provavelmente `modules/billing` + schemas Postgres, não ressuscitar dist sem revisão.

## Design implications for Montte

### Domain layering

```text
relationships.parties
  -> customers/suppliers base

contracts
  -> business agreement, terms, service scope, fiscal/tax metadata

billing catalog
  -> products, services, plans, features, plan_items, prices

entitlements
  -> feature grants, balances, credit buckets, effective access snapshot

usage metering
  -> append-only usage_events, meter_definitions, meter_aggregates

billing lifecycle
  -> subscriptions, subscription_items, invoices, invoice_lines

payments
  -> payment_intents/charges, provider mappings, webhook event ledger

finance integration
  -> generated receivables/payables/transactions linked to parties/contracts/invoices
```

### Postgres-first tables to add first

- `billing.products`
- `billing.services`
- `billing.features`
- `billing.plans`
- `billing.plan_items`
- `billing.prices`
- `billing.contracts`
- `billing.contract_items`
- `billing.subscriptions`
- `billing.subscription_items`
- `billing.entitlement_balances`
- `billing.usage_events`
- `billing.meters`
- `billing.meter_aggregates`
- `billing.invoices`
- `billing.invoice_lines`
- `billing.payment_intents`
- `billing.provider_accounts`
- `billing.provider_object_mappings`
- `billing.provider_webhook_events`

### Provider abstraction

```text
PaymentProvider
  createCheckout(contractId | invoiceId)
  createTransparentPix(invoiceId)
  cancelPaymentIntent(providerPaymentId)
  parseWebhook(headers, rawBody)
  mapProviderStatusToDomainStatus(status)

BillingProvider optional later
  syncProduct/Price/Subscription
  reportMeterEvent
  openCustomerPortal
```

Start with AbacatePay as `PaymentProvider`; do not require Autumn/Polar/Stripe as runtime dependency. Use their primitives as design inspiration.

### AI-native integration

- Montte AI should understand contracts, entitlements, invoices, payments and usage as first-class domain objects.
- AI can draft a contract, explain billing, detect anomalies, suggest plan changes and prepare payment collections.
- AI must not directly grant entitlements or mark invoices paid; it should call preview/approval tools that execute deterministic procedures.
- Tool examples: `draft_contract`, `preview_invoice`, `explain_entitlement`, `record_usage_event`, `preview_plan_change`, `create_payment_checkout`, `reconcile_provider_webhook`.

## Recommended roadmap

1. **Billing foundation** — Add Postgres schemas for parties→contracts→catalog→entitlements→usage→invoices→payments. Keep all IDs tenant/team scoped.
2. **Contracts MVP** — Link customers/suppliers to contracts and contract items; support fixed recurring services first.
3. **Service billing MVP** — Products/services/plans/prices, recurring invoice preview, manual approval, generated receivable transaction.
4. **AbacatePay provider** — Checkout/PIX transparent, webhook ledger, payment reconciliation into invoice/payment status.
5. **Entitlements MVP** — Boolean + non-consumable feature gates; balances snapshot; server-side check procedure.
6. **Usage metering** — Append-only usage events, meter definitions, monthly aggregates, overage preview.
7. **Customer portal/internal portal** — Start internal; later expose customer self-service if needed.
8. **AI-native polish** — Skill references, OpenUI cards for contracts/invoices/entitlements, approval panels, evals for billing correctness.
9. **Provider expansion** — Stripe/Polar/Autumn-style adapters only if market need appears; keep Postgres canonical.

## Sources

- Autumn overview — https://docs.useautumn.com/documentation/concepts/overview
- Autumn balances — https://docs.useautumn.com/documentation/concepts/balances
- Autumn plan items — https://docs.useautumn.com/documentation/concepts/plan-items
- Polar usage billing — https://polar.sh/docs/features/usage-based-billing/introduction
- Polar products — https://polar.sh/docs/features/products
- Polar webhooks — https://polar.sh/docs/integrate/webhooks/events
- Polar customer portal — https://polar.sh/docs/features/customer-portal/introduction
- Stripe Entitlements — https://docs.stripe.com/billing/entitlements
- Stripe usage-based billing — https://docs.stripe.com/billing/subscriptions/usage-based/implementation-guide
- Stripe customer portal — https://docs.stripe.com/customer-management
- Stripe webhooks — https://docs.stripe.com/webhooks
- AbacatePay checkout — https://docs.abacatepay.com/pages/payment/create
- AbacatePay PIX transparente — https://docs.abacatepay.com/pages/transparents/create
- AbacatePay webhooks — https://docs.abacatepay.com/pages/webhooks
