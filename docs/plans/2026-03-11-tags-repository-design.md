# Tags Repository Refactor — Design

## Decisões

- **Tabela única**: Reusar `tags` existente para Tags (pessoal) e Centros de Custo (empresarial). Diferenciação é só no front-end baseado em `team.accountType`.
- **Sem tabelas novas**: `transactionTags` (many-to-many) continua como está.
- **Sem `costCenterId`**: A regra de "máximo 1 por transação" em orgs empresariais é enforced no repository (e futuramente Zod superRefine no router input).
- **Sem `isDefault`**: Não há tags/centros de custo pré-criados.
- **Sem `order`**: Ordenação por DnD é feature futura.

## Schema: campo novo em `tags`

| Campo         | Tipo           | Default | Propósito                                 |
| ------------- | -------------- | ------- | ----------------------------------------- |
| `description` | `varchar(255)` | `null`  | Contexto livre ("Projeto X", "Cliente Y") |

## Tags Repository — CRUD

| Operação                  | Validações                                                   | Retorno              |
| ------------------------- | ------------------------------------------------------------ | -------------------- |
| `createTag(teamId, data)` | Nome único por `(teamId, name)`                              | Tag criada           |
| `listTags(teamId, opts?)` | Filtro `isArchived` (default: só ativos); ordenar por `name` | Lista                |
| `getTag(id)`              | Verificar pertencimento ao team                              | Tag                  |
| `updateTag(id, data)`     | Manter unicidade de nome                                     | Tag atualizada       |
| `archiveTag(id)`          | Sempre permitido                                             | `isArchived = true`  |
| `reactivateTag(id)`       | —                                                            | `isArchived = false` |
| `deleteTag(id)`           | Bloquear se tem transações vinculadas em `transactionTags`   | Removida             |

## Regra empresarial (transaction repository)

Ao associar tags a uma transação, checar `team.accountType`:

- Se `empresarial`: `tagIds.length` deve ser 0 ou 1
- Validação via `AppError` no repository
- Futuramente: Zod `superRefine` no input do router (fail fast)

## Fora de escopo (futuro)

- Validação Zod no router input
- Campo `order` para DnD
- Campo `isDefault` / seed de tags padrão
- UI de tags/centros de custo
- Relatórios por tag/centro de custo
