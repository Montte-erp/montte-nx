---
name: "@montte/hyprpay/overview"
description: >
   Use when integrating @montte/hyprpay SDK to sync customer lifecycle with Montte.
   Covers createHyprPayClient setup, customers.create/get/update/list, subscriptions,
   usage ingestion, benefits, coupons, customer portal, HyprPayError handling,
   and the better-auth plugin for automatic customer creation on signup.
type: core
library: "@montte/hyprpay"
library_version: "0.2.0"
sources:
   - "Montte-erp/montte-nx:libraries/hyprpay/src/index.ts"
   - "Montte-erp/montte-nx:libraries/hyprpay/src/client.ts"
   - "Montte-erp/montte-nx:libraries/hyprpay/src/errors.ts"
---

# HyprPay SDK

## Setup

```typescript
import { createHyprPayClient } from "@montte/hyprpay";

const hyprpay = createHyprPayClient({
   apiKey: process.env.MONTTE_API_KEY, // generate at Montte → Settings → API Keys
   // baseUrl: "https://api.montte.com.br" (default)
});
```

## Customers API

```typescript
// Create — always pass externalId (your app's user ID) for idempotent lookups
await hyprpay.customers.create({
   name: "Maria Silva",
   email: "maria@exemplo.com",
   externalId: user.id,
});

// Get by externalId
const customer = await hyprpay.customers.get(user.id);

// Update
await hyprpay.customers.update(user.id, { email: "novo@email.com" });

// List (paginated)
const { items, total } = await hyprpay.customers.list({ page: 1, limit: 20 });
```

## Subscriptions API

```typescript
// Create subscription with items
const { subscription, checkoutUrl } = await hyprpay.subscriptions.create({
   customerId: user.id,
   items: [{ priceId: "price-123", quantity: 1 }],
   couponCode: "PROMO10", // optional
}).match((v) => v, (e) => { throw e });

// Cancel
await hyprpay.subscriptions.cancel({ subscriptionId: sub.id });
await hyprpay.subscriptions.cancel({ subscriptionId: sub.id, cancelAtPeriodEnd: true });

// List
const subs = await hyprpay.subscriptions.list(user.id).match(
   (v) => v,
   (e) => { throw e },
);

// Manage items
await hyprpay.subscriptions.addItem({ subscriptionId: sub.id, priceId: "price-456" });
await hyprpay.subscriptions.updateItem({ itemId: item.id, quantity: 3 });
await hyprpay.subscriptions.removeItem(item.id);
```

## Usage API

```typescript
// Ingest usage event (queued via DBOS — durable)
await hyprpay.usage.ingest({
   customerId: user.id,
   meterId: "meter-abc",
   quantity: 5,
   properties: { source: "api" },
   idempotencyKey: requestId, // optional but recommended
});

// List usage events
const events = await hyprpay.usage.list({ customerId: user.id, meterId: "meter-abc" });
```

## Benefits API

```typescript
// Check a specific benefit
const result = await hyprpay.benefits.check({ customerId: user.id, benefitId: "benefit-xyz" });
// result.status: "granted" | "revoked" | "not_found"

// List all benefit grants
const grants = await hyprpay.benefits.list(user.id);
```

## Coupons API

```typescript
// Validate a coupon before subscription creation
const validation = await hyprpay.coupons.validate({ code: "PROMO10" });
if (validation.valid) {
   // validation.coupon has type, amount, duration, scope
} else {
   // validation.reason: "not_found" | "inactive" | "expired" | "max_uses_reached" | "price_scope_mismatch"
}
```

## Customer Portal API

```typescript
// Generate a short-lived signed portal URL (15 minutes)
const { url, expiresAt } = await hyprpay.customerPortal.createSession(user.id);
// Embed in email or show as "Gerenciar assinatura" link
```

## Error Handling

All errors are `HyprPayError` with typed `code` and `statusCode`:

```typescript
import { HyprPayError } from "@montte/hyprpay";

try {
   await hyprpay.customers.get("unknown");
} catch (err) {
   if (err instanceof HyprPayError) {
      err.code; // "NOT_FOUND" | "UNAUTHORIZED" | ...
      err.statusCode; // 404
   }
}
```

## better-auth Plugin

```typescript
import { hyprpay } from "@montte/hyprpay/better-auth";

betterAuth({
   plugins: [
      hyprpay({
         apiKey: process.env.MONTTE_API_KEY,
         createCustomerOnSignUp: true, // zero-config hook on afterSignUp
         customerData: (user) => ({
            name: user.name,
            email: user.email,
            externalId: user.id,
         }),
      }),
   ],
});
```

## Common Mistakes

- **Missing externalId**: Without `externalId`, you cannot do `customers.get()` later
- **Wrong API key**: Keys must be created at Montte Settings → Chaves de API with `teamId` in metadata
- **Duplicate name**: Montte enforces unique contact names per team — use `externalId` to identify, not just names
- **Blocking signup**: The better-auth plugin catches all errors silently — HyprPay unavailability never fails auth
