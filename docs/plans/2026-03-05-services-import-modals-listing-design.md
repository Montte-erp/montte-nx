# Serviços: Importação, Modais e Listagem — Design v2

**Issue:** #636
**Date:** 2026-03-05

**Goal:** Padronizar a jornada de Serviços com importação, modais de criar/editar e listagem completa (busca, filtros, colunas, totalizadores e gestão de variantes).

---

## Decisões Chave

| Decisão                   | Escolha                                      | Motivo                                         |
| ------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Preço padrão              | `services.basePrice` (integer, cents)        | Simplifica listagem e importação               |
| Nome no form              | Combobox (autocomplete)                      | Sugere nomes existentes, permite novos         |
| Tipo do serviço           | Enum: `service / product / subscription`     | PM pediu filtro por tipo                       |
| Categoria                 | FK → `categories.id` (substitui campo texto) | Reutiliza categorias existentes do time        |
| Tag                       | FK → `tags.id` no serviço                    | Uma tag por serviço                            |
| Cliente/Fornecedor filtro | Via `contact_subscriptions` join             | Sem novo campo; usa assinaturas existentes     |
| Variantes × basePrice     | Variantes herdam basePrice como default      | Menor fricção ao criar variantes               |
| Variantes na UI           | Gerenciadas dentro do modal de edição        | Sem renderSubComponent (removido do DataTable) |

---

## 1. Schema Changes

### `services` table — novos campos

```sql
base_price    INTEGER NOT NULL DEFAULT 0     -- cents (@f-o-t/money)
type          service_type_enum NOT NULL DEFAULT 'service'
category_id   UUID REFERENCES categories(id) -- nullable, substitui campo "category" texto
tag_id        UUID REFERENCES tags(id)       -- nullable
```

### Novo enum

```typescript
export const serviceTypeEnum = pgEnum("service_type", [
   "service",
   "product",
   "subscription",
]);
```

### Migração

- Campo `category` (texto) será removido, substituído por `categoryId` FK.
- Serviços existentes sem `basePrice` receberão default `0` (obrigatório atualizar no edit).
- Serviços existentes com `category` texto: tentar match com categorias existentes, senão `null`.

---

## 2. Backend (oRPC)

### Procedures atualizadas

| Procedure         | Mudança                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services.getAll` | Join com `categories` e `tags`. Retorna `categoryName`, `tagName`, `basePrice`, `type`. Aceita filtros opcionais: `type`, `categoryId`, `contactId`, `search` |
| `services.create` | Aceita `basePrice`, `type`, `categoryId`, `tagId`                                                                                                             |
| `services.update` | Aceita mesmos campos novos                                                                                                                                    |

### Novas procedures

| Procedure             | Descrição                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services.bulkCreate` | Import em lote. Input: array de `{ name, description?, basePrice, type, categoryId?, tagId? }`. Retorna `{ created: number, errors: { row: number, message: string }[] }` |
| `services.export`     | Retorna dados CSV-ready (array de objetos flat) da lista filtrada                                                                                                         |

### Filtro Cliente/Fornecedor

Query em `getAll` com `contactId` opcional:

```sql
services
  JOIN service_variants ON ...
  JOIN contact_subscriptions ON ...
  WHERE contact_subscriptions.contact_id = :contactId
```

---

## 3. UI — Listagem (DataTable)

### Colunas

| Coluna       | Tipo                                                  | Notas               |
| ------------ | ----------------------------------------------------- | ------------------- |
| Nome         | text, font-medium                                     | —                   |
| Preço padrão | `formatAmount(fromMinorUnits(cents, "BRL"), "pt-BR")` | @f-o-t/money        |
| Categoria    | Badge com cor da categoria                            | "—" se null         |
| Ações        | edit / delete                                         | Via `renderActions` |

### Busca e Filtros

- **Search input** — filtra por nome + descrição (client-side `getFilteredRowModel`)
- **Tipo** — dropdown: Prestação de serviço / Produto / Assinatura
- **Categoria** — dropdown dinâmico das categorias do time
- **Cliente/Fornecedor** — dropdown de contatos (query server-side com `contactId` filter)

