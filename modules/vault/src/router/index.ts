import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import {
   vaultDocuments,
   vaultFolders,
   vaultDocumentSourceEnum,
   vaultDocumentStatusEnum,
} from "@core/database/schemas/vault";
import {
   VAULT_DEFAULT_FOLDER_KEYS,
   vaultDefaultFolders,
   vaultStatusLabels,
   vaultSourceLabels,
} from "@core/vault/catalog";
import { protectedProcedure } from "@core/orpc/server";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const vaultRouterErrors = defineErrorCatalog("vault.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna no Vault.",
      tags: ["vault"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Documento não encontrado no Vault.",
      tags: ["vault"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "vault.router": typeof vaultRouterErrors;
   }
}

type VaultRouterCatalogError =
   | ReturnType<typeof vaultRouterErrors.INTERNAL>
   | ReturnType<typeof vaultRouterErrors.NOT_FOUND>;

class VaultRouterError extends TaggedError("VaultRouterError")<{
   error: VaultRouterCatalogError;
   message: string;
}>() {}

const statusSchema = z.enum(vaultDocumentStatusEnum);
const sourceSchema = z.enum(vaultDocumentSourceEnum);

const listDocumentsInput = z.object({
   search: z.string().trim().max(160).catch("").default(""),
   folderId: z.string().uuid().optional(),
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(100).catch(50).default(50),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "description",
               "title",
               "status",
               "source",
               "updatedAt",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3)
      .catch([])
      .default([]),
});

const createFolderInput = z.object({ name: z.string().trim().min(1).max(80) });
const bulkArchiveDocumentsInput = z.object({
   ids: z.array(z.string().uuid()).min(1).max(100),
});

const createDocumentInput = z.object({
   title: z.string().trim().min(1).max(180),
   description: z.string().trim().max(500).optional(),
   folderId: z.string().uuid().optional(),
   status: statusSchema.default("stored"),
   source: sourceSchema.default("manual"),
   fileKey: z.string().trim().max(500).optional(),
   originalFileName: z.string().trim().max(240).optional(),
   mimeType: z.string().trim().max(120).optional(),
   fileSize: z.number().int().nonnegative().optional(),
});

type SortRule = z.infer<typeof listDocumentsInput>["sorting"][number];
const defaultSort: SortRule = { id: "updatedAt", desc: true };
const deprecatedDefaultFolderKeys = ["fiscal", "contracts", "company"];

type DbClient = ORPCContextWithOrganization["db"];

async function ensureDefaultFolders(
   db: DbClient,
   organizationId: string,
   teamId: string,
) {
   await db
      .delete(vaultFolders)
      .where(
         and(
            eq(vaultFolders.teamId, teamId),
            inArray(vaultFolders.systemKey, deprecatedDefaultFolderKeys),
         ),
      );

   await db
      .insert(vaultFolders)
      .values(
         vaultDefaultFolders.map((folder) => ({
            organizationId,
            teamId,
            name: folder.name,
            systemKey: folder.key,
            isDefault: true,
         })),
      )
      .onConflictDoNothing();
}

async function getAttachmentsFolderId(
   db: DbClient,
   organizationId: string,
   teamId: string,
) {
   await ensureDefaultFolders(db, organizationId, teamId);
   const folder = await db.query.vaultFolders.findFirst({
      where: (row, { and, eq }) =>
         and(
            eq(row.teamId, teamId),
            eq(row.systemKey, VAULT_DEFAULT_FOLDER_KEYS.attachments),
         ),
   });
   return folder?.id;
}

const documentColumns = {
   id: vaultDocuments.id,
   organizationId: vaultDocuments.organizationId,
   teamId: vaultDocuments.teamId,
   folderId: vaultDocuments.folderId,
   title: vaultDocuments.title,
   description: vaultDocuments.description,
   status: vaultDocuments.status,
   source: vaultDocuments.source,
   fileKey: vaultDocuments.fileKey,
   originalFileName: vaultDocuments.originalFileName,
   mimeType: vaultDocuments.mimeType,
   fileSize: vaultDocuments.fileSize,
   uploadedByUserId: vaultDocuments.uploadedByUserId,
   createdAt: vaultDocuments.createdAt,
   updatedAt: vaultDocuments.updatedAt,
};

function buildOrderBy(sorting: SortRule[]): SQL[] {
   const rules = sorting.length ? sorting : [defaultSort];
   const orderBy: SQL[] = [];
   for (const sort of rules) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "description":
            orderBy.push(direction(vaultDocuments.description));
            break;
         case "title":
            orderBy.push(direction(vaultDocuments.title));
            break;
         case "status":
            orderBy.push(direction(vaultDocuments.status));
            break;
         case "source":
            orderBy.push(direction(vaultDocuments.source));
            break;
         case "updatedAt":
            orderBy.push(direction(vaultDocuments.updatedAt));
            break;
      }
   }
   return [...orderBy, asc(vaultDocuments.id)];
}

function mapDocument(
   row: typeof vaultDocuments.$inferSelect & { folderName?: string | null },
) {
   return {
      ...row,
      folderName: row.folderName ?? "Sem pasta",
      statusLabel: vaultStatusLabels[row.status],
      sourceLabel: vaultSourceLabels[row.source],
   };
}

