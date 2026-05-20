# Better Result

Use esta referencia quando implementar, migrar, revisar ou testar fluxos que modelam falhas esperadas com `better-result` no Montte.

Docs primarias:

- `https://better-result.dev/llms.txt`
- `https://better-result.dev/core/creating-results`
- `https://better-result.dev/core/transforming-results`
- `https://better-result.dev/core/error-handling`
- `https://better-result.dev/core/pattern-matching`
- `https://better-result.dev/core/generator-composition`
- `https://better-result.dev/advanced/async-operations`
- `https://better-result.dev/advanced/retry-logic`
- `https://better-result.dev/advanced/serialization`
- `https://better-result.dev/advanced/best-practices`

## Quando usar

Use `Result<T, E>` para falhas esperadas em:

- regras de dominio;
- permissoes, ownership, not-found, conflito e validacao;
- chamadas de provider externo;
- jobs `pg-boss`;
- workflows DBOS;
- cache/storage/queue;
- adapters de boundary;
- parsing de payload externo;
- operacoes retryable.

Nao use `Result` para defeito de programacao. Se o codigo chegou em estado impossivel, dado corrompido, bug de tipo, invariant quebrada ou API de framework que exige exception, isso pode ser throw/panic. Falha esperada de produto nao e throw.

## Regras obrigatorias

- Nao misture `better-result` e `neverthrow` no mesmo modulo. Modulos legados em `neverthrow` podem ficar nele ate uma migracao intencional.
- Nao retorne `Result<..., string>`, `Result<..., Error>`, `Result<..., unknown>` ou `Result<..., any>` em codigo de dominio.
- Nao deixe `unknown`, erro bruto de SDK, response bruto de provider ou `cause` opaco atravessar boundary.
- Mensagens visiveis ao usuario sempre em pt-BR.
- Nao crie `errors.ts` module-wide so para centralizar erros.
- Nao crie wrapper generico como `makeError`, `internalError`, `dbError`, `notFoundError` ou factory parecida que esconda o catalog code concreto.
- Nao crie uma classe por catalog code. Use uma classe `TaggedError` por bounded context.
- Nao use repository layer para acomodar `Result`.
- Nao use `try/catch` em codigo de app/module/core. Use `Result.try(...)` ou `Result.tryPromise(...)`.

## Import padrao

```ts
import { Result, TaggedError } from "better-result";
```

Importe apenas o que usar. Nao adicione barrel para reexportar `Result`, `TaggedError` ou erros locais.

## Catalogo de erro

Leia `evlog.md` para regras completas de `defineErrorCatalog`, `RegisteredErrorCatalogs`, tags, status, drains e logging.

Resumo para `better-result`: o erro esperado deve carregar um catalog error concreto do owner. Defina o catalogo perto do router, job, workflow, provider adapter ou runtime que realmente conhece o contrato.

Padrao:

```ts
import { defineErrorCatalog } from "evlog";

const tagRouterErrors = defineErrorCatalog("classification.tags.router", {
  CREATE_FAILED: {
    status: 500,
    message: "Falha ao criar centro de custo.",
    tags: ["classification", "tags", "router"],
  },
  DUPLICATE_NAME: {
    status: 409,
    message: "Ja existe um centro de custo com esse nome.",
    tags: ["classification", "tags", "router"],
  },
  NOT_FOUND: {
    status: 404,
    message: "Centro de custo nao encontrado.",
    tags: ["classification", "tags", "router"],
  },
});

declare module "evlog" {
  interface RegisteredErrorCatalogs {
    "classification.tags.router": typeof tagRouterErrors;
  }
}
```

O nome do catalogo deve apontar para o dono real. Evite nomes largos como `app`, `common`, `database` ou `router` sem bounded context.

## TaggedError

Use um `TaggedError` local por bounded context. O payload deve ser pequeno, tipado e operacional.

```ts
export class TagRouterError extends TaggedError("TagRouterError")<{
  error: ReturnType<typeof tagRouterErrors.CREATE_FAILED>;
  teamId: string;
  organizationId: string;
  message: string;
}>() {}
```

Quando o mesmo bounded context tem varios catalog codes, o campo `error` deve ser uma uniao dos retornos necessarios:

```ts
export class TagRouterError extends TaggedError("TagRouterError")<{
  error:
    | ReturnType<typeof tagRouterErrors.CREATE_FAILED>
    | ReturnType<typeof tagRouterErrors.DUPLICATE_NAME>
    | ReturnType<typeof tagRouterErrors.NOT_FOUND>;
  teamId: string;
  organizationId: string;
  tagId?: string;
  message: string;
}>() {}
```

