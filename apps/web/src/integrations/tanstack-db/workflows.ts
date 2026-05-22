import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import dayjs from "dayjs";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

type UnionKeys<T> = T extends unknown ? keyof T : never;
type UnionValue<T, K extends PropertyKey> = T extends unknown
   ? K extends keyof T
      ? T[K]
      : never
   : never;
type MergeUnion<T> = { [K in UnionKeys<T>]: UnionValue<T, K> };

export type WorkflowRow = Outputs["workflows"]["list"][number];
export type WorkflowTemplateRow = MergeUnion<
   Outputs["workflows"]["templates"]["list"][number]
>;
export type WorkflowRunRow = Outputs["workflows"]["runs"]["list"][number];
export type WorkflowCreateFromTemplateInput =
   Inputs["workflows"]["createFromTemplate"];
export type WorkflowUpdateInput = Inputs["workflows"]["update"];
export type WorkflowGraph = WorkflowRow["graph"];
export type WorkflowGraphNode = WorkflowGraph["nodes"][number];
export type WorkflowScheduleNode = Extract<
   WorkflowGraphNode,
   { type: "scheduleTrigger" }
>;
export type WorkflowReportNode = Extract<
   WorkflowGraphNode,
   { type: "createReport" }
>;
export type WorkflowReportType = WorkflowReportNode["data"]["reportType"];
export type WorkflowPeriodKind = WorkflowReportNode["data"]["period"]["kind"];
export type WorkflowStatus = WorkflowRow["status"];
export type WorkflowRunStatus = WorkflowRunRow["status"];

export type WorkflowsCollection = Collection<WorkflowRow, string>;

type WorkflowsCollectionOptionsInput = {
   queryClient: QueryClient;
   teamId: string;
};

type WorkflowRunsCollectionOptionsInput = {
   queryClient: QueryClient;
   workflowId: string;
};

type WorkflowIdInput = {
   id: string;
};

type WorkflowsBulkIdsInput = {
   ids: string[];
};

type WorkflowCreateActionInput = {
   row: WorkflowRow;
   input: WorkflowCreateFromTemplateInput;
};

type WorkflowUpdateActionInput = {
   id: string;
   patch: Omit<WorkflowUpdateInput, "id">;
};

async function safeRefetchWorkflows(collection: WorkflowsCollection) {
   await collection.utils.refetch().catch(() => {});
}

export function buildOptimisticWorkflowRowId(prefix = "__workflow_") {
   if (typeof crypto !== "undefined") {
      if (typeof crypto.randomUUID === "function") {
         return `${prefix}${crypto.randomUUID()}`;
      }

      if (typeof crypto.getRandomValues === "function") {
         const bytes = new Uint8Array(16);
         crypto.getRandomValues(bytes);
         const hex = Array.from(bytes, (byte) =>
            byte.toString(16).padStart(2, "0"),
         ).join("");
         return `${prefix}${hex}`;
      }
   }

   return `${prefix}${dayjs().valueOf().toString(36)}`;
}

export function buildOptimisticWorkflowRow({
   createdBy,
   id,
   input,
   teamId,
   template,
}: {
   createdBy: string;
   id: string;
   input: WorkflowCreateFromTemplateInput;
   teamId: string;
   template: WorkflowTemplateRow;
}): WorkflowRow {
   const now = dayjs().toDate();
   return {
      id,
      teamId,
      templateId: input.templateId,
      name: input.name ?? template.name,
      status: input.templateId === "blank" ? "paused" : "active",
      graph: template.defaultGraph,
      nextRunAt: null,
      createdBy,
      createdAt: now,
      updatedAt: now,
      latestRun: null,
   };
}

