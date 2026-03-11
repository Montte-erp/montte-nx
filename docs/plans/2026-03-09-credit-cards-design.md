# Cartões de Crédito — Design do MVP

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar o módulo de cartões de crédito com faturas, pagamento integral e controle de limite.

**Architecture:** Cartão como contrato de crédito vinculado a uma conta financeira. Compras são transactions com `statementPeriod` calculado via dayjs. Faturas usam tabela pro estado mutável + materialized view pros totais. Pagamento gera débito na conta vinculada.

**Tech Stack:** Drizzle ORM, drizzle-zod, dayjs, PGLite (testes), Vitest

---

## 1. Schema do Cartão de Crédito

Evoluir o schema `credit-cards.ts` existente.

**Campos que ficam:** `id`, `teamId`, `name`, `color`, `iconUrl`, `creditLimit`, `closingDay`, `dueDay`, `bankAccountId`, `createdAt`, `updatedAt`

**Campos novos:**

- `status` — enum `active | blocked | cancelled`, default `active`
- `brand` — enum `visa | mastercard | elo | amex | hipercard | other`, nullable

**Validação (drizzle-zod):**

```typescript
import { createInsertSchema } from "drizzle-zod";

export const createCreditCardSchema = createInsertSchema(creditCards, {
   name: z.string().min(2).max(80),
   creditLimit: z.string().regex(/^\d+(\.\d{1,2})?$/),
   closingDay: z.number().int().min(1).max(31),
   dueDay: z.number().int().min(1).max(31),
   color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .default("#6366f1"),
}).omit({ id: true, teamId: true, createdAt: true, updatedAt: true });

export const updateCreditCardSchema = createCreditCardSchema.partial();
```

---

## 2. Tabela de Faturas (`credit_card_statements`)

Estado mutável da fatura:

| Campo                  | Tipo                      | Notas                                                    |
| ---------------------- | ------------------------- | -------------------------------------------------------- |
| `id`                   | UUID PK                   |                                                          |
| `creditCardId`         | FK credit_cards           |                                                          |
| `statementPeriod`      | text (YYYY-MM)            | Competência                                              |
| `closingDate`          | date                      | Calculada: closingDay + período (dayjs)                  |
| `dueDate`              | date                      | Calculada: dueDay + período (dayjs)                      |
| `status`               | enum `open \| paid`       | Default `open`                                           |
| `billId`               | FK bills, nullable        | Bill gerado pra integrar com contas a pagar/notificações |
| `paymentTransactionId` | FK transactions, nullable | Débito na conta vinculada                                |
| `createdAt`            | timestamp                 |                                                          |
| `updatedAt`            | timestamp                 |                                                          |

Fatura é criada **lazy** — quando a primeira compra cai naquela competência.

**Cálculo do `dueDate`:** Se `dueDay < closingDay`, o vencimento cai no mês seguinte ao período.

```typescript
// closingDay=15, dueDay=25, period="2026-03" → dueDate=2026-03-25
// closingDay=25, dueDay=5, period="2026-03"  → dueDate=2026-04-05
```

---

## 3. Materialized View (`credit_card_statement_totals`)

```typescript
import { pgMaterializedView } from "drizzle-orm/pg-core";

export const creditCardStatementTotals = pgMaterializedView(
   "credit_card_statement_totals",
).as((qb) =>
   qb
      .select({
         creditCardId: transactions.creditCardId,
         statementPeriod: transactions.statementPeriod,
         totalPurchases: sql<string>`SUM(amount)`.as("total_purchases"),
         transactionCount: sql<number>`COUNT(*)::int`.as("transaction_count"),
      })
      .from(transactions)
      .where(sql`credit_card_id IS NOT NULL`)
      .groupBy(transactions.creditCardId, transactions.statementPeriod),
);
```

