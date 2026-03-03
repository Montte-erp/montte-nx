# Espaço Limits & Billing Add-ons Design

## Summary

Three changes:
1. Rename all "team" UI references to "espaço" (pt-BR)
2. Enforce espaço limits based on pay-as-you-go status
3. Add platform add-on cards to the billing page (PAYG-gated)

---

## Section 1: Terminology — "team" → "espaço"

### Files

**`apps/web/src/layout/dashboard/ui/sidebar-scope-switcher.tsx`**
- Section label "Teams" / "Projects" → "Espaços"
- "New Project" button → "Novo Espaço"
- Limit message "Project limit reached" → "Limite de espaços atingido"
- Remove `+` icon buttons next to "Espaços" and "Organizações" section labels
- New espaço creation only via the dedicated bottom button

**`apps/web/src/features/organization/ui/create-team-form.tsx`**
- Full pt-BR translation
- Title: "Criar espaço"
- Name field label: "Nome", placeholder: "Meu espaço"
- Description field label: "Descrição", placeholder: "Descrição opcional"
- Submit button: "Criar espaço"
- Error/success toasts in pt-BR

---

## Section 2: Espaço Limits

### Logic

| Status | Limit |
|--------|-------|
| Free (no card) | 1 espaço |
| Pay-as-you-go (has card) | 6 espaços |

### Implementation

**`apps/web/src/integrations/orpc/router/organization.ts`** — `getActiveOrganization`

Call `getPaymentStatus` (billing router, already exists) inside the procedure to check if the org has a Stripe payment method. Return `projectLimit: hasCard ? 6 : 1` instead of `Number.POSITIVE_INFINITY`.

The scope switcher already reads `projectLimit` and `projectCount` to disable the create button — no further UI changes needed for limit enforcement.

---

## Section 3: Add-ons on Billing Page

### Cards to display

| Add-on | Price | Features |
|--------|-------|----------|
| Boost | R$199/mês | SSO, white label, 2FA enforcement, unlimited espaços |
| Scale | R$599/mês | Boost + SAML, RBAC, audit logs, SLA 24h |
| Enterprise | R$2.500+/mês | Scale + holdings, multiple CNPJs, SLA 4h, dedicated support |

### PAYG Gate

- Reuse existing `getPaymentStatus` result (already fetched on billing page)
- No card → button disabled + tooltip "Ative o pay as you go para adquirir add-ons"
- Card + addon inactive → "Assinar" button (subscribes via Stripe)
- Card + addon active → "Ativo" badge

### Cleanup

- Remove `TELEGRAM`, `WHATSAPP`, `MENSAGERIA_BUNDLE` from `AddonName` enum in `packages/stripe/src/constants.ts`
- Remove their env vars from `packages/environment/src/server.ts`
