---
name: implementation
description: Guia de implementacao do Montte para backend, frontend, CRUD, erros, jobs e workflows. Use ao criar, migrar, refatorar, revisar ou testar codigo em apps, modules, core ou packages.
---

# Implementation

Use esta skill antes de implementar mudancas no Montte. Ela roteia para referencias menores; nao carregue todas por padrao.

## Roteamento

- CRUD frontend, DataTable, forms, importacao, bulk actions, optimistic UI: leia `references/tanstack-db.md`.
- Domain errors, recoverable failures, provider calls, jobs, workflows, serialization: leia `references/better-result.md`.
- oRPC router, input/output contracts, ownership, typed errors, transport: leia `references/orpc.md`.
- Durable workflows, replay, DBOS transactions/steps, self-rescheduling: leia `references/dbos.md`.
- Operational background jobs, debounce, singleton, retry, DLQ: leia `references/pg-boss.md`.

Se uma tarefa cruza dominios, leia so as referencias envolvidas. Exemplo: criar procedure + job async = `orpc.md`, `pg-boss.md`, `better-result.md`.

## Regras sempre ativas

- Mensagens visiveis ao usuario em pt-BR.
- Sem `as` em TypeScript editado.
- Sem `try/catch` em codigo de app/module/core, exceto tests/scripts.
- Datas com `dayjs`; `new Date()` so em excecoes existentes como Drizzle `$onUpdate`.
- Sem barrel novo.
- Sem repository layer novo.
- Frontend importa tipos de oRPC por `Inputs` e `Outputs` de `@/integrations/orpc/client`.
- Tabelas e filtros persistem estado na URL.
- Forms usam TanStack Form; forms em sheet usam `useSheet`.
- Validar com comandos focados antes de fechar.

## Workflow

1. Leia o codigo atual antes de editar.
2. Escolha as referencias desta skill que se aplicam.
3. Mantenha o diff no menor escopo que resolve o pedido.
4. Use patterns ja existentes no modulo antes de criar abstracao.
5. Rode format/typecheck/test focado e `git diff --check`.

## Validacao base

```bash
bunx oxfmt --write <arquivos>
bun --filter web typecheck
bun --filter <module> typecheck
git diff --check
```
