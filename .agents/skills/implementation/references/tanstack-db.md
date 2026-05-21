# TanStack DB Frontend CRUD

Use esta referencia para telas CRUD migradas para TanStack DB.
Na UI da tela migrada, leia e escreva pela collection; nao misture com cache manual de TanStack Query.

## Regra central

Na tela migrada, nao use `useQuery`, `useSuspenseQuery`, `useMutation`, `useQueryClient`, `invalidateQueries`, `setQueryData` ou `getQueryData`.
`queryClient` entra apenas como dependencia do `queryCollectionOptions`.

Chamadas diretas `orpc.*.call` ficam dentro da collection, da action otimista ou de loaders de rota.

## Estrutura

1. Crie `apps/web/src/integrations/tanstack-db/<entity>.ts`.
2. Exporte o tipo da linha a partir do retorno do oRPC.
3. Exporte uma factory `<entity>CollectionOptions({ queryClient, ...scopes })`.
4. Exporte actions explicitas: `create<Entity>Action`, `update<Entity>Action`, `bulkArchive<Entity>Action`, `bulkDelete<Entity>Action`, etc.
5. Na rota, crie a collection com `createCollection(options)` dentro de `useMemo`.
6. Leia com `useLiveQuery`.
7. Filtros, sort, paginacao e tabs continuam na URL via `validateSearch`.

## Schemas

Use `schema` no `queryCollectionOptions` para validar rows e mutations locais.
Prefira `zod` ou outro Standard Schema compatível.

Regras:

- Schema em escopo de modulo, nunca dentro do componente.
- O shape da collection precisa bater com o row real.
- `z.date()` para datas ja normalizadas.
- `nullable` quando o banco pode devolver `null`.
- Transformacoes devem aceitar o tipo de entrada e o tipo final quando a linha for atualizada localmente.

Padrao seguro para transforms:

```ts
import dayjs from "dayjs"

const createdAtSchema = z
   .union([z.string(), z.date()])
   .transform((value) => (typeof value === "string" ? dayjs(value).toDate() : value))
```

## Query Collection

Use `queryCollectionOptions` como collection options creator do adapter `query-db-collection`.

Regras:

- `id`: identificador estavel; escopo por `teamId`/`organizationId` quando a collection puder coexistir com outra igual.
- `queryKey`: sempre compartilhe o mesmo prefixo base. Se a key for derivada de subset, o prefixo da lista precisa permanecer igual.
- `queryFn`: chama o oRPC e retorna o array de rows.
- `getKey`: chave real da linha.
- `syncMode: "on-demand"` quando a tela tiver filtros, sort, limit ou offset.
- `queryFn` recebe `ctx.meta.loadSubsetOptions`; converta isso para o input do backend.

Use `parseLoadSubsetOptions` quando quiser `filters`, `sorts`, `limit` e `offset` juntos. Use `parseWhereExpression` e `parseOrderByExpression` quando precisar mapear operadores customizados.
O resultado do `queryFn` e o estado completo daquele subset; rows ausentes sao removidas. Se o backend retorna pagina filtrada, a live query tambem precisa aplicar o mesmo filtro, sort, limit e offset.

Exemplo:

```ts
export function tagsCollectionOptions({ queryClient }: { queryClient: QueryClient }) {
   return queryCollectionOptions({
      id: "tags",
      queryClient,
      getKey: (tag: TagsCollectionRow) => tag.id,
      syncMode: "on-demand",
      queryKey: (options) =>
         hasLoadSubsetOptions(options)
            ? ["tags", tagsInputFromLoadSubsetOptions(options)]
            : ["tags"],
      queryFn: async (ctx) => {
         const input = tagsInputFromLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
         const result = await orpc.tags.getAll.call(input)
         return result.data
      },
   })
}
```

## Live Queries

Na rota, a collection e lida com `useLiveQuery`.

Regras:

- `useLiveQuery((q) => ..., [deps])`.
- Comece com `q.from({ entity: collection })`.
- Aplique `where`, `orderBy`, `limit` e `offset` na query viva.
- Finalize com `select(({ entity }) => entity)`.
- Derive listas, totais e estados de paginação do resultado da live query.
- Nao misture rows da collection com rows vindas de `useQuery`.
- Nao recrie a collection a cada render.

Quando o subset estiver paginado, filtre e ordene a live query do mesmo jeito que o backend carregou.
Se houver optimistic row duplicada antes do refetch, remova a duplica quando a row sincronizada equivalente ja existir.

## Mutations e optimistic actions

Use `createOptimisticAction`.

Regras:

- `onMutate` e sempre sincrono.
- `onMutate` usa `collection.insert`, `collection.update` ou `collection.delete`.
- `mutationFn` chama oRPC.
- Depois da confirmacao do backend, aguarde `collection.utils.refetch()` antes de retornar.
- A UI espera `transaction.isPersisted.promise` quando precisa fechar sheet, limpar import ou mostrar toast.

Para update, use callback de draft:

```ts
collection.update(id, (draft) => {
   draft.name = name
})
```

Para create, use id temporario local so quando necessario. O banco continua dono do id final.
Se a criacao puder gerar duplicata visual temporaria, esconda a row otimista quando a row sincronizada equivalente chegar.

Para bulk, prefira uma unica action otimista com array de ids ou rows.
No backend, mantenha procedure bulk quando houver regra de negocio, ownership, transacao ou performance.
Nunca faça loop de `mutateAsync` no client.

## Error handling

Erros de query devem subir para o estado da tela, `QueryBoundary` ou `errorComponent` da rota.
Erros de mutation sao tratados no ponto de uso, normalmente esperando `transaction.isPersisted.promise` e exibindo toast em pt-BR.

Regras:

- Nao engula erro do oRPC.
- Se o refetch apos sucesso falhar, nao transforme isso em falha da escrita.
- Use helper nomeado para refetch seguro quando quiser isolar a reconciliacao.
- Mensagens de erro visiveis ao usuario sempre em pt-BR.
- Se o schema rejeitar a row local, corrija a origem em vez de burlar com cast.

## Anti-padroes

- `useQuery`, `useSuspenseQuery`, `useMutation`, `useQueryClient`, `invalidateQueries`, `setQueryData` ou cache manual na tela migrada.
- Collection global sem escopo quando a tela depende de filtros, team ou organization.
- Recriar collection fora de `useMemo`.
- `queryFn` devolvendo envelope quando a collection espera array.
- `onMutate` async.
- Loop de mutations unitarias para bulk.
- `try/catch` em codigo de app/module/core.

## Validacao especifica

```bash
rg "@tanstack/react-query|useQuery\\(|useSuspenseQuery\\(|useMutation\\(|useQueryClient\\(|invalidateQueries|setQueryData|getQueryData" <arquivos>
rg "createCollection\(|useLiveQuery\(|createOptimisticAction\(|queryCollectionOptions\(" <arquivos>
```
