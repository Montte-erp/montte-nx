# Early Access Banners + ERP Restructure — Design

**Date:** 2026-03-02

## Overview

Three related changes:

1. Move finance routes up one level (remove `finance/` prefix)
2. Replace `insights/new.tsx` with inline empty-insight creation
3. Add `EarlyAccessBanner` to all early access screens

---

## 1. Finance Route Restructure

### What changes

Move all files from `_dashboard/finance/` → `_dashboard/`:

- `finance/contacts.tsx` → `contacts.tsx`
- `finance/bank-accounts.tsx` → `bank-accounts.tsx`
- `finance/tags.tsx` → `tags.tsx`
- `finance/credit-cards.tsx` → `credit-cards.tsx`
- `finance/transactions.tsx` → `transactions.tsx`
- `finance/bills.tsx` → `bills.tsx`
- `finance/categories.tsx` → `categories.tsx`
- `finance/goals.tsx` → `goals.tsx`

### Also required

- Remove `finance.tsx` layout file if it exists
- Update `createFileRoute(...)` path string in each moved file
- Update all `Link to=` and `navigate({ to: ... })` references across codebase
- Update sidebar nav items pointing to finance routes

---

## 2. New Insight Flow

### What changes

- Delete `insights/new.tsx`
- In `insights/index.tsx`: "New Insight" button and context panel action call `orpc.insights.create` directly with default values, then redirect to `$insightId`

### Default values

```ts
name: "Novo insight";
type: "trends";
config: {
} // default empty config
```

### Button state

- Shows `Loader2` spinner while mutation is pending
- Disabled during pending

---

## 3. Feature Feedback Banner

### Component change — `early-access-banner.tsx`

No change needed. The component already accepts a `template` prop and is ready to use.

### Banner templates

**Analytics (Dashboards + Insights)**

```ts
{
  badgeLabel: "Analytics Avançado",
  message: "Esta funcionalidade está em fase beta.",
  ctaLabel: "Deixar feedback",
  bullets: [
    "Crie dashboards personalizados com seus insights",
    "Analise tendências, funis e retenção de usuários",
    "Seus comentários nos ajudam a melhorar"
  ]
}
```

**Contacts**

```ts
{
  badgeLabel: "Contatos",
  message: "Esta funcionalidade está em fase alpha.",
  ctaLabel: "Deixar feedback",
  bullets: [
    "Cadastre clientes e fornecedores",
    "Vincule contatos a transações e cobranças",
    "Seus comentários nos ajudam a melhorar"
  ]
}
```

### Placement

| File                          | Position                                               |
| ----------------------------- | ------------------------------------------------------ |
| `dashboards/index.tsx`        | Below `<PageHeader />`                                 |
| `dashboards/$dashboardId.tsx` | New `<main>` wrapper, banner at top above `<Suspense>` |
| `insights/index.tsx`          | Below `<PageHeader />`                                 |
| `insights/$insightId.tsx`     | Above `<InsightBuilder />` in final return             |
| `contacts.tsx` (new path)     | Below `<DefaultHeader />`                              |
