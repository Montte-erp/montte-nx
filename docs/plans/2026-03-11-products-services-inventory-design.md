# Products, Services & Inventory — Refactoring Design

## Objetivo

Refatorar os domínios de Serviços, Estoque e Assinaturas para alinhar ao spec do PM, separar responsabilidades, adicionar Zod validators e cobertura de testes.

## Decisões

| Decisão                         | Escolha                                                       | Motivo                                            |
| ------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Unificar item_catalogo?         | Não — manter services e inventory separados                   | Menos complexidade                                |
| Saldo de estoque                | Campo materializado (`currentStock`) atualizado no repository | Consultas rápidas, padrão do bank-accounts        |
| initialStock                    | Campo separado, imutável após criação                         | Consistente com `initialBalance` de bank-accounts |
| Alertas de estoque mínimo       | Fora do escopo (#642)                                         | Fase posterior                                    |
| Benefits de planos              | Fora do escopo (#644), parte do HyperPay (#643)               | Módulo futuro                                     |
| Subscription lifecycle completo | Mínimo agora, completo depois (#645)                          | Evita overengineering                             |
| serviceTypeEnum                 | Remover                                                       | Cada domínio tem sua tabela                       |
| Preços                          | Tudo `numeric(12,2)` + `@f-o-t/money`                         | Consistência com domínio financeiro               |
| Quantidades                     | `@f-o-t/uom`                                                  | Precisão e conversão de unidades                  |
| db parameter                    | Singleton `db` importado                                      | Padrão dos repos refatorados                      |

## Separação de domínios

### Antes

```
services.ts        → services, serviceVariants, contactSubscriptions, resources
inventory.ts       → inventoryProducts, inventoryMovements, inventorySettings
services-repo.ts   → tudo junto (services, variants, subscriptions, analytics)
inventory-repo.ts  → tudo junto (products, movements, settings)
```

### Depois

```
services.ts           → services, serviceVariants, resources
subscriptions.ts      → contactSubscriptions (extraído de services)
inventory.ts          → inventoryProducts, inventoryMovements, inventorySettings

services-repo.ts      → services + variants CRUD
subscriptions-repo.ts → subscriptions CRUD + analytics helpers
inventory-repo.ts     → products + movements + settings + bloqueio de saldo
```

## Schema changes

### inventory.ts

Campos novos em `inventoryProducts`:

| Campo          | Tipo            | Default | Regra                                                       |
| -------------- | --------------- | ------- | ----------------------------------------------------------- |
| `initialStock` | `numeric(12,4)` | `"0"`   | Imutável após criação. `currentStock` começa com esse valor |

Zod validators:

- `createInventoryProductSchema` — name, baseUnit, purchaseUnit obrigatórios. sellingPrice opcional (numeric string). initialStock >= 0
- `updateInventoryProductSchema` — partial, sem initialStock (imutável)
- `createInventoryMovementSchema` — type obrigatório, qty > 0, unitPrice obrigatório para purchase/sale, ignorado em waste. totalAmount calculado no repository

### services.ts

Mudanças:

- Remover `serviceTypeEnum` e campo `type` da tabela `services`
- Remover `contactSubscriptions` (vai pra subscriptions.ts)
- `basePrice` em `services` e `serviceVariants`: `integer` → `numeric(12,2)`

Zod validators:

- `createServiceSchema` — name obrigatório, basePrice numeric string
- `updateServiceSchema` — partial
- `createVariantSchema` — name, basePrice, billingCycle obrigatórios
- `updateVariantSchema` — partial

### subscriptions.ts (novo)

Move `contactSubscriptions` de services.ts.

Mudanças de campos:

| Campo                | Antes                | Depois                         |
| -------------------- | -------------------- | ------------------------------ |
| `negotiatedPrice`    | `integer` (centavos) | `numeric(12,2)`                |
| `currentPeriodStart` | —                    | `date` (novo)                  |
| `currentPeriodEnd`   | —                    | `date` (novo)                  |
| `cancelAtPeriodEnd`  | —                    | `boolean` default false (novo) |
| `canceledAt`         | —                    | `timestamp` nullable (novo)    |

Zod validators:

- `createSubscriptionSchema` — contactId, variantId, startDate, negotiatedPrice obrigatórios. currentPeriodStart/End opcionais
- `updateSubscriptionSchema` — partial

## Repository changes

### inventory-repository.ts

- Singleton `db` (não mais `db: DatabaseInstance`)
- `validateInput` com Zod em todas operações
- `createInventoryProduct`: seta `currentStock = initialStock`
- `createInventoryMovement`: atômico numa transação db.transaction():
   1. Valida input com Zod
   2. Se sale/waste: verifica `currentStock >= qty` usando `@f-o-t/uom` (`greaterThanOrEqual`). Se não: `AppError.conflict("Quantidade maior que o estoque disponível (saldo atual: X)")`
   3. Calcula `totalAmount = qty * unitPrice` com `@f-o-t/money` (para purchase/sale)
   4. Insere movimento
   5. Atualiza `currentStock` (add para purchase, subtract para sale/waste) usando `@f-o-t/uom`
- `deleteInventoryMovement`: reverte o delta do `currentStock` atomicamente
- Conversão de unidade de compra → base com `@f-o-t/uom` (migrar do router pro repository)
- Remover comentários de seção

### services-repository.ts

- Singleton `db`
- `validateInput` com Zod
- Remover todas funções de subscriptions
- Remover `bulkCreateServices`
- `@f-o-t/money` para operações com `basePrice`

### subscriptions-repository.ts (novo)

- Singleton `db`, `validateInput` com Zod
- Funções migradas: `createSubscription`, `updateSubscription`, `getSubscription`, `listSubscriptionsByTeam`, `listSubscriptionsByContact`, `upsertSubscriptionByExternalId`, `countActiveSubscriptionsByVariant`, `listExpiringSoon`
- `@f-o-t/money` para operações com `negotiatedPrice`

## Testes

Cobertura com PGlite para os 3 repositórios:

### inventory-repository.test.ts

- Validators: createProduct, updateProduct, createMovement (qty > 0, unitPrice condicional)
- createProduct: currentStock = initialStock
- createMovement purchase: insere + incrementa currentStock
- createMovement sale: insere + decrementa currentStock
- createMovement sale bloqueio: qty > currentStock → AppError.conflict
- createMovement waste: insere + decrementa, sem unitPrice
- createMovement waste bloqueio: qty > currentStock → AppError.conflict
- deleteMovement: reverte delta
- Conversão de unidades com @f-o-t/uom

### services-repository.test.ts

- Validators: createService, updateService, createVariant, updateVariant
- CRUD services: create, list, get, update, delete
- CRUD variants: create, list by service, update, delete
- basePrice como numeric(12,2) string

### subscriptions-repository.test.ts

- Validators: createSubscription, updateSubscription
- CRUD: create, get, list by team, list by contact, update
- upsertByExternalId: insert + update
- Lifecycle: currentPeriodStart/End, cancelAtPeriodEnd, canceledAt
- Analytics: countActiveByVariant, listExpiringSoon

## Issues relacionadas

- #642 — Alertas de estoque mínimo (fora do escopo)
- #643 — Epic: Montte HyperPay (pinned)
- #644 — Benefits standalone
- #645 — Subscription lifecycle completo
