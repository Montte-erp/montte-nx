# Bills Module (Contas a Pagar e Contas a Receber)

**Date:** 2026-03-01
**Status:** Approved for implementation

---

## Overview

A separate bills module for managing accounts payable (contas a pagar) and accounts receivable (contas a receber). Bills are distinct entities from transactions — paying a bill generates a transaction. Bills support installment plans (parcelamento) and recurring schedules.

---

## Decisions

| Question | Decision |
|----------|----------|
| Relationship to transactions | Separate entities — paying a bill auto-creates a transaction |
| Fields | Extended: amount, due date, type, status, account, category, recurrence OR installment |
| Installments | Flexible: fixed count + auto-divide total OR custom per-installment amounts |
| Recurrence | Rolling window, user-configured horizon (e.g. 3 months ahead) |
| Recurring vs installments | Mutually exclusive |
| Pay action | Auto-creates pre-filled transaction, user confirms |
| Transaction actions | Convert to bill series (original transaction kept) |
| Navigation | Separate `/finance/bills` page with Contas a Pagar / Contas a Receber tabs |

---

## Data Model

### `bills` table (`packages/database/src/schemas/bills.ts`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | auto-generated |
| `teamId` | UUID FK | required |
| `name` | TEXT | required |
| `description` | TEXT | nullable |
| `type` | enum | `"payable"` \| `"receivable"` |
| `status` | enum | `"pending"` \| `"paid"` \| `"overdue"` \| `"cancelled"` — computed on read for overdue |
| `amount` | numeric(12,2) | required |
| `dueDate` | date | required |
| `paidAt` | timestamp | nullable — set when paid |
| `bankAccountId` | UUID FK → bankAccounts | nullable |
| `categoryId` | UUID FK → categories | nullable |
| `attachmentUrl` | TEXT | nullable |
| `installmentGroupId` | UUID | nullable — groups all installments |
| `installmentIndex` | integer | nullable — 1-based (e.g. 1 of 12) |
| `installmentTotal` | integer | nullable — total installments in group |
| `recurrenceGroupId` | UUID FK → recurrenceSettings | nullable |
| `transactionId` | UUID FK → transactions | nullable — set when paid |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `recurrenceSettings` table

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | = `recurrenceGroupId` in bills |
| `teamId` | UUID FK | required |
| `frequency` | enum | `"weekly"` \| `"biweekly"` \| `"monthly"` \| `"quarterly"` \| `"yearly"` |
| `windowMonths` | integer | how far ahead to generate bills (user-configured) |
| `endsAt` | date | nullable — null = forever |
| `createdAt` | timestamp | |

**Overdue status** is computed on read (no stored enum for overdue):
```typescript
status = bill.paidAt ? "paid"
       : bill.dueDate < today ? "overdue"
       : "pending"
```

---

## UI/UX

### `/finance/bills` Page

```
[Contas a Pagar] [Contas a Receber]          ← tabs
─────────────────────────────────────────
Filters: Month picker | Status | Category | Search
                                    [+ Nova Conta]
─────────────────────────────────────────
Summary bar:
  Total Pendente: R$ 2.400   Vencidas: R$ 300   Pagas: R$ 1.200
─────────────────────────────────────────
DataTable:
  Name | Category | Due Date | Amount | Status | Actions
  ─────────────────────────────────────────────────────
  Aluguel        Casa    15/03  R$2.000  🟡 Pendente  [✓ Pagar] [⋯]
  Netflix        Lazer   22/03  R$55,90  🔴 Vencida   [✓ Pagar] [⋯]
  Salário (2/3)  Receita 01/03  R$3.000  🟢 Paga      [⋯]
  Freelance      Receita 10/03  R$800    🟡 Pendente  [✓ Receber] [⋯]
```

### Bill Form — Installment UX

- Toggle: `[ ] Parcelar` — reveals installment section
- Input: "Número de parcelas" + choice of:
  - "Valor total" → auto-divides equally
  - "Valor por parcela" → applies same value to all
  - "Valores irregulares" → individual inputs per installment
- Preview: scrollable mini-list showing all installments with amounts + due dates

### Bill Form — Recurrence UX

- Toggle: `[ ] Recorrente` — reveals recurrence section (mutually exclusive with installments)
- Frequency selector: weekly / biweekly / monthly / quarterly / yearly
- Optional end date
- Setting: "Gerar com antecedência de X meses" (1–12, user-configured)

### Pay / Receive Action

Clicking "Pagar" / "Receber" opens a small confirmation credenza pre-filled with:
- Amount (editable — actual payment may differ)
- Date (defaults to today)
- Bank account (pre-filled from bill)
- Category (pre-filled from bill)

One click to confirm → creates transaction, links `transactionId`, sets `paidAt`.

---

## Transaction Actions (new items in `⋯` row menu)

### 1. Parcelar Transação
Opens credenza pre-filled with transaction's amount, category, account. User configures:
- Number of installments
- Total amount OR per-installment amount OR irregular
- First due date (defaults to transaction date + 1 month)
- Name (defaults to transaction name)

Creates N bill records with shared `installmentGroupId`. Original transaction untouched.

### 2. Criar Transação Recorrente
Opens credenza pre-filled with transaction data. User configures:
- Frequency
- Start date (defaults to transaction date + 1 period)
- End date (optional)
- Window horizon (months ahead to generate)

Creates a `recurrenceSettings` record + initial bill occurrences. Original transaction untouched.

### 3. Marcar como Não Pago / Não Recebido
Only visible on transactions linked to a bill (`transactionId` present on a bill record).
- Deletes the transaction
- Resets `bill.status = "pending"`, clears `bill.paidAt` and `bill.transactionId`

---

## oRPC Router (`apps/web/src/integrations/orpc/router/bills.ts`)

| Procedure | Description |
|-----------|-------------|
| `getAll` | Filtered by type, status, month, category; paginated |
| `create` | Single bill, installment group, or recurrence bootstrap |
| `update` | Edit bill; option to update all future in recurring group |
| `pay` | Creates transaction, links `transactionId`, sets `paidAt` |
| `unpay` | Deletes linked transaction, resets bill to pending |
| `cancel` | Soft cancel (keeps record) |
| `remove` | Hard delete (only if pending) |
| `createFromTransaction` | Powers "parcelar" and "criar recorrente" transaction actions |

---

## Background Worker (`apps/worker/src/workers/bill-recurrence.ts`)

- **Trigger**: daily cron job
- **Logic**: for each active `recurrenceSettings`, find the last generated occurrence → fill gaps up to `now + windowMonths`
- Uses existing BullMQ patterns from `packages/queue/`
- No cron needed for overdue detection — computed on read

---

## File Structure

```
packages/database/src/schemas/bills.ts          ← new schema
apps/web/src/features/bills/
├── hooks/
│   └── use-bill-form.ts
├── ui/
│   ├── bills-columns.tsx
│   ├── bills-form.tsx                          ← create/edit with installment/recurrence toggles
│   ├── bill-pay-credenza.tsx                   ← pay confirmation
│   ├── bill-installment-preview.tsx            ← scrollable installment preview
│   └── bill-from-transaction-credenza.tsx      ← "parcelar" and "criar recorrente" actions
apps/web/src/integrations/orpc/router/bills.ts  ← new router
apps/web/src/routes/.../finance/bills.tsx       ← new route
apps/worker/src/workers/bill-recurrence.ts      ← rolling window cron
packages/queue/src/bill-recurrence.ts           ← queue definition
```
