# Planejamento (Orçamentos e Objetivos) — Refactoring Design

## Objetivo

Refatorar o módulo de orçamentos existente (`budget_goals`) e criar o novo domínio de objetivos financeiros (`financial_goals` + `financial_goal_movements`), alinhando ao padrão dos repositórios refatorados: singleton db, Zod validators, `@f-o-t/money`, testes com PGlite.

## Decisões

| Decisão                 | Escolha                                                   | Motivo                                           |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Escopo                  | `teamId`                                                  | Consistente com todo o codebase                  |
| Modelo orçamento        | Manter month/year (não date ranges)                       | Já funciona, YAGNI para frequências futuras      |
| Gasto realizado         | SUM em tempo real (não materialized view)                 | Volume por team/mês/categoria é pequeno          |
| categoryId em budget    | notNull (obrigatório)                                     | Orçamento sem categoria não faz sentido          |
| Categoria expense only  | Validação no repository (query DB)                        | Não no schema                                    |
| Alertas/notificações    | Só campos no schema, disparo fora do escopo (#646)        | Sistema transversal futuro                       |
| Data início objetivo    | Permite data passada                                      | Flexibilidade para registro retroativo           |
| isActive em budget      | Não adicionar                                             | month/year já é histórico natural, delete remove |
| Unicidade budget        | unique(teamId, categoryId, month, year) sem WHERE parcial | categoryId agora é notNull                       |
| Objetivo com movimentos | Sim, padrão inventory                                     | Rastreabilidade essencial                        |
| Delete de goal movement | Permitido, reverte delta                                  | Consistente com inventory                        |

## Separação de domínios

### Antes

```
schemas/budget-goals.ts          → schema sem validators, categoryId nullable
repositories/budget-goals-repo   → padrão antigo (db param, sem Zod)
```

### Depois

```
schemas/budget-goals.ts          → refatorado (categoryId notNull, Zod validators)
schemas/financial-goals.ts       → NOVO (financial_goals + financial_goal_movements)

repositories/budget-goals-repository.ts    → refatorado (singleton db, Zod, @f-o-t/money)
repositories/financial-goals-repository.ts → NOVO (goals + movements atômicos)
```

## Schema changes

### budget-goals.ts (refatorado)

Mudanças:

| Campo        | Antes                                      | Depois                                      |
| ------------ | ------------------------------------------ | ------------------------------------------- |
| `categoryId` | nullable                                   | `notNull()`                                 |
| unique index | parcial com `WHERE categoryId IS NOT NULL` | simples `(teamId, categoryId, month, year)` |

Campos que ficam: `id`, `teamId`, `month`, `year`, `limitAmount` (numeric 12,2), `alertThreshold`, `alertSentAt`, `createdAt`, `updatedAt`.

Campos do spec do PM que não vamos adicionar (YAGNI):

- `frequencia` — só MENSAL, month/year resolve
- `data_inicio`/`data_fim` — month/year é o range
- `alerta_ativo` — `alertThreshold != null` indica alerta
- `ativo` — delete remove

Zod validators:

- `createBudgetGoalSchema` — categoryId uuid obrigatório, month 1-12, year >= 2020, limitAmount numeric string > 0, alertThreshold 1-100 opcional
- `updateBudgetGoalSchema` — partial de limitAmount + alertThreshold. month/year/categoryId imutáveis

### financial-goals.ts (novo)

Tabela `financial_goals`:

| Campo            | Tipo              | Regra                                |
| ---------------- | ----------------- | ------------------------------------ |
| `id`             | uuid              | PK                                   |
| `teamId`         | uuid              | notNull                              |
| `categoryId`     | uuid → categories | opcional                             |
| `name`           | text              | notNull, 2-120 chars                 |
| `targetAmount`   | numeric(12,2)     | notNull, > 0                         |
| `currentAmount`  | numeric(12,2)     | notNull, default "0" — materializado |
| `startDate`      | date              | notNull                              |
| `targetDate`     | date              | opcional, >= startDate               |
| `alertThreshold` | integer           | 1-100, nullable = sem alerta         |
| `alertSentAt`    | timestamp         | nullable                             |
| `isCompleted`    | boolean           | default false                        |
| `createdAt`      | timestamp         | defaultNow                           |
| `updatedAt`      | timestamp         | defaultNow + $onUpdate               |

Indexes: `teamId`, `isCompleted`.

Tabela `financial_goal_movements`:

| Campo           | Tipo                          | Regra                     |
| --------------- | ----------------------------- | ------------------------- |
| `id`            | uuid                          | PK                        |
| `goalId`        | uuid → financial_goals        | notNull, cascade          |
| `type`          | enum `deposit` / `withdrawal` | notNull                   |
| `amount`        | numeric(12,2)                 | notNull, > 0              |
| `date`          | date                          | notNull                   |
| `transactionId` | uuid → transactions           | opcional (vínculo futuro) |
| `notes`         | text                          | max 255, opcional         |
| `createdAt`     | timestamp                     | defaultNow                |
| `updatedAt`     | timestamp                     | defaultNow + $onUpdate    |

Indexes: `goalId`, `transactionId`.

Enum novo: `goalMovementTypeEnum` (`deposit`, `withdrawal`).

Zod validators:

- `createFinancialGoalSchema` — name 2-120, targetAmount numeric string > 0, startDate obrigatório, targetDate >= startDate, categoryId uuid opcional, alertThreshold 1-100 opcional
- `updateFinancialGoalSchema` — partial, sem currentAmount/isCompleted (controlados pelo repository)
- `createGoalMovementSchema` — type obrigatório, amount numeric string > 0, date obrigatório, transactionId uuid opcional, notes max 255 opcional

## Repository changes

### budget-goals-repository.ts (refatorado)

- Singleton `db` (remover `db: DatabaseInstance` param)
- `validateInput` com Zod em create/update
- `createBudgetGoal`: validar que categoria existe e é `type: expense` (query no DB)
- `computeSpentAmount`: usar `@f-o-t/money` para retorno
- `copyPreviousMonth`: manter
- `getGoalsForAlertCheck`: manter
- Mesmas funções, mesma API (sem renames)

### financial-goals-repository.ts (novo)

- Singleton `db`, `validateInput` com Zod
- `createFinancialGoal`: seta `currentAmount = "0"`
- `getFinancialGoal`, `listFinancialGoals` (por teamId, filtro isCompleted)
- `updateFinancialGoal`: partial, sem alterar `currentAmount` diretamente
- `deleteFinancialGoal`: cascade deleta movements
- `createGoalMovement`: atômico via `db.transaction()`:
   1. Valida input com Zod
   2. Se withdrawal: verifica `currentAmount >= amount` com `@f-o-t/money`. Se não: `AppError.conflict("Valor maior que o saldo atual")`
   3. Insere movement
   4. Atualiza `currentAmount` (add para deposit, subtract para withdrawal)
   5. Se `currentAmount >= targetAmount`: seta `isCompleted = true`
- `deleteGoalMovement`: reverte delta atomicamente, reseta `isCompleted` se necessário
- `listGoalMovements`: por goalId, ordem cronológica

## Relations

```
financialGoals:
  category → categories
  movements → many financialGoalMovements

financialGoalMovements:
  goal → financialGoals
  transaction → transactions (opcional)

budgetGoals:
  category → categories (já existe)
```

## Testes

### budget-goals-repository.test.ts

- Validators: create (categoryId obrigatório, month 1-12, year >= 2020, limitAmount > 0, alertThreshold 1-100)
- CRUD: create, get, list, update, delete
- Validação de categoria expense (rejeitar income)
- computeSpentAmount com transactions reais
- copyPreviousMonth
- Unique constraint (mesma categoria+mês = erro)

### financial-goals-repository.test.ts

- Validators: create, update, createMovement
- CRUD goals: create, get, list (filtro isCompleted), update, delete
- createMovement deposit: insere + incrementa currentAmount
- createMovement withdrawal: insere + decrementa currentAmount
- Bloqueio withdrawal: amount > currentAmount → AppError.conflict
- deleteMovement: reverte delta
- Auto-complete: currentAmount >= targetAmount → isCompleted = true
- targetDate >= startDate validation

## Issues relacionadas

- #646 — Sistema de notificações in-app e alertas (fora do escopo)
