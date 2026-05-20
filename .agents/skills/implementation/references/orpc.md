# oRPC

Use para routers em `modules/<module>/src/router/*.ts` e contratos agregados em `apps/web/src/integrations/orpc/router/index.ts`.

## Regras

- oRPC, nao tRPC.
- Inputs e outputs sempre tipados e validados com Zod.
- Mensagens de erro em pt-BR.
- Expected failures usam domain errors locais com `better-result` e `TaggedError`.
- O middleware global mapeia tagged errors para `.errors(...)`; o modulo nao deve traduzir para `ORPCError`.
- Nunca throw literal, string, plain object, raw `Error`, `WebAppError` ou `AppError` para expected failure.
- Sem repository layer: router consulta `context.db` diretamente.
- Business checks ficam fora da transaction; writes ficam dentro de `db.transaction`.
- Ownership via middleware que carrega entidade, verifica `teamId` e passa `next({ context: { entity } })`.
- Handler nao reconsulta entidade ja carregada pela middleware.

## Bulk

Para bulk ops, crie procedure dedicada. Nao rode loop de mutation individual no client.

Use `Promise.allSettled` server-side quando o negocio permite sucesso parcial; use transaction unica quando a operacao deve ser atomica.

## Client types

Frontend usa:

```ts
import type { Inputs, Outputs } from "@/integrations/orpc/client";
```

Frontend nao importa `@core/*`, exceto helpers puros permitidos por `AGENTS.md`.

## Direct calls

No padrao antigo de TanStack Query, componentes usam hooks/options. Em telas migradas para TanStack DB, `orpc.*.call` pode ficar dentro das collections/actions, nunca espalhado na UI.
