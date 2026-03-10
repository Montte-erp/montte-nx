# Conta Financeira — Changelog

## O que mudou de "Bank Accounts" para "Conta Financeira"

### Schema (`core/database/src/schemas/bank-accounts.ts`)

| Mudança                    | Antes                      | Depois                                     | Motivo                                                            |
| -------------------------- | -------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Campo `status`             | Não existia                | `active` \| `archived` (default: `active`) | Contas com lançamentos não podem ser excluídas, apenas arquivadas |
| Campo `initialBalanceDate` | `timestamp` (com timezone) | `date` (apenas data)                       | É uma data no calendário, não um momento no tempo                 |
| Campo `nickname`           | Existia                    | Removido                                   | Redundante com `name` — o spec chama `name` de "apelido"          |
| Índice `status`            | Não existia                | `bank_accounts_status_idx`                 | Queries filtram por status                                        |

### Campos que NÃO foram adicionados (e por quê)

| Campo do spec                  | Decisão         | Motivo                                                                                                           |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `moeda` / `currency`           | Não adicionado  | Apenas BRL por agora. Quando multi-moeda vier, será uma mudança maior (taxas de câmbio, relatórios consolidados) |
| `origem_dados` / `source`      | Não adicionado  | Transações têm origem, não contas. Open Finance será uma integração própria quando implementado                  |
| `criada_por` / `createdBy`     | Não adicionado  | Será coberto pelo módulo de auditoria centralizado ([#638](https://github.com/F-O-T/montte-nx/issues/638))       |
| `atualizada_por` / `updatedBy` | Não adicionado  | Idem — auditoria centralizada                                                                                    |
| Campos de conciliação          | Não adicionados | Feature Pro/Empresarial. Terá tabela própria (`reconciliation_sessions`)                                         |

### Validators (`core/database/src/schemas/bank-accounts.validators.ts`) — NOVO

- Zod schemas derivados do Drizzle via `createInsertSchema`
- Validação condicional por tipo de conta:
   - **Caixa físico (`cash`)**: bankCode, branch, accountNumber devem ser nulos
   - **Contas bancárias** (`checking`, `savings`, `investment`, `payment`): bankCode obrigatório
- Nome: 2-80 caracteres
- Cor: formato hex `#RRGGBB`
- Saldo inicial: aceita positivo e negativo (spec permite ambos)

### Repository (`core/database/src/repositories/bank-accounts-repository.ts`) — REESCRITO

| Mudança                  | Antes                               | Depois                                            |
| ------------------------ | ----------------------------------- | ------------------------------------------------- |
| Validação                | Nenhuma (confiava no router)        | Zod validation antes de cada operação             |
| Aritmética de saldo      | `Number()` (floating point)         | `@f-o-t/money` (BigInt, precisão exata)           |
| Arquivamento             | Não existia                         | `archiveBankAccount()`, `reactivateBankAccount()` |
| Exclusão                 | Deletava direto                     | Verifica transações; bloqueia se houver           |
| Listagem                 | Retornava todas                     | Filtra por `status = active` por padrão           |
| Interface de criação     | `NewBankAccount` (tipo Drizzle raw) | `CreateBankAccountParams` com validação           |
| Interface de atualização | `Partial<NewBankAccount>`           | `UpdateBankAccountParams` com validação           |

### Testes — NOVOS

- `core/database/__tests__/schemas/bank-accounts-validators.test.ts` — 23 testes para validadores
- Mock factory `makeBankAccount()` em `apps/web/__tests__/helpers/mock-factories.ts`