Campos recomendados:

- `error: ReturnType<typeof catalog.CODE>`;
- ids operacionais (`teamId`, `organizationId`, `userId`, `jobId`, `threadId`, `providerId`, `workflowId`);
- `message` em pt-BR;
- metadata pequena (`retryable`, `provider`, `status`, `externalCode`) quando o chamador precisa decidir algo.

Evite:

- `cause: unknown`;
- payload bruto de SDK;
- response inteiro de provider;
- `operation: string` generico;
- classe base generica;
- uma classe por catalog code;
- `Error` nativo para erro esperado.

## Criando Results

Use o menor construtor que declare a intencao.

```ts
const ok = Result.ok(value);
const emptyOk = Result.ok();
const err = Result.err(error);
```

Use `Result.try(...)` apenas para API sincrona que pode throw:

```ts
const parsed = Result.try({
  try: () => schema.parse(input),
  catch: () =>
    new TagRouterError({
      error: tagRouterErrors.INVALID_INPUT(),
      teamId: input.teamId,
      organizationId: input.organizationId,
      message: "Dados invalidos.",
    }),
});
```

Para Zod, prefira `safeParse` quando isso for mais direto:

```ts
const parsed = tagInputSchema.safeParse(input);

if (!parsed.success) {
  return Result.err(
    new TagRouterError({
      error: tagRouterErrors.INVALID_INPUT(),
      teamId: input.teamId,
      organizationId: input.organizationId,
      message: "Dados invalidos.",
    }),
  );
}

return Result.ok(parsed.data);
```

Para nullable, converta explicitamente:

```ts
const fromNullable = <T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> =>
  value === null || value === undefined ? Result.err(error) : Result.ok(value);
```

Nao use helper generico compartilhado se ele esconder o erro concreto. Pode usar helper local pequeno quando isso torna a leitura melhor e o catalog code ainda fica visivel no ponto da falha.

## Async

Sempre `await Result.tryPromise(...)`. Ele retorna `Promise<Result<...>>`.

Use a forma `{ try, catch }` em codigo de producao:

```ts
const result = await Result.tryPromise({
  try: () =>
    provider.createInvoice(input, {
      signal: AbortSignal.timeout(10_000),
    }),
  catch: () =>
    new BillingProviderError({
      error: billingProviderErrors.PROVIDER_REQUEST_FAILED({
        provider: "hyprpay",
      }),
      provider: "hyprpay",
      invoiceId: input.invoiceId,
      retryable: true,
      message: "Falha ao criar cobranca no provedor.",
    }),
});
```

O `catch` deve converter imediatamente para um erro tipado do dono. Nao retorne `error`, `unknown`, `new Error(...)`, string, objeto solto ou payload bruto.

## Retry

Use retry dentro de `Result.tryPromise(...)` quando a operacao menor deve ser tentada novamente:

```ts
const result = await Result.tryPromise(
  {
    try: () => provider.syncCustomer(input.customerId),
    catch: () =>
      new CustomerSyncError({
        error: customerSyncErrors.PROVIDER_SYNC_FAILED(),
        customerId: input.customerId,
        provider: "hyprpay",
        retryable: true,
        message: "Falha ao sincronizar cliente no provedor.",
      }),
  },
  {
    retry: {
      times: 3,
      delayMs: 250,
      backoff: "exponential",
      shouldRetry: (error) => error.retryable,
    },
  },
);
```

Regras:

- `times` significa tentativas adicionais, nao total de execucoes.
- `exponential` para instabilidade de provider/rede.
- `linear` para recuperacao de rate-limit.
- `constant` para operacoes curtas e baratas, principalmente teste/infra local.
- `shouldRetry` deve ser total, puro e sem side effects.
- Nao retry validacao, auth, permission, conflict, not-found deterministico ou parsing deterministico.
- Combine retry com timeout quando a API pode travar.

Em `pg-boss`, prefira os recursos da plataforma antes de retry interno:

- `retryLimit`;
- `retryDelay`;
- `retryBackoff`;
- `deadLetter`;
- `singletonKey`;
- `sendDebounced`;
- `sendThrottled`;
- `group`.

Use retry interno em job so quando a suboperacao especifica precisa de politica diferente da fila.

## Composicao

Escolha o primitivo pelo fluxo:

