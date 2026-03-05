# Serviços: Importação, Modais e Listagem — Design

**Goal:** Padronizar a jornada de Serviços com importação, modais de criar/editar e listagem completa (busca, filtros, colunas e totalizadores) seguindo o spec do PM.

**Decisões chave**
- **Preço padrão**: armazenado em `services.basePrice` (integer, cents). Simplifica listagem, importação e edição.
- **Filtros**: renomear “Tipo” para **Status** (Ativo/Inativo). **Cliente/Fornecedor** removido (não há dado na entidade).
- **Form padrão**: 4 campos apenas (Nome, Descrição, Preço padrão, Categoria). Sem variantes no fluxo básico.

---

## Arquitetura & Dados

1) **Schema**
- Adicionar `basePrice` em `packages/database/src/schemas/services.ts` (integer, not null).
- Atualizar `serviceSchema` no oRPC para aceitar `basePrice`.

2) **API**
- `services.create/update`: aceitar e persistir `basePrice`.
- `services.getAll`: retornar `basePrice` para listagem.
- **Novo** `services.importBulk`: criar em lote a partir de CSV, com validação por linha e retorno de contagem e erros.

---

## UI/UX

### Listagem (DataTable)
- **Colunas**: Nome, Preço padrão, Categoria, Ações.
- **Busca**: input que filtra client-side por Nome e Descrição.
- **Filtros**:
  - **Status**: Ativo/Inativo (mapeado de `isActive`).
  - **Categoria**: dropdown dinâmico a partir das categorias presentes.
- **Totalizador**: “X serviços” (sobre lista filtrada).
- **Ações**: Importar, Exportar, Adicionar novo, Editar, Excluir.

### Modais (Credenza)
- **Criar/Editar**: `ServiceForm` com os 4 campos (obrigatórios: Nome, Preço padrão, Categoria; opcional: Descrição).
- **Importar**: `ServiceImportCredenza` inspirado em `transaction-import-credenza`.

### Importação (CSV)
- Template: `nome,descricao,preco_padrao,categoria`.
- Fluxo: Upload → Mapeamento → Prévia → Confirmar.
- Normalização de preço (ex.: “R$ 1.500,00” → 150000).

### Exportação
- CSV local gerado a partir da lista filtrada.

---

## Validações
- `name`: obrigatório, trim.
- `category`: obrigatório.
- `basePrice`: obrigatório e > 0.

---

## Testes & Verificação
- **Router**: criar teste mínimo para `importBulk` (sucesso + falha de validação).
- **UI**: smoke test do form (preço obrigatório) + renderização do preço formatado na tabela.
- **Comandos**: `bun run typecheck` + `bun run check`.

---

## Riscos & Mitigações
- **Migração de dados**: serviços existentes ficarão sem `basePrice`. Mitigar com default temporário (`0`) e exigir atualização no form.
- **Campos não mapeados**: remover “Cliente/Fornecedor” evita UX enganoso.