### Totalizador

Badge no header: `"{count} serviços"` (sobre lista filtrada).

### Header Actions

| Ação           | UI             | Comportamento                    |
| -------------- | -------------- | -------------------------------- |
| Importar       | Button outline | Abre `ServiceImportCredenza`     |
| Exportar       | Button outline | Download CSV da lista atual      |
| Adicionar novo | Button primary | Abre `ServiceForm` mode="create" |

### View Switch

Table / Card (padrão existente com `useViewSwitch`).

---

## 4. UI — Create/Edit Modal (Credenza)

### Campos

| Campo        | Componente                  | Obrigatório | Notas                               |
| ------------ | --------------------------- | ----------- | ----------------------------------- |
| Nome         | Combobox (autocomplete)     | Sim         | Sugere nomes de serviços existentes |
| Descrição    | Textarea                    | Não         | —                                   |
| Tipo         | Select                      | Sim         | Serviço / Produto / Assinatura      |
| Preço padrão | MoneyInput                  | Sim         | BRL cents, @f-o-t/money             |
| Categoria    | Select (categorias do time) | Sim         | FK → categories                     |
| Tag          | Select (tags do time)       | Não         | FK → tags                           |

### Seção de Variantes (abaixo de divider)

- Header: "Variantes" + botão "Adicionar"
- Cada variante: Nome | Preço (pre-filled do basePrice) | Ciclo (mensal/anual/hora/avulso) | Botão remover
- **Create mode:** adicionar variantes inline (comportamento atual aprimorado)
- **Edit mode:** exibir variantes existentes + adicionar/editar/excluir (novo)

---

## 5. UI — Import Flow (Credenza)

Seguindo o padrão de `transaction-import-credenza`:

1. **Upload** — Arrastar ou selecionar arquivo CSV/XLSX
2. **Mapeamento** — Mapear colunas do arquivo para: Nome, Descrição, Preço padrão, Categoria
3. **Preview** — Linhas parseadas com erros de validação destacados
4. **Confirmar** — Bulk create via `services.bulkCreate`

### Template CSV

```csv
nome,descricao,preco_padrao,categoria
Pintura parede,Serviço de pintura,15.00,Prestação de serviço
Consultoria,Assessoria Contábil,1500.00,Prestação de serviço
```

### Normalização

- Preço: aceita `"R$ 1.500,00"`, `"1500.00"`, `"1500"` → converte para cents
- Categoria: match case-insensitive com categorias existentes do time

---

## 6. Exportação

CSV gerado client-side a partir da lista filtrada. Colunas: Nome, Descrição, Preço padrão (formatado), Tipo, Categoria, Tag.

---

## 7. Validações

| Campo        | Regra                            |
| ------------ | -------------------------------- |
| `name`       | Obrigatório, trim, min 1 char    |
| `basePrice`  | Obrigatório, ≥ 0                 |
| `type`       | Obrigatório, enum válido         |
| `categoryId` | Obrigatório (no form), FK válida |
| `tagId`      | Opcional, FK válida se fornecido |

---

## 8. Arquivos a Modificar/Criar

### Modificar

- `packages/database/src/schemas/services.ts` — adicionar campos + enum
- `apps/web/src/integrations/orpc/router/services.ts` — novos campos + novas procedures
- `apps/web/src/features/services/ui/services-form.tsx` — campos novos + variantes no edit
- `apps/web/src/features/services/ui/services-columns.tsx` — preço padrão + categoria badge
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx` — filtros, busca, totalizador, ações

### Criar

- `apps/web/src/features/services/ui/service-import-credenza.tsx` — fluxo de importação

---

## 9. Riscos & Mitigações

| Risco                                    | Mitigação                                                  |
| ---------------------------------------- | ---------------------------------------------------------- |
| Serviços existentes sem `basePrice`      | Default `0`, form obriga atualizar                         |
| Campo `category` texto → `categoryId` FK | Migration script: match por nome, senão `null`             |
| Import com categorias inexistentes       | Criar categoria automaticamente ou rejeitar linha com erro |