- `map()` para transformar sucesso sem falhar.
- `mapError()` para normalizar erro em uma boundary.
- `andThen()` para cadeia curta sincrona que retorna `Result`.
- `andThenAsync()` para cadeia curta async que retorna `Result`.
- `Result.gen()` para varios passos, condicionais, loops, early returns ou cleanup.
- `Result.match()` quando sucesso e erro viram outputs diferentes em uma boundary.
- `Result.partition(results)` para batch com sucesso parcial.

Dentro de `Result.gen`:

- use `yield* result` para `Result`;
- use `yield* Result.await(promise)` para `Promise<Result>`;
- retorne `Result.ok(...)` ou `Result.err(...)`.

```ts
const result = await Result.gen(async function* () {
  const payload = yield* parseJobPayload(job.id, job.data);
  const thread = yield* Result.await(loadThread(payload.threadId));
  const title = yield* Result.await(generateTitle(thread));

  return Result.ok({ threadId: thread.id, title });
});
```

Nao retorne valor cru dentro de `Result.gen`.

Prefira manter o valor no contexto de `Result` ate a boundary. Evite unwrap/check/re-wrap manual quando `Result.gen()` ou `andThen()` deixa o fluxo claro.

Use loops dentro de `Result.gen()` apenas quando fail-fast e correto. Para bulk onde um item falho nao deve parar os outros, produza uma lista de Results e use `Result.partition(...)`.

Para operacoes async independentes, dispare em paralelo com `Promise.all` e componha os Results depois:

```ts
const [customerResult, invoiceResult] = await Promise.all([
  loadCustomer(input.customerId),
  loadInvoice(input.invoiceId),
]);

const result = Result.gen(function* () {
  const customer = yield* customerResult;
  const invoice = yield* invoiceResult;

  return Result.ok({ customer, invoice });
});
```

## Panics e unwrap

Nao lance erro dentro de callback de:

- `map`;
- `mapError`;
- `andThen`;
- `tap`;
- `match`;
- retry predicates;
- `catch` handlers;
- cleanup de `Result.gen`.

Se callback panica, isso e defeito de user-code, nao uma falha recuperavel. Nao capture `Panic` para converter em erro de dominio; corrija o callback.

Use `unwrap()` apenas:

- depois de `Result.isOk(result)`;
- depois de `result.isOk()`;
- em teste, apos narrowing explicito.

Use `unwrapOr(fallback)` apenas quando descartar o erro e intencional, por exemplo dado opcional de display. Nao use `unwrapOr` para esconder falha de provider, DB, queue ou regra de negocio.

## Side effects

Use `tap()` e `tapAsync()` apenas para side effects que nao podem alterar o resultado:

- metricas;
- logs estruturados;
- observabilidade.

Nao esconda falhas normais dentro de `tap()`:

- envio de email;
- provider externo;
- enqueue de job;
- escrita em DB;
- escrita em storage/cache;
- chamada HTTP que faz parte do fluxo.

Modele esses passos como `Result` explicito, ou descarte o erro de forma intencional com log claro na boundary apropriada.

## oRPC

Em routers oRPC:

- Zod no input/output;
- business-rule checks antes da transacao;
- writes dentro de `context.db.transaction(...)`;
- ownership em middleware e entidade via `next({ context: { entity } })`;
- falhas esperadas com `TaggedError` local;
- handler pode dar `throw result.error` depois de `Result.isError(result)`.

Padrao:

```ts
const result = await Result.gen(async function* () {
  const existing = yield* Result.await(findTagByName(input));

  if (existing) {
    yield* new TagRouterError({
      error: tagRouterErrors.DUPLICATE_NAME(),
      teamId: context.teamId,
      organizationId: context.organizationId,
      message: "Ja existe um centro de custo com esse nome.",
    });
  }

  const created = yield* Result.await(createTag(input));

  return Result.ok(created);
});

if (Result.isError(result)) throw result.error;

return result.value;
```

Nao traduza erro esperado para `ORPCError`, `WebAppError`, `AppError`, `Error`, string ou objeto solto dentro do modulo. A boundary global de oRPC faz o mapeamento typed `.errors(...)`.

## Transacoes Drizzle

Antes da transacao:

- cheque permissao;
- cheque conflito;
- cheque not-found quando possivel;
- monte dados validados.

Dentro da transacao:

- faca as writes necessarias;
- retorne dados de `returning()`;
- nao faca chamadas de provider externo;
- nao faca operacoes longas.

Depois da transacao:

