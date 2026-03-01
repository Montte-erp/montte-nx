# Contacts Module (Clientes & Fornecedores)

**Date:** 2026-03-01
**Status:** Approved
**Stage:** Alpha (early access gated)

---

## Overview

A unified "Contatos" module to manage clients and suppliers. One entity type with a `type` field (`cliente | fornecedor | ambos`). Contacts are team-scoped and can be optionally linked to transactions.

---

## Data Model

### New table: `contacts`

| Field          | Type                          | Notes                        |
|----------------|-------------------------------|------------------------------|
| `id`           | UUID PK                       |                              |
| `teamId`       | UUID FK                       | team-scoped                  |
| `name`         | text (required)               |                              |
| `type`         | enum: cliente/fornecedor/ambos| required                     |
| `email`        | text                          | optional                     |
| `phone`        | text                          | optional                     |
| `document`     | text                          | CPF or CNPJ raw value        |
| `documentType` | enum: cpf/cnpj/null           | optional                     |
| `notes`        | text                          | optional                     |
| `createdAt`    | timestamp                     | defaultNow                   |
| `updatedAt`    | timestamp                     | defaultNow                   |

Indexes: `team_id`, unique(`team_id`, `name`)

### Change to `transactions` table

- Add optional `contactId` UUID FK → `contacts.id` (`onDelete: set null`)

---

## API Layer (oRPC)

**New router:** `apps/web/src/integrations/orpc/router/contacts.ts`

| Procedure | Input | Notes |
|-----------|-------|-------|
| `getAll`  | `{ teamId, type? }` | optional type filter |
| `getById` | `{ id }` | includes linked transaction count |
| `create`  | contact fields | CPF/CNPJ validation |
| `update`  | `{ id, ...fields }` | |
| `remove`  | `{ id }` | blocks if has linked transactions |

**Updates to `transactions.ts` router:**
- Add optional `contactId` to create/update inputs
- Add `contactId` filter to `getAll`
- Include contact name in `getAll` response (join)

---

## Frontend

### Feature folder

```
apps/web/src/features/contacts/
└── ui/
    ├── contacts-columns.tsx     # DataTable columns: name, type badge, document, email, phone
    └── contacts-form.tsx        # Create/Edit sheet form
```

### New route

`apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/contacts.tsx`

- Table + card views with `useViewSwitch`
- "New Contact" button → `useSheet` opens form
- Type filter: All / Cliente / Fornecedor / Ambos
- Bulk delete via `useRowSelection`

### Updates to existing UI

- `transactions-sheet.tsx` — add optional contact combobox (search by name)
- `transactions-columns.tsx` — add contact name column

### Sidebar

Add "Contatos" entry under Finance, gated by `contacts` feature flag (alpha).

---

## Early Access

- Feature flag key: `contacts`
- Stage: `alpha`
- PostHog: create early access feature flag named `contacts`
- Sidebar entry uses existing `flag` gating pattern (same as `asset-bank`, `content`, etc.)
- Billing overview: add to `EARLY_ACCESS_CATEGORY_GATES` or sidebar nav items

---

## Out of Scope (for now)

- Address fields (logradouro, cidade, estado, CEP)
- Payment terms / credit limit
- Bank details
- Invoicing / purchase orders
