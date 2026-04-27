# Changelog

## 0.6.0 — 2026-04-27

### Breaking
- **`services.ingestUsage` input redesigned.** Removed `teamId` (implicit from API-key auth) and `meterId` as required. Now accepts either `meterId` or `eventName`; the server resolves `eventName` → meter for the authed team. `contactId` (UUID FK) replaced with `externalId` (string) to match the rest of the contracts. When no meter is configured for the event, the call returns `{ success: true }` (no-op).

### Migration
- `client.services.ingestUsage({ teamId, meterId, contactId, quantity, idempotencyKey })` → `client.services.ingestUsage({ eventName, externalId?, quantity, idempotencyKey })` (or pass `meterId` directly if already known).

## 0.5.0 — 2026-04-26

### Breaking
- **Better-auth `hyprpay` plugin re-enabled** at `@montte/hyprpay/better-auth`. Signup now creates a HyprPay contact (`type: "cliente"`) via the SDK's `client.contacts.create({ ..., externalId: user.id })`; user updates sync the `name` via `client.contacts.update({ externalId, name })`. Consumers who upgraded between 0.4.0 and 0.5.0 may have been relying on the absence of this side-effect — re-evaluate before upgrading.
- **`createAuth` deps no longer accepts `hyprpayClient`.** The plugin instantiates its own SDK client from `env.HYPRPAY_API_KEY`. Callers should remove the field from their `createAuth({ ... })` invocation; the env interface gains `HYPRPAY_API_KEY`.

## 0.4.1 — 2026-04-26

### Changed
- **Contract output schemas tightened** — `z.unknown()` outputs replaced with hand-rolled row schemas across `services`, `contacts`, and `coupons` namespaces. SDK consumers now receive typed responses (full contact / subscription / subscription-item / coupon rows). Schemas live inline in `libraries/hyprpay/src/contract.ts`; libraries cannot import `@core/database`, so the row literals shadow the Drizzle row types.
- **Contract input schemas aligned with handler reality** — `services.cancelSubscription`, `services.updateItem`, `services.removeItem` now key on `{ id }` (matches handler), not `{ subscriptionId }` / `{ itemId }`. `services.createSubscription` drops the unused `externalId` branch and `couponCode` field. `services.ingestUsage` exposes the real meter event shape (`{ teamId, meterId, contactId, quantity, idempotencyKey, properties }`). `coupons.create` and `coupons.update` move from `z.unknown()` to real Zod inputs.

## 0.4.0 — 2026-04-26

### Breaking
- **Contract restructure** — `hyprpayContract` removed. `billingContract` exported instead, with namespaces `services`, `contacts`, `coupons`, `customerPortal`. Procedures previously at the contract root (`create`, `get`, `list`, `update`) and under `subscriptions`/`usage`/`benefits` are gone. The new shape mirrors `modules/billing/router/*` 1:1 and binds via `implementer`.
- **Contact references are discriminated unions** — every contact-keyed input accepts either `{ id }`/`{ contactId }` (internal UUID) or `{ externalId }`. The middleware `requireContact` resolves either form. SaaS callers continue to use `externalId`; the dashboard calls the same procedures with internal `id`.
- **Thin client** — `createHyprPayClient` now returns `ContractRouterClient<typeof billingContract>` directly. The `ResultAsync` wrappers, `HyprPayError`, and the `customers`/`subscriptions`/`usage`/`benefits` namespaces are gone. Call shape is `client.services.ingestUsage(input)`, `client.contacts.create(input)`, etc., and returns native promises.
- **Subpath `./better-auth` removed** — the better-auth plugin is temporarily disabled while it gets rewired against the new contract. The directory remains but is unexported and the plugin is not registered in `@core/authentication`. Follow-up task: re-author against `client.contacts.create`/`client.contacts.update`.
- **`./types` and `./errors` removed** — types are inferred from the contract via `z.infer`. Errors flow through native oRPC error handling (`ORPCError`).

