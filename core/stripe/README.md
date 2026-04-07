# @core/stripe

Stripe API client wrapper for payment processing and subscription management.

## Exports

| Export        | Purpose                                     |
| ------------- | ------------------------------------------- |
| `.`           | Stripe client factory (`getStripeClient()`) |
| `./constants` | Stripe-related constants                    |

## Usage

```typescript
import { getStripeClient } from "@core/stripe";

const stripe = getStripeClient();
await stripe.subscriptions.list({ customer: customerId });
```

## Details

Initializes the Stripe SDK with API version `2026-02-25.clover` using the secret key from `@core/environment`. Used by the authentication layer for subscription management and by billing features for payment processing.
