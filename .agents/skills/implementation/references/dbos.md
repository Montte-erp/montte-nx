# DBOS

Use DBOS para workflows duraveis em `apps/worker`, nunca no processo web. Esta referencia segue a skill oficial `dbos-typescript` como base e aplica as restricoes do Montte por cima.

## Fonte base

Use como referencia primaria a skill oficial:

- `dbos-inc/agent-skills/dbos-typescript`
- Docs: `https://docs.dbos.dev/`
- Repo: `https://github.com/dbos-inc/dbos-transact-ts`

Prioridade das regras:

1. Lifecycle/configuracao: critico.
2. Workflow/determinismo: critico.
3. Steps/transacoes: alto.
4. Queues/concurrency: alto.
5. Comunicacao/eventos/mensagens/streams: medio.
6. Patterns/idempotencia/scheduling/sleep: medio.
7. Testes/clientes/versionamento: conforme necessidade.

## Quando usar

Use DBOS para:

- billing, ledger, entitlement e invoice closing;
- workflows multi-step;
- transacoes DBOS;
- self-rescheduling deterministico;
- casos onde replay e observabilidade fazem parte da corretude.

Use pg-boss, nao DBOS, para jobs operacionais simples.

## Lifecycle

Uma aplicacao DBOS precisa configurar e lancar o runtime antes de executar workflows:

```typescript
DBOS.setConfig({
   name: "montte-worker",
   systemDatabaseUrl: env.DBOS_SYSTEM_DATABASE_URL,
});
await DBOS.launch();
```

No Montte, isso acontece em `apps/worker`. O web process nunca deve chamar `DBOS.launch()` nem executar consumers DBOS.

## Estrutura Montte

- Web enfileira via `context.workflowClient` (`DBOSClient`).
- Worker inicializa workflows em `apps/worker`.
- Cada modulo com workflows tem `setup<Module>Workflows(deps)`.
- Cada modulo usa seu proprio `DrizzleDataSource<DatabaseInstance>`.
- Dentro de steps/transacoes, use `<module>DataSource.runTransaction(...)`.
- Workflow inputs carregam `teamId` e `organizationId`.

## Workflow

- Workflows precisam ser deterministicos.
- Operacoes complexas, I/O, chamadas externas, leitura de tempo, aleatoriedade e acesso a servicos ficam dentro de `DBOS.runStep`.
- Nao chame, inicie ou enfileire workflows de dentro de steps.
- Nao use threads, timers soltos ou concorrencia sem controle para iniciar workflows; use `DBOS.startWorkflow` ou queues.
- Nao modifique variaveis globais a partir de workflows ou steps.
- `DBOS.logger` dentro de workflows; nao use logger generico ali.

## Steps e transacoes

- Qualquer funcao que acesse servico externo ou faca operacao nao deterministica deve rodar como step nomeado.
- Steps devem ter nomes estaveis.
- Transacoes DBOS usam o `DrizzleDataSource` do modulo:

```typescript
await moduleDataSource.runTransaction(async () => {
   const tx = moduleDataSource.client;
   // queries do modulo
}, { name: "nome-estavel" });
```

- Nao use `db` global dentro de workflows quando a operacao pertence ao contexto DBOS.
- Nao use casts para recuperar o tipo do client; o generic do `DrizzleDataSource<DatabaseInstance>` deve carregar o tipo.

## Queues e scheduling

- Use queues DBOS para controlar concorrencia de workflows duraveis.
- Para espera longa, prefira `enqueueOptions.delaySeconds` em enqueue/self-reschedule.
- Evite `DBOS.sleepms` para waits longos porque pode segurar slot.
- `@DBOS.scheduled` fica para cron fixo.
- Self-reschedule: re-check status em tx, faz trabalho, calcula proxima wake em step, chama `DBOS.startWorkflow` com `workflowID` deterministico.

## Startup

Ordem esperada no worker:

1. `initOtel()`.
2. `setup<Module>Workflows(deps)`.
3. `DBOS.setConfig`.
4. `DBOS.launch()`.
5. Start pg-boss consumers separadamente.

`setup<Module>Workflows` deve inicializar schema DBOS, contexto, queues e imports side-effect dos workflow files.

## DBOSClient

Use `DBOSClient` apenas para aplicacoes externas ao runtime DBOS, como o web app enfileirando workflows pelo `context.workflowClient`. O cliente nao substitui o worker: o workflow so roda depois de registrado no worker e de `DBOS.launch()`.

## Testes

Mocke `@dbos-inc/dbos-sdk` com helpers existentes em `@core/dbos/testing/mock-dbos` quando aplicavel. `registerWorkflow` deve retornar a propria funcao nos mocks. Use pglite-backed `setupTestDb()` para asserts de DB.