### Migration
- `client.customers.get(externalId)` → `client.contacts.getById({ externalId })`
- `client.customers.create({ name, ... })` → `client.contacts.create({ name, ... })`
- `client.subscriptions.create({ externalId, items })` → `client.services.createSubscription({ contactId, startDate, items })`
- `client.subscriptions.cancel({ subscriptionId })` → `client.services.cancelSubscription({ id })`
- `client.subscriptions.list(externalId)` → `client.services.getContactSubscriptions({ externalId })`
- `client.usage.ingest({ externalId, meterId, quantity })` → `client.services.ingestUsage({ externalId, meterId, quantity })`
- `client.coupons.validate({ code, priceId })` → `client.coupons.validate({ code, priceId })` (unchanged)
- `client.customerPortal.createSession(externalId)` → `client.customerPortal.createSession({ externalId })`
- Result handling: drop `.match`/`.isErr` — wrap `await client.X.Y(input)` with `fromPromise` if neverthrow is desired upstream.

## 0.3.0 — 2026-04-26

### Breaking
- All customer-scoped endpoints now accept `externalId` instead of `customerId`. The internal HyprPay customer UUID is no longer exposed in the SDK — SaaS callers reference customers exclusively by the `externalId` they set at creation. Affected:
  - `subscriptions.create({ externalId, items, couponCode? })`
  - `subscriptions.list(externalId)`
  - `usage.ingest({ externalId, meterId, quantity, ... })`
  - `usage.list({ externalId, meterId? })`
  - `benefits.check({ externalId, benefitId })`
  - `benefits.list(externalId)`
  - `customerPortal.createSession(externalId)`
- Server handlers resolve `externalId → customer.id` internally. Returns 404 when `externalId` does not match a known customer.

### Migration
- Replace every `customerId: cus_xxx` with `externalId: yourId` in SDK calls.
- Customers must be created with an `externalId` before they can be referenced (`customers.create({ externalId, name, email, ... })`).
- Better Auth plugin: opt into org-level customers via `customerType: "organization"` and sync seat count from members via `seats.autoSyncFromMembers: true` (see SKILL.md).

## 0.2.0 — 2026-04-23

### Added
- `subscriptions` namespace: `create`, `cancel`, `list`, `addItem`, `updateItem`, `removeItem`
- `usage` namespace: `ingest` (DBOS-backed, durable, idempotent), `list`
- `benefits` namespace: `check` (granted/revoked/not_found), `list` with benefit details
- `coupons` namespace: `validate` with structured error reasons and price-scope check
- `customerPortal` namespace: `createSession` — signed JWT URL, 15-min TTL
- New input types: `CreateSubscriptionInput`, `CancelSubscriptionInput`, `AddSubscriptionItemInput`, `UpdateSubscriptionItemInput`, `IngestUsageInput`, `ListUsageInput`, `CheckBenefitInput`, `ValidateCouponInput`

## [0.1.6]

### Added

- Better Auth plugin: `databaseHooks.user.update.after` — syncs customer name to Montte when the Better Auth user's name is updated

## [0.1.5]

### Fixed

- Default mapper falls back to `user.email` when `user.name` is empty — magic link sign-ups often have no name set, causing `BAD_REQUEST` from the `name: z.string().min(1)` contract validation

## [0.1.4]

### Fixed

- Rebuild with correct better-auth plugin (databaseHooks) — 0.1.3 dist was built before master merge, still contained old hooks.after code

## [0.1.3]

### Fixed

- Exclude test files from subpaths build script (glob was picking up `*.test.ts`, bundling 617KB test files into the package)

## [0.1.2]

### Fixed

- Set correct default base URL to `https://app.montte.co` and fix RPC path from `/sdk/orpc` to `/api/sdk/hyprpay` — previous path never reached the server router

## [0.1.1]

### Fixed

- Better Auth plugin: replace request `after` hooks with `databaseHooks.user.create.after` — fires on every user creation regardless of sign-up method (email, magic link, OAuth, OTP); eliminates `TypeError: Cannot read properties of undefined (reading 'headers')` crash caused by raw async after-hook handlers returning `undefined` instead of a proper response object
- Better Auth plugin: replace try/catch on `onCustomerCreate` with `fromPromise` (neverthrow)
- Exclude test files from tsconfig and subpaths build script

## [0.1.0]

### Added

- Initial release of `@montte/hyprpay` SDK
- Customer lifecycle sync with Montte via oRPC contract
- Better Auth plugin integration (`./better-auth` subpath)
- Contract-first API design (`./contract` subpath)
