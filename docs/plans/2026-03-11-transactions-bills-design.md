# Lançamentos e Contas (Transactions & Bills) — Refactoring Design

## Objetivo

Refatorar `transactions-repository`, `bills-repository` e `contacts-repository` para o padrão dos repositórios refatorados: singleton db, Zod validators, `@f-o-t/money`, testes com PGlite. Adicionar validações de tipo, tornar `bills.contactId` FK real, e implementar archive para contacts.

## Decisões

| Decisão                     | Escolha                                                    | Motivo                                    |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| Origin field                | Não adicionar                                              | Inferível por creditCardId/subscriptionId |
| Adjustment type             | Não adicionar                                              | YAGNI, categoria especial resolve         |
| Conciliação                 | Fora do escopo (#647)                                      | Módulo de importação não existe           |
| Rateio                      | Fora do escopo (#648)                                      | Feature empresarial avançada              |
| Transaction items avançados | Fora do escopo (#649)                                      | Evoluir com NFe                           |
| bills.contactId             | Tornar FK real (restrict)                                  | Consistência                              |
| transactions.contactId      | onDelete set null → restrict                               | Proteger dados vinculados                 |
| Telas                       | 3 separadas: Lançamentos, Contas a pagar, Contas a receber | Domínios independentes                    |
| Bill + Transaction          | Separados, bill.transactionId linka                        | Já funciona assim                         |
| Delete contato              | Permite se não tem nada linkado, senão só archive          | Protege integridade                       |
| Escopo                      | Só backend (schemas, repositories, testes)                 | Sem routers, sem front-end                |

## Telas (conceitual)

- **Lançamentos** — consulta `transactions`. Movimentações realizadas.
- **Contas a pagar** — consulta `bills` WHERE type = payable AND status = pending
- **Contas a receber** — consulta `bills` WHERE type = receivable AND status = pending

Transaction pode existir sem bill (criou direto como realizado). Bill pode existir sem transaction (pendente). Quando paga um bill, cria transaction e linka via `bills.transactionId`.

## Schema changes

### transactions.ts

Sem mudanças de colunas. `contactId` onDelete muda de `set null` para `restrict`.

Zod validators:

- `createTransactionSchema` — name 2-120, type obrigatório, amount numeric string > 0, date YYYY-MM-DD, bankAccountId uuid condicional, destinationBankAccountId uuid condicional, creditCardId uuid opcional, categoryId uuid opcional, contactId uuid opcional, paymentMethod opcional, description max 500 opcional, attachmentUrl opcional
- `updateTransactionSchema` — partial, sem type (imutável)
- Validação por tipo via superRefine:
   - `transfer`: exige bankAccountId + destinationBankAccountId, devem ser diferentes
   - `expense`: exige bankAccountId OU creditCardId
   - `income`: exige bankAccountId

### bills.ts

Mudança: `contactId` vira FK real → `contacts.id` (onDelete: restrict).

Zod validators:

- `createBillSchema` — name 2-120, type obrigatório (payable/receivable), amount numeric string > 0, dueDate YYYY-MM-DD, bankAccountId uuid opcional, categoryId uuid opcional, contactId uuid opcional, description max 500 opcional
- `updateBillSchema` — partial

### recurrenceSettings (em bills.ts)

Zod validators:

- `createRecurrenceSettingSchema` — frequency obrigatório, windowMonths >= 1 default 3, endsAt date opcional

### contacts.ts

Adicionar `isArchived` (boolean, default false) se não existir.

## Repository changes

### transactions-repository.ts (refatorar)

- Singleton `db` (remover `db: DatabaseInstance` param)
- `validateInput` com Zod em create/update
- `@f-o-t/money` para valores no summary (incomeTotal, expenseTotal, balance)
- Validação de tipo no repository:
   - `transfer`: bankAccountId ≠ destinationBankAccountId
   - `expense`: exigir bankAccountId ou creditCardId
   - `income`: exigir bankAccountId
- Manter funções existentes:
   - `createTransaction`, `listTransactions`, `getTransactionsSummary`, `getTransactionWithTags`, `updateTransaction`, `deleteTransaction`
   - `createTransactionItems`, `getTransactionItems`, `replaceTransactionItems`

### bills-repository.ts (refatorar)

- Singleton `db` (remover `db: DatabaseInstance` param)
- `validateInput` com Zod em create/update
- `@f-o-t/money` para `amount`
- Manter funções existentes:
   - `createBill`, `createBillsBatch`, `listBills`, `getBill`, `updateBill`, `deleteBill`
   - `createRecurrenceSetting`, `getActiveRecurrenceSettings`, `getLastBillForRecurrenceGroup`

### contacts-repository.ts (refatorar)

- Singleton `db`, Zod validators
- Manter funções existentes
- Adicionar `archiveContact(id)` e `reactivateContact(id)`
- `deleteContact`: verificar transactions + bills linkadas → se tem, `AppError.conflict("Contato possui lançamentos vinculados. Arquive em vez de excluir.")`
- `listContacts`: respeitar `isArchived` (default: só ativos)

### credit-card-statements-repository.ts

- Singleton `db`
- Atualizar chamadas internas que criam bills/transactions para usar os novos repositories

## Testes

### transactions-repository.test.ts

- Validators: create (tipo × contas obrigatórias, transfer contas diferentes, amount > 0, date formato)
- CRUD: create, list, get, update, delete
- Tags: create com tags, update tags
- Items: create, get, replace
- Summary: incomeTotal, expenseTotal, balance com @f-o-t/money
- Filtros: por type, bankAccountId, categoryId, dateFrom/dateTo

### bills-repository.test.ts

- Validators: create (amount > 0, dueDate formato, type obrigatório)
- CRUD: create, list, get, update, delete
- Batch: createBillsBatch
- Recurrence: createRecurrenceSetting, getActiveRecurrenceSettings, getLastBillForRecurrenceGroup
- contactId FK: bill com contato, restrict on delete

### contacts-repository.test.ts

- Validators: create, update
- CRUD + archive/reactivate
- Delete bloqueado quando tem transactions/bills
- Delete permitido quando limpo
- listContacts filtro isArchived

## Issues relacionadas

- #647 — Conciliação bancária (fora do escopo)
- #648 — Rateio de lançamentos (fora do escopo)
- #649 — Itens de lançamento avançados (fora do escopo)
