# Backend Domain Review

Use para review em `modules/*`, `core/*`, routers oRPC, Drizzle schemas/queries, financeiro, dominio e contratos.

Abra tambem as referencias de [implementation](../../implementation/SKILL.md) que correspondem ao patch: [orpc](../../implementation/references/orpc.md), [better-result](../../implementation/references/better-result.md), [tanstack-db](../../implementation/references/tanstack-db.md), [dbos](../../implementation/references/dbos.md) ou [pg-boss](../../implementation/references/pg-boss.md).

## oRPC e dominio

- Routers vivem no modulo dono e sao agregados em `apps/web/src/integrations/orpc/router/index.ts`.
- Handlers usam `context.db` diretamente para leituras e transacoes locais.
- Escritas ficam em `db.transaction(async (tx) => ...)`.
- Checagens de ownership/regra de negocio ficam fora da transacao quando possivel.
- Falhas esperadas usam `better-result` + tagged errors locais com erro de catalogo evlog.
- Nao lancar `ORPCError`, `AppError`, `Error` cru, string ou literal para erro esperado.
- Mensagens de erro visiveis em pt-BR.
- Bulk ops usam procedure dedicada e `Promise.allSettled` no servidor.

## Banco e calculos

- Se o finding aponta calculo financeiro, procure duplicatas em service/helper antes de encerrar.
- Dinheiro usa helper apropriado do dominio, nao acumulacao float solta.
- Datas usam `dayjs`, exceto excecoes existentes como Drizzle `$onUpdate` e fixtures.
- Ordenacao paginada deve ser deterministica, com tie-breaker estavel.
- Multi-sort deve acontecer no banco quando o fluxo pagina no banco.
- Drizzle relation names precisam ser explicitos quando ha relacoes bidirecionais ou multiplas FKs.

## Limites de refactor

- Nao criar repository layer.
- Nao criar barrel novo.
- Nao adicionar wrapper/helper generico se o tipo local fica mais claro inline.
- Nao mover ownership de modulo sem pedido explicito.

## Validacao comum

- `bun --filter <pkg> typecheck`
- `bun nx run <target> --skipSync` quando `nx sync` estiver ruidoso
- testes do modulo ou arquivo tocado
- `bunx oxfmt <arquivos>`
- `git diff --check`
