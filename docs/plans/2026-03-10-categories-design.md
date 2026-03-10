# Categorias — Design do MVP

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refatorar o módulo de categorias de 2 tabelas (categories + subcategories) para 1 tabela auto-referencial com até 3 níveis, validators drizzle-zod, e suporte a campos DRE.

**Architecture:** Tabela `categories` com `parentId` auto-referencial. Nível calculado a partir do pai (máx 3). Type obrigatório (income/expense), herdado nos níveis 2/3, imutável. Keywords únicas por team. Arquivamento em cascata. Campos DRE na tabela mas sem constante/validação (package futuro #641).

**Tech Stack:** Drizzle ORM, drizzle-zod, PGLite (testes), Vitest

---

## 1. Schema da Categoria

Reescrever `categories.ts` com tabela auto-referencial:

**Campos:**

- `id` — UUID PK
- `teamId` — FK team
- `parentId` — FK categories (nullable, null = nível 1), onDelete cascade
- `level` — integer 1-3, calculado a partir do parentId
- `name` — text, 2-120 chars
- `description` — text, max 255, nullable
- `type` — pgEnum `income | expense`, obrigatório, herdado do pai nos níveis 2/3
- `isDefault` — boolean, default false
- `color` — text hex (#RRGGBB), nullable
- `icon` — text (Lucide icon name), nullable
- `keywords` — text[], nullable, max 20 itens
- `notes` — text, max 500, nullable
- `isArchived` — boolean, default false
- `participatesDre` — boolean, default false
- `dreGroupId` — text, nullable (referência ao ID do grupo DRE futuro)
- `createdAt` — timestamp
- `updatedAt` — timestamp

**Indexes:**

- `categories_team_id_idx` em `teamId`
- `categories_parent_id_idx` em `parentId`
- `categories_team_parent_type_name_unique` unique em `(teamId, parentId, type, name)`

**Deletar:** tabela `subcategories` e arquivo `subcategories.ts`

---

## 2. Validators (drizzle-zod)

Mesmo padrão de bank-accounts e credit-cards:

```typescript
export const createCategorySchema = baseCategorySchema
   .extend({
      name: nameSchema,  // 2-120 chars
      type: z.enum(["income", "expense"]),
      parentId: z.string().uuid().nullable().optional(),
      description: descriptionSchema,  // max 255, nullable
      color: colorSchema.nullable().optional(),  // hex
      icon: z.string().max(50).nullable().optional(),
      keywords: keywordsSchema,  // array max 20, nullable
      notes: z.string().max(500).nullable().optional(),
      participatesDre: z.boolean().default(false),
      dreGroupId: z.string().nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (data.participatesDre && !data.dreGroupId) {
         ctx.addIssue({ path: ["dreGroupId"], message: "Grupo DRE obrigatório." });
      }
   });

export const updateCategorySchema = /* partial, sem type/parentId (imutáveis) */
```

**Exports:** `createCategorySchema`, `updateCategorySchema`, `CreateCategoryInput`, `UpdateCategoryInput`

---

## 3. Repository (padrão singleton)

Mesmo padrão do `bank-accounts-repository.ts`:

- Singleton `db` de `@core/database/client`
- Reads com `db.query.*.findMany()` / `findFirst()`
- Writes com `db.insert()` / `db.update()` / `db.delete()`
- Validação com `validateInput` + schemas drizzle-zod

**`categories-repository.ts`** (reescrever):

- `createCategory(teamId, data)` — valida level, herda type do pai, valida keywords únicas
- `listCategories(teamId, { type?, includeArchived? })` — flat list
- `getCategory(id)`
- `getCategoryTree(teamId, { type?, includeArchived? })` — flat → árvore em memória
- `updateCategory(id, data)` — bloqueia isDefault, valida keywords únicas
- `archiveCategory(id)` — cascata em descendentes, bloqueia isDefault
- `reactivateCategory(id)`
- `deleteCategory(id)` — bloqueia isDefault, bloqueia se tem transactions na árvore
- `categoryHasTransactions(categoryId)` — checa categoria + descendentes
- `validateKeywordsUniqueness(teamId, keywords, excludeCategoryId?)`

**Deletar:** `subcategories-repository.ts`

---

## 4. Regras de negócio

| Regra                   | Comportamento                                                        |
| ----------------------- | -------------------------------------------------------------------- |
| Nível máximo            | 3 — bloquear criação se pai.level >= 3                               |
| Herança de tipo         | Nível 2/3 herda type do pai automaticamente                          |
| Tipo imutável           | Não pode trocar type após criação                                    |
| Keywords únicas         | Mesmo termo não pode existir em 2 categorias ativas do team          |
| Default protegido       | Categorias isDefault não podem ser editadas, arquivadas ou deletadas |
| Delete com transactions | Bloquear — permitir apenas arquivamento                              |
| Arquivamento cascata    | Arquivar pai arquiva todos os descendentes                           |
| Delete cascata          | FK onDelete cascade — deletar pai deleta filhos                      |
| DRE obrigatório         | Se participatesDre=true, dreGroupId é obrigatório                    |

---

## 5. Alterações em transactions

Remover campo `subcategoryId` de `transactions.ts`. O campo `categoryId` agora aponta pra qualquer nível da árvore (antes apontava só pra nível 1).

---

## 6. Testes

### Validators

**`__tests__/schemas/categories-validators.test.ts`:**

- Aceita categoria válida (income/expense)
- Rejeita nome curto/longo
- Rejeita type inválido
- Rejeita cor inválida
- Aceita opcionais vazios
- Rejeita keywords > 20 itens
- Rejeita descrição > 255
- DRE: rejeita sem dreGroupId quando participatesDre=true
- DRE: aceita com dreGroupId
- Update aceita parcial
- Update rejeita nome curto

### Repository (PGLite)

**`__tests__/repositories/categories-repository.test.ts`:**

- CRUD nível 1
- Cria nível 2 herdando type
- Cria nível 3 herdando type
- Bloqueia nível 4
- Lista por team / filtra por type
- Lista/oculta arquivadas
- Bloqueia edição de default
- Bloqueia delete com transactions
- Delete cascata
- Arquivamento cascata
- Reativa categoria
- Keywords únicas no team

---

## Fora do MVP

- Package DRE com constantes e validação (#641)
- Tela "Inteligência / Automação" (IA)
- Auto-categorização com IA
- Campo `ordem` / drag-and-drop
- Categorias de sistema (`isSystem`)
- Migration de dados (banco será dropado)