- converta `returning()` vazio para erro tipado;
- enfileire job se esse enqueue nao precisa fazer parte da mesma transacao;
- adapte resultado para boundary.

Exemplo:

```ts
const createdResult = await Result.tryPromise({
  try: () =>
    context.db.transaction(async (tx) => {
      const rows = await tx.insert(tags).values(values).returning();
      return rows[0] ?? null;
    }),
  catch: () =>
    new TagRouterError({
      error: tagRouterErrors.CREATE_FAILED(),
      teamId: context.teamId,
      organizationId: context.organizationId,
      message: "Falha ao criar centro de custo.",
    }),
});

const result = Result.gen(function* () {
  const created = yield* createdResult;

  if (!created) {
    yield* new TagRouterError({
      error: tagRouterErrors.CREATE_FAILED(),
      teamId: context.teamId,
      organizationId: context.organizationId,
      message: "Falha ao criar centro de custo.",
    });
  }

  return Result.ok(created);
});
```

## Bulk

Bulk no servidor deve ser procedure dedicada. Cliente nao deve loopar chamadas de mutacao.

Use `Promise.allSettled` ou Results por item quando sucesso parcial faz sentido. Use transacao unica quando atomicidade total faz parte do contrato.

Para sucesso parcial:

```ts
const results = await Promise.all(
  input.ids.map((id) => archiveOneTag({ id, context })),
);

const partitioned = Result.partition(results);

return {
  archived: partitioned.ok,
  failed: partitioned.error,
};
```

Para falha atomicamente:

```ts
const result = await Result.tryPromise({
  try: () =>
    context.db.transaction(async (tx) => {
      await tx.update(tags).set({ archivedAt }).where(inArray(tags.id, input.ids));
      return input.ids;
    }),
  catch: () =>
    new TagRouterError({
      error: tagRouterErrors.BULK_ARCHIVE_FAILED(),
      teamId: context.teamId,
      organizationId: context.organizationId,
      message: "Falha ao arquivar centros de custo.",
    }),
});
```

Escolha um contrato e deixe explicito no output.

## Jobs pg-boss

Todo job precisa:

- queue name valido (`/`, `-`, `_`, `.`, alfanumerico; sem `:`);
- schema Zod do payload;
- helper de enqueue;
- handler do worker;
- catalogo de erro local;
- `TaggedError` local;
- retorno typed `Result`;
- log com `evlog`;
- DLQ/retry/singleton/debounce quando aplicavel.

Payload invalido e job sem id sao erros, nao no-op.

Padrao:

```ts
const parsed = jobPayloadSchema.safeParse(job.data);

if (!parsed.success) {
  return Result.err(
    new AgentTitleJobError({
      error: agentTitleJobErrors.INVALID_PAYLOAD(),
      jobId: job.id ?? "",
      threadId: "",
      message: "Payload do job invalido.",
    }),
  );
}
```

Nao use `DBOS.logger` em pg-boss. Use `evlog`.

## DBOS

Use DBOS para workflows duraveis: billing, ledger, entitlement, fechamento de invoice, state machine, replay, steps/transacoes DBOS e self-rescheduling deterministico.

Regras com Result:

- input validado por Zod;
- erros esperados typed;
- Results serializados se cruzarem storage/queue/RPC/workflow boundary;
- logs com `DBOS.logger`;
- chamadas nao deterministicas dentro de `DBOS.runStep`;
- writes em `DrizzleDataSource.runTransaction`;
- workflow input sempre carrega `teamId` e `organizationId`.

Nao use `pg-boss` quando replay/durabilidade do workflow faz parte da corretude.

## Serializacao

`Result` e instancia de classe. Nao sobrevive JSON, queue, cache, RPC ou workflow como Result usavel.

Use:

- `Result.serialize(result)` antes de JSON, cache, queue, RPC ou persistencia;
- `Result.deserialize<T, E>(payload)` ao receber;
- `SerializedResult<T, E>` como shape de transporte.

Shape:

```ts
type SerializedResult<T, E> =
  | { status: "ok"; value: T }
  | { status: "error"; error: E };
```

Sempre trate `ResultDeserializationError` quando o payload e externo, antigo ou nao confiavel. Depois de deserialize, Zod-validate `value` ou `error` quando o schema pode ter mudado.

Para storage de longo prazo, embrulhe o serialized result com versao:

```ts
type StoredJobResult<T, E> = {
  version: 1;
  result: SerializedResult<T, E>;
};
```

