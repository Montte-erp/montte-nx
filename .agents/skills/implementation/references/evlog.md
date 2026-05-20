# Evlog

Use esta referencia quando implementar ou revisar catalogos de erro, logs estruturados, request logging, drains, redaction, PostHog Logs ou observabilidade operacional no Montte.

## Papel do evlog no Montte

`evlog` e o sistema oficial de logging amplo da aplicacao:

- eventos/logs estruturados de web, worker, jobs e modulos;
- catalogos tipados de erro usados por `better-result` e oRPC;
- request logger do Nitro;
- enrichers de request;
- drain para PostHog Logs;
- redaction de campos sensiveis.

OTLP fica reservado para traces/observabilidade de DBOS, TanStack AI e instrumentacoes. Nao adicione um segundo drain OTLP para eventos normais de request/app.

## Quando usar

Use evlog para:

- catalogar falhas esperadas com `defineErrorCatalog`;
- logar jobs `pg-boss`;
- logar operacoes web/server fora de DBOS;
- anexar contexto estruturado a request logs;
- enviar logs amplos para PostHog Logs;
- redigir dados sensiveis em logs.

Nao use evlog para substituir:

- `DBOS.logger` dentro de workflows DBOS;
- spans OTEL/TanStack AI;
- product analytics intencional via PostHog capture;
- audit logs, que ainda nao fazem parte da migracao atual.

## Imports padrao

Catalogos:

```ts
import { defineErrorCatalog } from "evlog";
```

Worker/core logging:

```ts
import { log } from "@core/logging";
```

Request logger no web server:

```ts
import { getRequestLog } from "@/integrations/evlog";
```

Tipos quando necessario:

```ts
import type { RequestLogger } from "@core/logging";
```

Nao reexporte evlog por barrel novo.

## Error catalogs

O catalogo deve morar no bounded context dono da falha:

- router: `modules/<module>/src/router/<name>.ts`;
- middleware de ownership: arquivo do middleware;
- job: arquivo do job;
- workflow: arquivo do workflow;
- provider adapter: arquivo do adapter;
- service local: arquivo que define o contrato da falha.

Evite `errors.ts` module-wide so para centralizar tudo. A unica excecao aceitavel e quando o arquivo ja e o bounded context real e nao um deposito generico.

Padrao atual do repo:

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

Use `RegisteredErrorCatalogs`. Nao use nomes antigos como `ErrorCatalogRegistry`.

## Nome do catalogo

O nome deve ser estavel, especifico e orientado ao dono:

- `classification.router`;
- `classification.tags.router`;
- `classification.workflow.queue`;
- `agents.job.title`;
- `agents.runtime`;
- `cashbook.router.transactions`;
- `inbox.aggregate`;
- `cards.statements.close`.

Evite:

- `app`;
- `common`;
- `database`;
- `internal`;
- `router` sozinho;
- nomes baseados em implementacao temporaria.

Se o arquivo e um router de uma entidade especifica, prefira `<module>.router.<entity>` ou `<module>.<entity>.router`, seguindo o padrao local mais proximo.

## Codes

Codes devem ser verbos ou estados operacionais claros:

- `INVALID_PAYLOAD`;
- `PERMISSION_CHECK_FAILED`;
- `NOT_FOUND`;
- `CONFLICT`;
- `CREATE_FAILED`;
- `UPDATE_FAILED`;
- `DELETE_FAILED`;
- `BULK_ARCHIVE_FAILED`;
- `ENQUEUE_FAILED`;
- `JOB_ID_MISSING`;
- `PROVIDER_REQUEST_FAILED`;
- `WRITE_FAILED`;
- `READ_FAILED`.

Evite codes genericos quando um code especifico ajuda a operar:

- prefira `DUPLICATE_NAME` a `CONFLICT` quando o contrato sabe que e nome duplicado;
- prefira `MESSAGES_LOAD_FAILED` a `LOAD_FAILED` em job de titulo;
- prefira `PROMPT_LOAD_FAILED` a `PROVIDER_FAILED` quando o provider real e PostHog Prompt.

Use codes genericos (`INTERNAL`, `BAD_REQUEST`, `FORBIDDEN`, `NOT_FOUND`) apenas quando o catalogo e de middleware/base router e agrega varias entidades.

## Status HTTP

