# TanStack DB Frontend CRUD

Use esta referencia somente para telas frontend que usam TanStack DB.

## Regra central

Para a tela migrada, o componente deve ler e escrever pela collection. Nao use `useQuery`, `useSuspenseQuery`, `useMutation`, `useQueryClient`, `invalidateQueries`, `setQueryData` ou cache manual na tela. `queryClient` pode entrar apenas como dependencia do `queryCollectionOptions`.

Chamadas diretas `orpc.*.call` ficam dentro da collection, optimistic actions ou route loaders. Na UI, chame actions da collection.

## Estrutura

1. Crie `apps/web/src/integrations/tanstack-db/<entity>.ts`.
2. Exporte o tipo de linha via `Outputs["entity"]["getAll"]["data"][number]`.
3. Exporte uma factory `<entity>CollectionOptions({ queryClient })`.
4. Exporte actions explicitas: `create<Entity>Action`, `update<Entity>Action`, `bulkArchive<Entity>Action`, `bulkDelete<Entity>Action`, etc.
5. Na rota, crie a collection com `createCollection(options)` e leia com `useLiveQuery`.
6. Filtros, sort e paginacao continuam na URL via `validateSearch`.

## Query Collection

Use `queryCollectionOptions` com:

- `id`: nome estavel da entidade.
- `queryKey`: base prefixada, e derivada pelos filtros quando usar `syncMode: "on-demand"`.
- `queryClient`: vindo do route context.
- `getKey`: chave real da linha.
- `syncMode: "on-demand"` quando a tela tiver filtros, sort, limit ou offset.
- `queryFn`: chama `orpc.entity.getAll.call(input)` e retorna apenas o array de linhas.

Quando usar `syncMode: "on-demand"`, leia `ctx.meta.loadSubsetOptions` e converta `where`, `orderBy`, `limit` e `offset` para o input do oRPC com `parseWhereExpression`, `parseOrderByExpression` ou `parseLoadSubsetOptions`.

O resultado do `queryFn` e tratado como estado completo daquele subset. Se o backend retorna pagina filtrada, a live query tambem deve aplicar o mesmo filtro, sort, limit e offset.

## Live Query

Na tela:

- use `useLiveQuery`;
- construa com `q.from({ entity: collection })`;
- aplique `where`, `orderBy`, `limit` e `offset`;
- finalize com `select(({ entity }) => entity)`;
- derive selecao, counts locais e rows do resultado da live query.

Nao misture rows da collection com rows vindas de hook TanStack Query puro.

## Optimistic actions

Use `createOptimisticAction`.

- `onMutate` e sempre sincrono.
- `onMutate` faz `collection.insert`, `collection.update` ou `collection.delete`.
- `mutationFn` chama `orpc.*.call`.
- Depois do backend confirmar, aguarde `collection.utils.refetch()` antes de retornar.
- A UI aguarda `transaction.isPersisted.promise` quando precisa fechar sheet, limpar import ou mostrar toast de sucesso.

Para update, use callback de draft:

```ts
collection.update(id, (draft) => {
   draft.name = name;
});
```

Para bulk, prefira uma unica action otimista que opera em array de ids ou rows. No backend, mantenha procedure bulk quando houver regra de negocio, ownership, transacao, auditoria, default rows ou performance.

## IDs e create otimista

O banco continua dono do id real.

Para create otimista, use id temporario local na row otimista e deixe o backend criar o id real. Depois do `refetch`, reconcilie pela resposta do servidor. Se houver chance de duplicata visual temporaria, esconda a row otimista quando uma row sincronizada equivalente ja existir.

Nao mude o contrato do banco para aceitar id de cliente apenas para agradar a UI.

## Validacao especifica

```bash
rg "@tanstack/react-query|useQuery\\(|useSuspenseQuery\\(|useMutation\\(|useQueryClient\\(|invalidateQueries|setQueryData|getQueryData" <arquivos>
```

Referencia atual: `apps/web/src/integrations/tanstack-db/tags.ts`.