`TaggedError` serializa via `toJSON()`, mas o payload ainda deve continuar pequeno e controlado.

## Boundaries

Toda boundary deve escolher um contrato explicito:

1. retorna valor de sucesso e deixa falhas typed virarem erro da boundary;
2. retorna `SerializedResult<T, E>` quando o erro esperado faz parte do contrato de dados.

Nao vaze Result vivo por JSON. Nao esconda erro de dominio atras de erro generico de transporte.

Em UI:

- toast mostra `message` pt-BR vindo da boundary;
- erro de campo so volta como erro de campo quando o formulario consegue resolver visualmente;
- bulk deve mostrar sucesso parcial quando o contrato permite sucesso parcial.

## Match e narrowing

Use `Result.isOk(result)` / `Result.isError(result)` para narrowing simples.

Use `matchError` quando a decisao depende do tipo de erro e precisa ser exaustiva.

Use `matchErrorPartial` so quando fallback e intencional e tipado.

Exemplo:

```ts
if (Result.isError(result)) {
  if (TagRouterError.is(result.error)) {
    throw result.error;
  }

  throw new TagRouterError({
    error: tagRouterErrors.UNKNOWN_FAILURE(),
    teamId: context.teamId,
    organizationId: context.organizationId,
    message: "Falha inesperada ao processar centro de custo.",
  });
}
```

Evite `instanceof` para erro de dominio quando a biblioteca fornece guard de `TaggedError`.

## Testes

Para fluxos nao triviais, cubra:

- caminho `Ok`;
- cada branch importante de `TaggedError`;
- guard do erro (`MyError.is(result.error)`);
- short-circuit de `Result.gen`;
- falha async via `Result.await`;
- retry count e erro nao retryable;
- round trip de serializacao/deserializacao;
- contrato da boundary;
- bulk com sucesso parcial se existir.

Em teste, leia `.value` e `.error` somente apos narrowing:

```ts
expect(Result.isOk(result)).toBe(true);

if (Result.isOk(result)) {
  expect(result.value.id).toBe(expectedId);
}
```

Nao use unwrap em producao para simplificar teste mental. Em teste, unwrap so depois de assertion/narrowing.

## Migracao incremental

1. Comece nas bordas que rejeitam/throwam: provider, job, workflow, storage, queue e router.
2. Crie catalogo e `TaggedError` local minimo.
3. Converta a funcao folha antes do chamador.
4. Troque `try/catch` por `Result.try` / `Result.tryPromise`.
5. Troque throw esperado por `Result.err(...)` ou `yield* new TaggedError(...)`.
6. Na boundary oRPC, lance o erro typed depois de `Result.isError(result)`.
7. Em queue/cache/workflow, serialize antes de cruzar processo ou JSON.
8. Adicione teste focado para erro principal e sucesso.

Nao tente migrar o modulo inteiro se o pedido e pontual. Mantenha o diff no escopo do fluxo tocado.

## Checklist antes de fechar

- O erro esperado tem catalogo local com status/severity adequado?
- A classe `TaggedError` e local ao bounded context?
- O payload do erro nao carrega `unknown`, raw provider object ou `Error`?
- Mensagens visiveis estao em pt-BR?
- Nao ha `try/catch` novo fora de tests/scripts?
- Nao ha `Result<..., string | Error | unknown | any>`?
- Nao ha `unwrap()` sem narrowing?
- Results nao cruzam JSON/queue/cache/RPC/workflow sem serialize?
- Jobs usam retry/DLQ/singleton/debounce da plataforma quando aplicavel?
- oRPC nao traduz erro esperado para `ORPCError` dentro do modulo?
- Bulk no cliente nao faz loop de mutacao quando servidor deve ter procedure dedicada?

## Anti-patterns

- Expected failure via throw.
- Misturar throw esperado e `Result` na mesma funcao.
- Retornar string, raw `Error`, `unknown` ou `any` como erro de dominio.
- Criar helper generico que apaga catalog code concreto.
- Criar `errors.ts` compartilhado para tudo.
- Criar repository layer para esconder Drizzle.
- Usar `tap()` para provider/email/DB/queue que pode falhar.
- `void result`.
- `unwrap()` porque "nao deve falhar".
- `JSON.stringify(result)` em Result vivo.
- `try/catch` envolvendo fluxo inteiro.
- `match()` aninhado para sequencia de passos quando `Result.gen()` resolve.
- Retry em erro deterministico.
- Payload bruto de provider em `TaggedError`.
