# pg-boss

Use pg-boss para jobs operacionais em background consumidos pelo `apps/worker`.

## Fluxo

1. Crie o arquivo do job no modulo dono, por exemplo `modules/<module>/src/jobs/<nome>-job.ts`.
2. Defina nomes de fila validos: alfanumerico, `_`, `-`, `.`, `/`. Use `classification/derive-keywords`, nunca `classification:derive-keywords`.
3. Exporte a fila principal e, quando houver retry com DLQ, a fila de dead letter.
4. Exporte um helper de enqueue que recebe `PgBossClient`, valida o input tipado e retorna `Result`.
5. Exporte um handler que recebe `Job<Input>`, valida `job.data` com Zod e retorna `Result`.
6. Registre filas e handlers no setup do modulo.
7. Adicione o setup do modulo em `apps/worker/src/index.ts`.

## Job

O arquivo do job deve manter junto:

- queue name;
- dead-letter queue quando houver;
- Zod input schema;
- enqueue helper;
- handler;
- evlog catalog local;
- `TaggedError` local.

Nao crie pasta de micro-abstracoes antes de haver complexidade real.

```typescript
export const exampleJobInputSchema = z.object({
   id: z.string().uuid(),
   teamId: z.string().uuid(),
   organizationId: z.string().uuid(),
});

export type ExampleJobInput = z.infer<typeof exampleJobInputSchema>;

const EXAMPLE_QUEUE = "module/example";
const EXAMPLE_DEAD_LETTER_QUEUE = "module/example/dead-letter";

export const exampleDeadLetterQueue = {
   name: EXAMPLE_DEAD_LETTER_QUEUE,
   retryLimit: 0,
   expireInSeconds: 60,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 2_592_000,
   warningQueueSize: 1,
};

export const exampleQueue = {
   name: EXAMPLE_QUEUE,
   policy: "key_strict_fifo",
   retryLimit: 3,
   retryDelay: 5,
   retryBackoff: true,
   retryDelayMax: 300,
   expireInSeconds: 300,
   retentionSeconds: 2_592_000,
   deleteAfterSeconds: 604_800,
   heartbeatSeconds: 30,
   warningQueueSize: 25,
   deadLetter: EXAMPLE_DEAD_LETTER_QUEUE,
};
```

## Enqueue

- Web enfileira via `context.pgBoss`.
- Dentro de uma transacao Drizzle, passe `db: fromDrizzle(tx, sql)` nas `SendOptions`.
- Job id vazio ou ausente e erro.
- Para `key_strict_fifo`, sempre use `singletonKey` estavel.
- Prefira recursos nativos do pg-boss: `retryLimit`, `retryDelay`, `retryBackoff`, `expireInSeconds`, `retentionSeconds`, `deadLetter`, `singletonKey`, `singletonSeconds`, `singletonNextSlot`, `sendDebounced`, `sendThrottled`, `group`.

```typescript
export async function enqueueExampleJob(options: {
   boss: PgBossClient;
   input: ExampleJobInput;
   tx?: DrizzleTransactionLike;
}) {
   const sendOptions: SendOptions = {
      singletonKey: options.input.id,
      retryLimit: exampleQueue.retryLimit,
      retryDelay: exampleQueue.retryDelay,
      retryBackoff: exampleQueue.retryBackoff,
      retryDelayMax: exampleQueue.retryDelayMax,
      expireInSeconds: exampleQueue.expireInSeconds,
      retentionSeconds: exampleQueue.retentionSeconds,
      deleteAfterSeconds: exampleQueue.deleteAfterSeconds,
      heartbeatSeconds: exampleQueue.heartbeatSeconds,
      deadLetter: exampleQueue.deadLetter,
      group: { id: options.input.teamId },
   };

   if (options.tx) sendOptions.db = fromDrizzle(options.tx, sql);

   const jobId = await Result.tryPromise({
      try: () => options.boss.send(exampleQueue.name, options.input, sendOptions),
      catch: () =>
         new ExampleJobError({
            error: exampleJobErrors.ENQUEUE_FAILED(),
            message: "Falha ao enfileirar job.",
         }),
   });

   if (Result.isError(jobId)) return Result.err(jobId.error);
   if (!jobId.value) {
      return Result.err(
         new ExampleJobError({
            error: exampleJobErrors.JOB_ID_MISSING(),
            message: "Pg-boss nao retornou o ID do job.",
         }),
      );
   }

   return Result.ok(jobId.value);
}
```

## Handler

- Handler valida `job.data` antes do trabalho.
- Retorne `Result.ok(...)` ou `Result.err(...)`.
- Nao engula erro: o registro do worker deve transformar `Result.err` em throw para o pg-boss aplicar retry/DLQ.
- Logs de job usam `@core/logging`/evlog, nunca `DBOS.logger`.

```typescript
export async function handleExampleJob(options: {
   db: DatabaseInstance;
   job: Job<ExampleJobInput>;
}) {
   return Result.gen(async function* () {
      const parsedInput = exampleJobInputSchema.safeParse(options.job.data);
      if (!parsedInput.success) {
         return Result.err(
            new ExampleJobError({
               error: exampleJobErrors.INVALID_PAYLOAD({
                  internal: { jobId: options.job.id },
               }),
               message: "Payload invalido para o job.",
            }),
         );
      }

      const input = parsedInput.data;

      log.info({
         module: "module.example-job",
         message: "running",
         jobId: options.job.id,
         teamId: input.teamId,
         organizationId: input.organizationId,
      });

      return Result.ok(undefined);
   });
}
```

## Registro

As filas sao criadas/atualizadas por `core/pg-boss/src/worker.ts` durante o bootstrap do worker. Nao repita `createQueue` nos helpers de enqueue.

```typescript
export const modulePgBossQueues = [exampleDeadLetterQueue, exampleQueue];

export async function registerModulePgBossJobs(options: {
   boss: PgBossClient;
   db: DatabaseInstance;
}) {
   await options.boss.work<ExampleJobInput>(
      exampleQueue.name,
      defaultPgBossWorkOptions,
      async (jobs) => {
         const errors: Error[] = [];
         for (const job of jobs) {
            const result = await handleExampleJob({
               db: options.db,
               job,
            });
            if (Result.isError(result)) errors.push(result.error);
         }
         if (errors.length > 0) throw new AggregateError(errors);
      },
   );
}
```

Depois registre `modulePgBossQueues` e `registerModulePgBossJobs` em `apps/worker/src/index.ts`.

## Validacao

```bash
bun --filter <module> typecheck
bun --filter worker typecheck
bun nx sync:check
git diff --check
```
