# Migração de `neverthrow` para `better-result`

## Objetivo

Migrar **todo** uso remanescente de `neverthrow` no projeto para `better-result`, padronizando tratamento de erros esperados e mantendo comportamento atual (contratos, UX e mensagens de erro).

---

## Regra de migração

- Não misturar `neverthrow` e `better-result` no mesmo módulo.
- Ao tocar um arquivo que usa `neverthrow`, migrar o arquivo inteiro para `better-result`.
- Preservar contratos de API e mensagens de erro existentes.
- Não regredir fluxos de criação/edição/exclusão/importação já validados.
- Remover dependências `neverthrow` dos `package.json` somente após o último arquivo do pacote ter sido migrado.

---

## Inventário atual (fonte: `rg` no repositório)

### Arquivos já migrados para `better-result`

- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-account-form-sheet.tsx`

### Frontend (`apps/web`)

- `apps/web/src/utils/finance/installments.ts`
- `apps/web/src/lib/store.ts`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-number.tsx`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-money.tsx`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-text.tsx`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-select.tsx`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-combobox.tsx`
- `apps/web/src/blocks/data-table/inline-edit/inline-edit-date.tsx`
- `apps/web/src/blocks/data-table/data-import/use-data-import.tsx`
- `apps/web/src/blocks/data-table/data-import/data-import-section.tsx`
- `apps/web/src/blocks/data-table/data-import/data-import-button.tsx`
- `apps/web/src/routes/_authenticated/onboarding.tsx`
- `apps/web/src/routes/_authenticated/-onboarding/onboarding-wizard.tsx`
- `apps/web/src/routes/auth/magic-link.tsx`
- `apps/web/src/routes/api/upload.ts`
- `apps/web/src/routes/api/files/$.ts`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/-layout/sidebar-scope-switcher.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-form-sheet.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-tags/tags-form-sheet.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-card-form-sheet.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/transaction-form-sheet.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-reports/report-form-sheet.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys.tsx`

### E2E (`apps/web-e2e`)

- `apps/web-e2e/global-setup.ts`
- `apps/web-e2e/helpers/db.ts`

### Core / Infraestrutura

- `core/database/src/testing/setup-test-db.ts`

### Dependências com `neverthrow`

- `package.json`
- `apps/web/package.json`
- `apps/landing/package.json`
- `core/database/package.json`
- `modules/cashbook/package.json`
- `modules/inbox/package.json`
- `modules/insights/package.json`

---

## Plano de execução

### Fase 1 — Núcleo compartilhado de UI
1. Migrar `data-table/inline-edit/*` para `better-result`.
2. Migrar `data-table/data-import/*`.
3. Migrar `apps/web/src/lib/store.ts` e `apps/web/src/utils/finance/installments.ts`.

### Fase 2 — APIs e onboarding/routes auxiliares
1. Migrar APIs e rotas de autenticação/onboarding:
   - `routes/auth/magic-link.tsx`
   - `routes/_authenticated/onboarding.tsx`
   - `routes/_authenticated/-onboarding/onboarding-wizard.tsx`
   - `routes/api/upload.ts`
   - `routes/api/files/$.ts`
   - `routes/_authenticated/$slug/$teamSlug/-layout/sidebar-scope-switcher.tsx`

### Fase 3 — Telas de domínio (legacy dashboard)
1. Migrar `categories`.
2. Migrar `tags`.
3. Migrar `credit-cards`, `transactions`, `reports`, `api-keys`.

### Fase 4 — E2E e infra de testes
1. Migrar helpers/setup em `apps/web-e2e`.
2. Migrar `core/database/src/testing/setup-test-db.ts`.

### Fase 5 — Dependências
1. Remover `neverthrow` dos `package.json` dos pacotes onde não houver mais imports.
2. Rodar `bun install`.
3. Validar lockfile.

---

## Checklist de conclusão

- [ ] `rg -n "neverthrow|fromPromise|fromThrowable|ResultAsync|\berr\b|\bok\(" --glob '!**/node_modules/**'` sem imports de `neverthrow` em código.
- [ ] Nenhum arquivo mixando `neverthrow` e `better-result`.
- [ ] `bun --filter web typecheck` passando.
- [ ] `bun --filter web check` sem regressões relacionadas à migração.
- [ ] `neverthrow` removido dos `package.json` quando aplicável e `bun.lock` atualizado.

---

## Comando de validação inicial

```bash
(cd "$(git rev-parse --show-toplevel)" && rg -l "neverthrow" --glob '!**/node_modules/**' --glob '!**/.worktrees/**' --glob '!**/.claude/**')
```


