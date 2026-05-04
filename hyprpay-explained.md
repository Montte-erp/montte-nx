# HyprPay — Explicação para Codex

Codex chegou perto mas errou eixo central. Correções abaixo.

---

## 1. Eixo central: gateway-agnostic, não "Better Auth de billing"

Codex pensa HyprPay = dono do domínio (products/prices/subs vivem nele). **Errado.**

**HyprPay = camada de execução** sobre gateway escolhido pelo dev (Asaas, Stripe, Mercado Pago, Pagar.me). Domínio (meters, subscriptions, invoices) mora no **app** (Montte). HyprPay normaliza chamada ao gateway.

Análogo melhor: **Better Auth para pagamento**. Better Auth não decide schema do user — dá adapter + plugins. HyprPay igual: adapter de gateway + plugins.

```ts
// app define gateway no config — swap sem mudar código de negócio
export const billing = hyprpay({
  database: drizzleAdapter(db, { schema: "billing" }), // schema configurável
  getSession,
  gateway: asaas({ apiKey: env.ASAAS_KEY }),
  // troca pra Stripe sem tocar resto:
  // gateway: stripe({ apiKey: env.STRIPE_KEY }),
  plugins: [usage(), seats(), benefits()],
});
```

---

## 2. Surface mínima estilo better-auth

Slots do core: `database`, `getSession`, `gateway`, `plugins`. Fim.

**Não tem** built-in: email, workflow engine, queue, scheduler, retry de webhook. Codex listou "webhooks com idempotência, retry, replay, audit log" como core — errado. Plugin faz.

```ts
// retry/replay = plugin que usa infra do app
plugins: [
  webhooks({
    scheduler: dbosScheduler(workflowClient), // app injeta DBOS
    mailer: resendMailer(resend),             // app injeta Resend
  }),
]
```

Razão: forçar email/queue baked-in mata liberdade. Dev já tem stack próprio.

---

## 3. Schema configurável

HyprPay dona migrations + schema, mas nome do schema Postgres é prop do adapter (`schema: "billing"`). Não polui `public`.

---

## 4. DX correto (domínio vive no app)

Codex acertou shape de API. Refinamento — `customerExternalId` é sempre `organization.id` do Better Auth (convenção Montte):

```ts
// uso (ingest evento imutável)
await billing.usage.ingest({
  event: "ai.tokens",
  customerExternalId: organization.id,
  quantity: 1200,
  cost: { amount: 12, currency: "BRL" },
  idempotencyKey,
});

// ação cobrável (wrap)
await billing.billable.run({
  event: "classification.run",
  customerExternalId: organization.id,
  run: () => classifyTransaction(input),
  usage: (r) => ({ quantity: r.usage.totalTokens }),
});

// entitlement (benefit/feature flag)
const ok = await billing.entitlements.has(organization.id, "analises-avancadas");

// customer state (single API — codex acertou)
const state = await billing.customer.state(organization.id);
// { subscription, benefits, meters, credits, status }
```

---

## 5. Gateway abstraction (a parte que codex não viu)

```ts
// HyprPay define interface; cada gateway implementa
interface GatewayAdapter {
  createCheckoutSession(input): Promise<CheckoutSession>;
  createSubscription(input): Promise<Subscription>;
  cancelSubscription(id): Promise<void>;
  refund(chargeId, amount): Promise<Refund>;
  parseWebhook(req): Promise<NormalizedEvent>; // normaliza pra forma única
}

// adapter Asaas converte Asaas-shape → HyprPay-shape
// adapter Stripe converte Stripe-shape → HyprPay-shape
// app consome só HyprPay-shape
```

---

## 6. Montte ≠ HyprPay (codex acertou divisão)

- **HyprPay** = SDK open-source, executa billing contra gateway escolhido.
- **Montte** = ERP que **usa** HyprPay + plugin `montteAnalytics()` que escuta eventos pra MRR/ARR/churn/LTV/margem.

Plugin shape codex acertou:

```ts
hyprpay({
  // ...
  plugins: [montteAnalytics({ apiKey, endpoint })],
});
```

Eventos enviados ao Montte:

- `hyprpay.usage.ingested`
- `hyprpay.order.paid`
- `hyprpay.subscription.active`
- `hyprpay.subscription.canceled`
- `hyprpay.benefit.granted`
- `hyprpay.customer.state_changed`
- `hyprpay.cost.recorded`

---

## TL;DR pra codex

| Codex pensou                                       | Realidade                                                       |
| -------------------------------------------------- | --------------------------------------------------------------- |
| HyprPay é dono do domínio (products/subs/prices)   | HyprPay normaliza gateway; domínio vive no app                  |
| Webhook retry/replay/audit = core                  | = plugin (app injeta scheduler/mailer)                          |
| "Better Auth de billing" genérico                  | Better Auth + **gateway-agnostic** é o ponto                    |
| Schema fixo                                        | Schema name configurável                                        |
| Built-in email/workflow                            | Zero engines built-in — composição via plugin                   |

**Resumo numa frase:** HyprPay é o better-auth de billing com adapter de gateway swappable; domínio mora no app; engines (email/queue/workflow) vêm de plugins que o app injeta.

---

## Fluxo completo

```
App executa ação paga
  -> billing.billable.run() ou billing.usage.ingest()
  -> HyprPay registra evento imutável (na tabela do schema configurado)
  -> Meter agrega uso
  -> Benefits/Customer State decidem acesso (entitlements)
  -> Gateway adapter cobra no fim do período (Asaas/Stripe/MP)
  -> Plugin montteAnalytics emite evento
  -> Montte calcula MRR, churn, LTV, custo, lucro, margem
```
