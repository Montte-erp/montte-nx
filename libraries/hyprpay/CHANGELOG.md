# Changelog

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
