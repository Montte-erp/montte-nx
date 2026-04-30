import { DBOS, type DBOSClient, WorkflowQueue } from "@dbos-inc/dbos-sdk";

export function createQueue(
   name: string,
   options: { workerConcurrency: number },
) {
   return new WorkflowQueue(`workflow:${name}`, options);
}

/**
 * Idempotent wrapper around DBOS.registerWorkflow. DBOS throws on duplicate
 * registration, which Vite SSR HMR triggers every time a workflow file is
 * re-imported in the web process. We cache the registered workflow on
 * globalThis keyed by function name to survive HMR reloads.
 */
export function registerWorkflowOnce<
   F extends (...args: never[]) => Promise<unknown>,
>(fn: F, options?: { name?: string }): F {
   const name = options?.name ?? fn.name;
   const key = `__dbos_workflow_${name}`;
   const g = globalThis as Record<string, unknown>;
   if (g[key]) return g[key] as F;
   const registered = (options
      ? DBOS.registerWorkflow(fn, options)
      : DBOS.registerWorkflow(fn)) as unknown as F;
   g[key] = registered;
   return registered;
}

export function createQueues(
   names: readonly string[],
   options: { workerConcurrency: number },
) {
   return names.map((name) => createQueue(name, options));
}

export function createEnqueuer<T>(
   workflowName: string,
   queueName: string,
   getWorkflowId?: (input: T) => string,
) {
   return (client: DBOSClient, input: T, options?: { delaySeconds?: number }) =>
      client.enqueue(
         {
            workflowName,
            queueName: `workflow:${queueName}`,
            ...(getWorkflowId && { workflowID: getWorkflowId(input) }),
            ...(options?.delaySeconds !== undefined && {
               enqueueOptions: { delaySeconds: options.delaySeconds },
            }),
         },
         input,
      );
}
