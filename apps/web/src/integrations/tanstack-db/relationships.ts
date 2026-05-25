import dayjs from "dayjs";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/query-core";
import { createOptimisticAction } from "@tanstack/react-db";
import type { Collection } from "@tanstack/react-db";
import { orpc, type Inputs, type Outputs } from "@/integrations/orpc/client";

export type RelationshipsCollectionRow =
   Outputs["relationships"]["list"]["data"][number];

export type RelationshipRole = RelationshipsCollectionRow["role"];
export type RelationshipKind = RelationshipsCollectionRow["kind"];
export type RelationshipCreateInput = Inputs["relationships"]["create"];
export type RelationshipUpdateInput = Inputs["relationships"]["update"];

type RelationshipsCollectionOptionsParams = {
   queryClient: QueryClient;
   teamId: string;
   role: RelationshipRole;
   archived: boolean;
   search?: string;
};

type RelationshipCreateActionInput = {
   row: RelationshipsCollectionRow;
   input: RelationshipCreateInput;
};

type RelationshipUpdateActionInput = {
   id: string;
   patch: Omit<RelationshipUpdateInput, "id">;
};

type RelationshipIdActionInput = {
   id: string;
};

type RelationshipsCollection = Collection<RelationshipsCollectionRow, string>;

function nullableString(value: unknown) {
   if (typeof value !== "string") return null;
   return value;
}

async function safeRefetchRelationships(collection: RelationshipsCollection) {
   await collection.utils.refetch().catch(() => {});
}

export function buildOptimisticRelationshipRowId() {
   if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
   ) {
      return `__relationship_${crypto.randomUUID()}`;
   }

   return `__relationship_${dayjs().valueOf().toString(36)}`;
}

export function buildOptimisticRelationshipRow({
   id,
   input,
   teamId,
}: {
   id: string;
   input: RelationshipCreateInput;
   teamId: string;
}): RelationshipsCollectionRow {
   const now = dayjs().toDate();
   return {
      id,
      teamId,
      role: input.role,
      kind: input.kind,
      name: input.name,
      documentNumber: nullableString(input.documentNumber),
      email: nullableString(input.email),
      phone: nullableString(input.phone),
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
   };
}

export function relationshipsCollectionOptions({
   queryClient,
   teamId,
   role,
   archived,
   search,
}: RelationshipsCollectionOptionsParams) {
   const input = {
      role,
      archived,
      q: search,
      limit: 250,
      offset: 0,
   };

   return queryCollectionOptions({
      id: [
         "relationships",
         teamId,
         role,
         archived ? "archived" : "active",
         search ?? "",
      ].join(":"),
      queryKey: [
         "relationships",
         teamId,
         role,
         archived ? "archived" : "active",
         search ?? "",
         input.limit,
         input.offset,
      ],
      queryFn: async () => {
         const result = await orpc.relationships.list.call(input);
         return result.data;
      },
      queryClient,
      getKey: (relationship: RelationshipsCollectionRow) => relationship.id,
      syncMode: "on-demand",
      refetchInterval: 5_000,
   });
}

export function createRelationshipAction(collection: RelationshipsCollection) {
   return createOptimisticAction<RelationshipCreateActionInput>({
      onMutate: ({ row }) => {
         collection.insert(row);
      },
      mutationFn: async ({ input }) => {
         const created = await orpc.relationships.create.call(input);
         await safeRefetchRelationships(collection);
         return created;
      },
   });
}

export function updateRelationshipAction(collection: RelationshipsCollection) {
   return createOptimisticAction<RelationshipUpdateActionInput>({
      onMutate: ({ id, patch }) => {
         collection.update(id, (draft) => {
            if (patch.kind !== undefined) draft.kind = patch.kind;
            if (patch.name !== undefined) draft.name = patch.name;
            if (patch.documentNumber !== undefined) {
               draft.documentNumber = nullableString(patch.documentNumber);
            }
            if (patch.email !== undefined) {
               draft.email = nullableString(patch.email);
            }
            if (patch.phone !== undefined) {
               draft.phone = nullableString(patch.phone);
            }
         });
      },
      mutationFn: async ({ id, patch }) => {
         const updated = await orpc.relationships.update.call({ id, ...patch });
         await safeRefetchRelationships(collection);
         return updated;
      },
   });
}

export function deleteRelationshipAction(collection: RelationshipsCollection) {
   return createOptimisticAction<RelationshipIdActionInput>({
      onMutate: ({ id }) => {
         collection.delete(id);
      },
      mutationFn: async ({ id }) => {
         const removed = await orpc.relationships.delete.call({ id });
         await safeRefetchRelationships(collection);
         return removed;
      },
   });
}

export function archiveRelationshipAction(collection: RelationshipsCollection) {
   return createOptimisticAction<RelationshipIdActionInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.archivedAt = dayjs().toDate();
         });
      },
      mutationFn: async ({ id }) => {
         const archived = await orpc.relationships.archive.call({ id });
         await safeRefetchRelationships(collection);
         return archived;
      },
   });
}

export function restoreRelationshipAction(collection: RelationshipsCollection) {
   return createOptimisticAction<RelationshipIdActionInput>({
      onMutate: ({ id }) => {
         collection.update(id, (draft) => {
            draft.archivedAt = null;
         });
      },
      mutationFn: async ({ id }) => {
         const restored = await orpc.relationships.restore.call({ id });
         await safeRefetchRelationships(collection);
         return restored;
      },
   });
}