**Unique index** em `(credit_card_id, statement_period)` — necessário pra `concurrently()` no futuro (issue #640).

**Refresh imediato** (sem esperar cron) nos momentos críticos:

- Após criação de compra no cartão
- Após pagamento de fatura

**Limite disponível:** `creditLimit - SUM(totalPurchases)` das faturas com `status = open`.

---

## 4. Campo novo em Transactions

Adicionar ao schema `transactions.ts`:

- `statementPeriod` — text (YYYY-MM), nullable. Preenchido automaticamente quando `creditCardId` não é null.

**Cálculo do `statementPeriod` (dayjs):**

```typescript
import dayjs from "dayjs";

function computeStatementPeriod(
   purchaseDate: string,
   closingDay: number,
): string {
   const date = dayjs(purchaseDate);
   if (date.date() <= closingDay) {
      return date.format("YYYY-MM");
   }
   return date.add(1, "month").format("YYYY-MM");
}
```

**Parcelas:** cada parcela calcula seu próprio `statementPeriod` incrementando o mês:

```typescript
// Compra 3x dia 20/03, closingDay=15
// Parcela 1 → 2026-04
// Parcela 2 → 2026-05
// Parcela 3 → 2026-06
```

---

## 5. Fluxo de Compra no Cartão

1. Usuário cria despesa com `paymentMethod = credit_card` + `creditCardId`
2. Sistema calcula `statementPeriod` via dayjs
3. `getOrCreateStatement(creditCardId, statementPeriod)` — cria fatura lazy se não existe
4. Cria transaction(s) — se parcelado, cria todas de uma vez com `installmentGroupId`
5. Cria bill "payable/pending" com `dueDate` da fatura (integra com notificações)
6. Refresh imediato da materialized view

---

## 6. Fluxo de Pagamento da Fatura

**Pré-condições:**

- Fatura com `status = open`
- `closingDate <= hoje` (fatura já fechou)

**Ação "Pagar fatura" (tudo numa transação DB):**

1. **Cria transaction** de débito na conta vinculada:
   - `type: "expense"`, `paymentMethod: "debit_card"`
   - `bankAccountId`: conta vinculada do cartão
   - `amount`: total da fatura (da materialized view)
   - `name`: "Pagamento fatura [nome do cartão] - [MM/YYYY]"
   - `date`: data escolhida pelo usuário (default hoje)

2. **Atualiza bill** como `paid`:
   - `status: "paid"`, `paidAt: now()`
   - `transactionId`: link pro transaction criado

3. **Atualiza statement:**
   - `status: "paid"`
   - `paymentTransactionId`: link pro transaction
   - `billId`: link pro bill

4. **Refresh imediato** da materialized view (atualiza limite disponível)

**Sem duplicidade:** compras = consumo (categoria Alimentação etc.), pagamento = saída de caixa consolidada.

---

## 7. Proteção de Transactions

Transactions vinculadas a uma fatura paga **não podem ser editadas ou deletadas**.

Validação no repository de transactions:

```typescript
// Antes de update/delete de transaction com creditCardId
// Verificar se statement daquela competência está "paid"
// Se sim → AppError.conflict("Não é possível editar lançamento de fatura paga.")
```

---

## 8. Repositories (padrão singleton)

Mesmo padrão do `bank-accounts-repository.ts` refatorado:

- Singleton `db` de `@core/database/client`
- Reads com `db.query.*.findMany()` / `findFirst()`
- Writes com `db.insert()` / `db.update()` / `db.delete()`
- Validação com `validateInput` + schemas drizzle-zod
- Sem tipos de retorno explícitos
- Path aliases `@core/database/*`

**`credit-cards-repository.ts`** (reescrever):

- `createCreditCard(teamId, data)`
- `listCreditCards(teamId)`
- `getCreditCard(id)`
- `updateCreditCard(id, data)`
- `deleteCreditCard(id)` — check se tem faturas abertas

**`credit-card-statements-repository.ts`** (novo):

- `getOrCreateStatement(creditCardId, statementPeriod)`
- `getStatement(id)` — JOIN com materialized view
- `listStatements(creditCardId)` — com totais
- `payStatement(statementId, paymentDate)` — transação DB completa
- `getAvailableLimit(creditCardId)` — creditLimit - total pending

---

## 9. Testes

### Validators (drizzle-zod)

**`__tests__/schemas/credit-cards-validators.test.ts`:**

- Aceita cartão válido completo
- Aceita sem brand (opcional)
- Rejeita nome curto/longo
- Rejeita limite negativo
- Rejeita closingDay/dueDay fora de 1-31
- Rejeita cor inválida
- Verifica defaults (cor, status)
- Update aceita parcial

**`__tests__/schemas/credit-card-statements-validators.test.ts`:**

- Valida formato statementPeriod (YYYY-MM)
- Valida status enum
- Rejeita campos inválidos

### Repository (PGLite + withTestTransaction)

**`__tests__/repositories/credit-cards-repository.test.ts`:**

- CRUD completo
- Não deleta cartão com faturas abertas

**`__tests__/repositories/credit-card-statements-repository.test.ts`:**

- `getOrCreateStatement` — cria lazy, retorna existente
- `listStatements` — JOIN com materialized view (refresh antes de query)
- `payStatement` — cria transaction, bill, marca paid, refresh view
- `getAvailableLimit` — limite - total pending

### Materialized View

- Insere transactions, refresh, valida totais
- Valida agrupamento por cartão + período

### Helpers

- `computeStatementPeriod` — compra antes/depois do fechamento, virada de ano, parcelas

---

## Fora do MVP

- Portadores / cartões físicos (auditoria futura)
- Pagamento parcial / rotativo
- Conciliação / importação de fatura
- Origem de dados (manual/open_finance)
- Emissor, moeda multi-currency
- Edição de competência
- Cron de refresh da view (issue #640)
- Notificações de fechamento/vencimento (issue #639)