export function workflowsCollectionOptions({
   queryClient,
   teamId,
}: WorkflowsCollectionOptionsInput) {
   return queryCollectionOptions({
      id: `workflows:${teamId}`,
      queryKey: ["workflows", teamId],
      queryFn: () => orpc.workflows.list.call(),
      queryClient,
      getKey: (workflow: WorkflowRow) => workflow.id,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}

export function workflowTemplatesCollectionOptions({
   queryClient,
}: {
   queryClient: QueryClient;
}) {
   return queryCollectionOptions({
      id: "workflow-templates",
      queryKey: ["workflow-templates"],
      queryFn: () => orpc.workflows.templates.list.call(),
      queryClient,
      getKey: (template: WorkflowTemplateRow) => template.id,
      syncMode: "on-demand",
   });
}

export function workflowRunsCollectionOptions({
   queryClient,
   workflowId,
}: WorkflowRunsCollectionOptionsInput) {
   return queryCollectionOptions({
      id: `workflow-runs:${workflowId}`,
      queryKey: ["workflow-runs", workflowId],
      queryFn: () =>
         orpc.workflows.runs.list.call({
            workflowId,
            limit: 5,
         }),
      queryClient,
      getKey: (run: WorkflowRunRow) => run.id,
      refetchInterval: 5_000,
      syncMode: "on-demand",
   });
}

export function createWorkflowFromTemplateAction(
   collection: WorkflowsCollection,
) {
   return (input: WorkflowCreateActionInput) => {
      let createdId: string | null = null;
      const create = createOptimisticAction<WorkflowCreateActionInput>({
         onMutate: ({ row }) => {
            collection.insert(row);
         },
         mutationFn: async ({ input: createInput }) => {
            const created =
               await orpc.workflows.createFromTemplate.call(createInput);
            createdId = created.id;
            await safeRefetchWorkflows(collection);
         },
      });
      const transaction = create(input);
      return {
         transaction,
         createdId: transaction.isPersisted.promise.then(
            () => createdId ?? input.row.id,
         ),
      };
   };
}

export function updateWorkflowAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowUpdateActionInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.name !== undefined) draft.name = patch.name;
            if (patch.graph !== undefined) draft.graph = patch.graph;
            draft.updatedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.workflows.update.call({ id, ...patch });
         await safeRefetchWorkflows(collection);
         return updated;
      },
   });
}

export function pauseWorkflowAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowIdInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.status = "paused";
            draft.nextRunAt = null;
            draft.updatedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id }) => {
         const paused = await orpc.workflows.pause.call({ id });
         await safeRefetchWorkflows(collection);
         return paused;
      },
   });
}

export function activateWorkflowAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowIdInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.status = "active";
            draft.updatedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id }) => {
         const activated = await orpc.workflows.activate.call({ id });
         await safeRefetchWorkflows(collection);
         return activated;
      },
   });
}

export function deleteWorkflowAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowIdInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.workflows.remove.call({ id });
         await safeRefetchWorkflows(collection);
         return removed;
      },
   });
}

export function bulkPauseWorkflowsAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowsBulkIdsInput>({
      onMutate: ({ ids }) => {
         ids.forEach((id) => {
            collection.update(id, (draft) => {
               draft.status = "paused";
               draft.nextRunAt = null;
               draft.updatedAt = dayjs().toDate();
            });
         });
      },
      mutationFn: async ({ ids }) => {
         const result = await orpc.workflows.bulkPause.call({ ids });
         await safeRefetchWorkflows(collection);
         return result;
      },
   });
}

export function bulkActivateWorkflowsAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowsBulkIdsInput>({
      onMutate: ({ ids }) => {
         ids.forEach((id) => {
            collection.update(id, (draft) => {
               draft.status = "active";
               draft.updatedAt = dayjs().toDate();
            });
         });
      },
      mutationFn: async ({ ids }) => {
         const result = await orpc.workflows.bulkActivate.call({ ids });
         await safeRefetchWorkflows(collection);
         return result;
      },
   });
}

export function bulkDeleteWorkflowsAction(collection: WorkflowsCollection) {
   return createOptimisticAction<WorkflowsBulkIdsInput>({
      onMutate: ({ ids }) => {
         collection.delete(ids);
      },
      mutationFn: async ({ ids }) => {
         const result = await orpc.workflows.bulkRemove.call({ ids });
         await safeRefetchWorkflows(collection);
         return result;
      },
   });
}
