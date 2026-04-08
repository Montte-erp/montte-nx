---
name: "@montte/hyprpay/overview"
description: >
  Use when integrating @montte/hyprpay SDK to sync customer lifecycle with Montte.
  Covers createHyprPayClient setup, customers.create/get/update/list, HyprPayError handling,
  and the better-auth plugin for automatic customer creation on signup.
type: core
library: "@montte/hyprpay"
library_version: "0.1.0"
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

## Error Handling

All errors are `HyprPayError` with typed `code` and `statusCode`:

```typescript
import { HyprPayError } from "@montte/hyprpay";

try {
  await hyprpay.customers.get("unknown");
} catch (err) {
  if (err instanceof HyprPayError) {
    err.code;       // "NOT_FOUND" | "UNAUTHORIZED" | ...
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