export const listFolders = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: async () => {
         await ensureDefaultFolders(
            context.db,
            context.organizationId,
            context.teamId,
         );
         const folders = await context.db
            .select({
               id: vaultFolders.id,
               name: vaultFolders.name,
               systemKey: vaultFolders.systemKey,
               isDefault: vaultFolders.isDefault,
               total: count(vaultDocuments.id),
            })
            .from(vaultFolders)
            .leftJoin(
               vaultDocuments,
               eq(vaultDocuments.folderId, vaultFolders.id),
            )
            .where(eq(vaultFolders.teamId, context.teamId))
            .groupBy(vaultFolders.id)
            .orderBy(desc(vaultFolders.isDefault), asc(vaultFolders.name));
         const total = folders.reduce((sum, folder) => sum + folder.total, 0);
         return [
            {
               id: "all",
               name: "Todos os documentos",
               systemKey: "all",
               isDefault: true,
               total,
            },
            ...folders,
         ];
      },
      catch: () =>
         new VaultRouterError({
            error: vaultRouterErrors.INTERNAL(),
            message: "Falha ao carregar pastas do Vault.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
});

export const createFolder = protectedProcedure
   .input(createFolderInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [created] = await tx
                  .insert(vaultFolders)
                  .values({
                     organizationId: context.organizationId,
                     teamId: context.teamId,
                     name: input.name,
                  })
                  .returning();
               return created;
            }),
         catch: () =>
            new VaultRouterError({
               error: vaultRouterErrors.INTERNAL(),
               message: "Falha ao criar pasta no Vault.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new VaultRouterError({
            error: vaultRouterErrors.INTERNAL(),
            message: "Falha ao criar pasta no Vault.",
         });
      return result.value;
   });

export const getSummary = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: async () => {
         await ensureDefaultFolders(
            context.db,
            context.organizationId,
            context.teamId,
         );
         const folders = await context.db
            .select({
               id: vaultFolders.id,
               name: vaultFolders.name,
               systemKey: vaultFolders.systemKey,
               isDefault: vaultFolders.isDefault,
               total: count(vaultDocuments.id),
            })
            .from(vaultFolders)
            .leftJoin(
               vaultDocuments,
               eq(vaultDocuments.folderId, vaultFolders.id),
            )
            .where(eq(vaultFolders.teamId, context.teamId))
            .groupBy(vaultFolders.id)
            .orderBy(desc(vaultFolders.isDefault), asc(vaultFolders.name));
         return {
            total: folders.reduce((sum, folder) => sum + folder.total, 0),
            folders,
         };
      },
      catch: () =>
         new VaultRouterError({
            error: vaultRouterErrors.INTERNAL(),
            message: "Falha ao carregar resumo do Vault.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
});

export const listDocuments = protectedProcedure
   .input(listDocumentsInput)
   .handler(async ({ context, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const search = input.search.trim();
      const where = and(
         eq(vaultDocuments.teamId, context.teamId),
         input.folderId
            ? eq(vaultDocuments.folderId, input.folderId)
            : undefined,
         search
            ? or(
                 ilike(vaultDocuments.title, `%${search}%`),
                 ilike(vaultDocuments.description, `%${search}%`),
                 ilike(vaultDocuments.originalFileName, `%${search}%`),
              )
            : undefined,
      );
      const result = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db
                  .select({ ...documentColumns, folderName: vaultFolders.name })
                  .from(vaultDocuments)
                  .leftJoin(
                     vaultFolders,
                     eq(vaultDocuments.folderId, vaultFolders.id),
                  )
                  .where(where)
                  .orderBy(...buildOrderBy(input.sorting))
                  .limit(input.pageSize)
                  .offset(offset),
               context.db
                  .select({ total: count() })
                  .from(vaultDocuments)
                  .where(where),
            ]),
         catch: () =>
            new VaultRouterError({
               error: vaultRouterErrors.INTERNAL(),
               message: "Falha ao listar documentos do Vault.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [items, totalRows] = result.value;
      return {
         items: items.map(mapDocument),
         total: totalRows[0]?.total ?? 0,
         page: input.page,
         pageSize: input.pageSize,
      };
   });

export const bulkArchiveDocuments = protectedProcedure
   .input(bulkArchiveDocumentsInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: async () => {
            const archived = await context.db
               .update(vaultDocuments)
               .set({ status: "archived" })
               .where(
                  and(
                     eq(vaultDocuments.teamId, context.teamId),
                     inArray(vaultDocuments.id, input.ids),
                  ),
               )
               .returning({ id: vaultDocuments.id });
            return { archived: archived.length };
         },
         catch: () =>
            new VaultRouterError({
               error: vaultRouterErrors.INTERNAL(),
               message: "Falha ao arquivar documentos do Vault.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const createDocument = protectedProcedure
   .input(createDocumentInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const folderId =
                  input.folderId ??
                  (await getAttachmentsFolderId(
                     tx,
                     context.organizationId,
                     context.teamId,
                  ));
               const [created] = await tx
                  .insert(vaultDocuments)
                  .values({
                     organizationId: context.organizationId,
                     teamId: context.teamId,
                     folderId,
                     title: input.title,
                     description: input.description?.trim() || null,
                     status: input.status,
                     source: input.source,
                     fileKey: input.fileKey,
                     originalFileName: input.originalFileName,
                     mimeType: input.mimeType,
                     fileSize: input.fileSize,
                     uploadedByUserId: context.userId,
                  })
                  .returning();
               return created;
            }),
         catch: () =>
            new VaultRouterError({
               error: vaultRouterErrors.INTERNAL(),
               message: "Falha ao salvar documento no Vault.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new VaultRouterError({
            error: vaultRouterErrors.INTERNAL(),
            message: "Falha ao salvar documento no Vault.",
         });
      return mapDocument(result.value);
   });