Use status coerente com a boundary oRPC/UI:

- `400`: payload invalido ou request invalida;
- `401`: autenticacao ausente/invalida;
- `403`: usuario autenticado sem permissao;
- `404`: recurso nao encontrado ou nao pertence ao tenant;
- `409`: conflito de regra de negocio, duplicidade, estado incompatvel;
- `422`: input semanticamente invalido quando `400` nao for preciso o bastante;
- `429`: rate limit;
- `500`: falha interna, DB, provider sem classificacao melhor, enqueue inesperado;
- `503`: provider/infra temporariamente indisponivel.

Nao use `500` para conflito, not-found ou permissao. Esses erros aparecem para usuario e devem renderizar mensagem correta.

## Messages

`message` do catalogo e `message` do `TaggedError` devem ser pt-BR quando podem chegar em toast/UI.

Boas mensagens:

- "Centro de custo nao encontrado."
- "Ja existe um centro de custo com esse nome."
- "Falha ao criar centro de custo."
- "Falha ao enfileirar geracao de titulo."

Evite:

- ingles;
- stack trace;
- texto tecnico de provider;
- detalhes sensiveis;
- mensagem generica demais quando a UI precisa orientar o usuario.

## Tags

Tags devem ajudar busca e triagem:

```ts
tags: ["classification", "tags", "router"]
tags: ["agents", "pg-boss", "title"]
tags: ["cards", "statements", "job"]
```

Use termos pequenos e estaveis:

- modulo;
- entidade;
- tipo de runtime (`router`, `pg-boss`, `workflow`, `provider`);
- provider quando aplicavel.

Nao coloque ids, emails, nomes de usuario, payloads ou valores dinamicos em `tags`.

## TaggedError com evlog

`TaggedError` deve carregar o retorno do catalogo no campo `error`.

```ts
type TagRouterCatalogError =
  | ReturnType<typeof tagRouterErrors.CREATE_FAILED>
  | ReturnType<typeof tagRouterErrors.DUPLICATE_NAME>
  | ReturnType<typeof tagRouterErrors.NOT_FOUND>;

export class TagRouterError extends TaggedError("TagRouterError")<{
  error: TagRouterCatalogError;
  message: string;
  teamId?: string;
  organizationId?: string;
  tagId?: string;
}>() {}
```

O catalogo identifica a classe operacional da falha. O payload do `TaggedError` adiciona contexto pequeno para operar.

Nao inclua:

- `cause: unknown`;
- response inteiro de provider;
- headers;
- cookies;
- token;
- body completo;
- stack trace manual.

## Request logging no web

No web/Nitro, use o request logger do contexto. O helper local e:

```ts
import { getRequestLog } from "@/integrations/evlog";

const log = getRequestLog();
log.set({
  orpc: {
    procedure: "tags.create",
  },
});
log.emit("info", {
  message: "Centro de custo criado.",
  tagId,
});
```

`getRequestLog()` le `useRequest().context.log`. Se o contexto estiver ausente, ele cria um logger fallback com `evlog.contextMissing = true`.

Passe o logger de request para handlers/server code quando o fluxo precisar de contexto da request. Nao adicione Pino, logger standalone de request ou outro middleware paralelo.

## Nitro integration

`apps/web/nitro.config.ts` registra o plugin `evlog/nitro/v3` e injeta `apps/web/src/integrations/evlog`.

O plugin local:

- cria drain para PostHog Logs com `createPostHogDrain({ mode: "logs" })`;
- usa `createDrainPipeline` com batch e retry;
- aplica enrichers de user-agent, geo, request size, trace context e Cloudflare;
- identifica auth via Better Auth com email mascarado;
- exclui `/api/auth/**` e `/api/_evlog/**` da identificacao;
- faz flush no hook `close`.

Nao duplique essa pipeline dentro de rotas ou routers.

## Worker/core logging

`core/logging/src/logger.ts` inicializa evlog para processos como worker:

- `initLogger({ name, level, posthogKey, posthogHost })`;
- PostHog drain em `mode: "logs"`;
- pipeline com batch e retry;
- redaction para authorization, cookies e campos sensiveis de oRPC input;
- pretty em desenvolvimento.

Use `log` exportado por `@core/logging` em jobs/worker que nao estao dentro de DBOS.

Exemplo:

```ts
log.info({
  module: "agents",
  message: "Job de titulo iniciado.",
  jobId,
  threadId,
  teamId,
  organizationId,
});
```

Inclua ids operacionais. Nao inclua conteudo sensivel.

## DBOS vs evlog

Dentro de workflow DBOS, use `DBOS.logger`.

```ts
DBOS.logger.info(`classification workflow started`);
```

Nao troque por `log`/evlog dentro do workflow. Isso perde contexto de workflow/replay.

Fora de DBOS, especialmente em `pg-boss`, use evlog:

- job handler `pg-boss`: `log`;
- web request/server route: request logger;
- worker startup fora de workflow: `log`;
- provider adapter fora de DBOS: `log` se precisar observabilidade.

## pg-boss

Jobs `pg-boss` devem logar com evlog, nao `DBOS.logger`.

Inclua:

- `module`;
- `queue`;
- `jobId`;
- `teamId`;
- `organizationId`;
- entidade principal (`threadId`, `tagId`, `invoiceId`);
- `message` pt-BR ou operacional consistente.

Falhas esperadas do job devem ser `Result.err(new JobError(...))` com catalogo evlog local. Erro de payload invalido e job id ausente sao falhas reais, nao no-op.

## Redaction

Nunca logue:

- `authorization`;
- `cookie`;
- `set-cookie`;
- senha;
- token;
- secret;
- api key;
- magic link;
- refresh token;
- access token;
- payload financeiro sensivel completo;
- raw request/response de provider.

O core ja redige caminhos comuns:

- `headers.authorization`;
- `headers.cookie`;
- `headers.set-cookie`;
- `orpc.input.password`;
- `orpc.input.token`;
- `orpc.input.secret`;
- `orpc.input.apiKey`.

Mesmo com redaction, nao envie dado sensivel por desenho. Redaction e camada de seguranca, nao contrato para despejar payload bruto.

## PostHog Logs

PostHog Logs e o destino oficial para logs amplos.

Use `createPostHogDrain({ mode: "logs" })`.

Nao crie:

- drain OTLP paralelo para eventos normais;
- logger Pino paralelo;
- captura direta PostHog para cada request oRPC;
- heartbeat standalone de logging;
- drain filesystem assinado/audit enquanto a fase de audit nao for reaberta.

Capture direto em PostHog apenas quando for product analytics/identity/group, nao telemetry normal de request.

## oRPC

oRPC deve receber erros typed vindos dos modulos. O modulo nao deve transformar falha esperada em `ORPCError`.

Padrao:

```ts
const result = await doWork(input);

if (Result.isError(result)) {
  throw result.error;
}

return result.value;
```

A configuracao global de oRPC faz o mapeamento de `TaggedError` para `.errors(...)`.

## Anti-patterns

- Catalogo generico `common.errors`.
- `errors.ts` compartilhado por todo modulo sem ser owner real.
- `ErrorCatalogRegistry` em vez de `RegisteredErrorCatalogs`.
- `status: 500` para conflito/not-found/permissao.
- Mensagem em ingles para erro que chega na UI.
- Logar headers/cookies/tokens.
- Logar payload bruto de provider.
- Adicionar Pino/request logger paralelo.
- Usar DBOS.logger em pg-boss.
- Usar evlog dentro de DBOS workflow no lugar de DBOS.logger.
- Duplicar PostHog drains.
- Usar direct PostHog capture para request telemetry normal.
- Criar audit logs antes da fase de audit ser explicitamente reaberta.

## Checklist

- O catalogo mora no arquivo/bounded context dono?
- O nome do catalogo e especifico e estavel?
- `declare module "evlog"` usa `RegisteredErrorCatalogs`?
- Cada code tem `status`, `message` e `tags` uteis?
- Status representa a falha real?
- Mensagens visiveis estao em pt-BR?
- Tags nao tem dados dinamicos/sensiveis?
- `TaggedError` carrega `ReturnType<typeof catalog.CODE>`?
- Payload do erro e pequeno e tipado?
- Logs incluem ids operacionais suficientes?
- Logs nao carregam tokens, cookies, headers sensiveis ou payload bruto?
- pg-boss usa evlog?
- DBOS workflow usa `DBOS.logger`?
- Nao foi criado drain/logger paralelo?
