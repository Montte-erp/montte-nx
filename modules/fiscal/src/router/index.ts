import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import dayjs from "dayjs";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import { fiscalSettings, nfeDocuments } from "@core/database/schemas/fiscal";
import { vaultDocuments } from "@core/database/schemas/vault";
import { protectedProcedure } from "@core/orpc/server";

const fiscalRouterErrors = defineErrorCatalog("fiscal.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna no módulo fiscal.",
      tags: ["fiscal", "nfe"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "fiscal.router": typeof fiscalRouterErrors;
   }
}

type FiscalRouterCatalogError = ReturnType<typeof fiscalRouterErrors.INTERNAL>;

class FiscalRouterError extends TaggedError("FiscalRouterError")<{
   error: FiscalRouterCatalogError;
   message: string;
}>() {}

const nfeStatusSchema = z.enum([
   "received",
   "authorized",
   "cancelled",
   "archived",
]);
type NfeStatus = z.infer<typeof nfeStatusSchema>;
const nfeStatusLabels: Record<NfeStatus, string> = {
   archived: "Arquivada",
   authorized: "Autorizada",
   cancelled: "Cancelada",
   received: "Recebida",
};

const listNfeInput = z.object({
   search: z.string().trim().max(160).catch("").default(""),
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(100).catch(50).default(50),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "accessKey",
               "number",
               "series",
               "issuerName",
               "recipientName",
               "totalAmountCents",
               "issuedAt",
               "status",
               "updatedAt",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3)
      .catch([])
      .default([]),
});

const createNfeInput = z.object({
   accessKey: z.string().trim().min(1).max(44),
   number: z.string().trim().min(1).max(20),
   series: z.string().trim().min(1).max(10),
   issuerName: z.string().trim().min(1).max(180),
   recipientName: z.string().trim().max(180).optional(),
   totalAmountCents: z.number().int().nonnegative().default(0),
   issuedAt: z.string().trim().optional(),
   status: nfeStatusSchema.default("received"),
   fileKey: z.string().trim().max(500).optional(),
   originalFileName: z.string().trim().max(240).optional(),
   mimeType: z.string().trim().max(120).optional(),
   fileSize: z.number().int().nonnegative().optional(),
});

const bulkArchiveNfeInput = z.object({
   ids: z.array(z.string().uuid()).min(1).max(100),
});

const dfeEnvironmentSchema = z.enum(["homologation", "production"]);
const updateFiscalSettingsInput = z.object({
   enabled: z.boolean(),
   dfeEnvironment: dfeEnvironmentSchema,
   dfeApiBaseUrl: z.string().trim().max(500).optional(),
   dfeUsername: z.string().trim().max(120).optional(),
   dfePassword: z.string().trim().max(500).optional(),
   municipalRegistration: z.string().trim().max(40).optional(),
});

const defaultFiscalSettings = {
   dfeProvider: "dfe_kit_jacobina",
   dfeEnvironment: "homologation",
   dfeApiBaseUrl: null,
   dfeUsername: null,
   dfePassword: null,
   hasDfePassword: false,
   municipalRegistration: null,
   enabled: false,
};

type SortRule = z.infer<typeof listNfeInput>["sorting"][number];
const defaultSort: SortRule = { id: "updatedAt", desc: true };

const nfeColumns = {
   id: nfeDocuments.id,
   organizationId: nfeDocuments.organizationId,
   teamId: nfeDocuments.teamId,
   vaultDocumentId: nfeDocuments.vaultDocumentId,
   accessKey: nfeDocuments.accessKey,
   number: nfeDocuments.number,
   series: nfeDocuments.series,
   issuerName: nfeDocuments.issuerName,
   recipientName: nfeDocuments.recipientName,
   totalAmountCents: nfeDocuments.totalAmountCents,
   issuedAt: nfeDocuments.issuedAt,
   status: nfeDocuments.status,
   fileKey: nfeDocuments.fileKey,
   originalFileName: nfeDocuments.originalFileName,
   mimeType: nfeDocuments.mimeType,
   fileSize: nfeDocuments.fileSize,
   createdAt: nfeDocuments.createdAt,
   updatedAt: nfeDocuments.updatedAt,
};

function buildOrderBy(sorting: SortRule[]): SQL[] {
   const rules = sorting.length ? sorting : [defaultSort];
   const orderBy: SQL[] = [];
   for (const sort of rules) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "accessKey":
            orderBy.push(direction(nfeDocuments.accessKey));
            break;
         case "number":
            orderBy.push(direction(nfeDocuments.number));
            break;
         case "series":
            orderBy.push(direction(nfeDocuments.series));
            break;
         case "issuerName":
            orderBy.push(direction(nfeDocuments.issuerName));
            break;
         case "recipientName":
            orderBy.push(direction(nfeDocuments.recipientName));
            break;
         case "totalAmountCents":
            orderBy.push(direction(nfeDocuments.totalAmountCents));
            break;
         case "issuedAt":
            orderBy.push(direction(nfeDocuments.issuedAt));
            break;
         case "status":
            orderBy.push(direction(nfeDocuments.status));
            break;
         case "updatedAt":
            orderBy.push(direction(nfeDocuments.updatedAt));
            break;
      }
   }
   return [...orderBy, asc(nfeDocuments.id)];
}

function mapFiscalSettings(
   row: typeof fiscalSettings.$inferSelect | undefined,
) {
   if (!row) return defaultFiscalSettings;
   return {
      dfeProvider: row.dfeProvider,
      dfeEnvironment: row.dfeEnvironment,
      dfeApiBaseUrl: row.dfeApiBaseUrl,
      dfeUsername: row.dfeUsername,
      dfePassword: null,
      hasDfePassword: Boolean(row.dfePassword),
      municipalRegistration: row.municipalRegistration,
      enabled: row.enabled,
   };
}

function mapNfe(row: typeof nfeDocuments.$inferSelect) {
   const statusResult = nfeStatusSchema.safeParse(row.status);
   const status = statusResult.success ? statusResult.data : "received";
   return {
      ...row,
      status,
      statusLabel: nfeStatusLabels[status],
   };
}

export const getFiscalSettings = protectedProcedure.handler(
   async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.query.fiscalSettings.findFirst({
               where: (row, { eq }) => eq(row.teamId, context.teamId),
            }),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao carregar configurações fiscais.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return mapFiscalSettings(result.value);
   },
);

export const updateFiscalSettings = protectedProcedure
   .input(updateFiscalSettingsInput)
   .handler(async ({ context, input }) => {
      const existingResult = await Result.tryPromise({
         try: () =>
            context.db.query.fiscalSettings.findFirst({
               where: (row, { eq }) => eq(row.teamId, context.teamId),
            }),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao carregar configurações fiscais.",
            }),
      });
      if (Result.isError(existingResult)) throw existingResult.error;

      const dfePassword =
         input.dfePassword === undefined
            ? existingResult.value?.dfePassword
            : input.dfePassword.trim() || null;
      const values = {
         organizationId: context.organizationId,
         teamId: context.teamId,
         dfeProvider: "dfe_kit_jacobina",
         dfeEnvironment: input.dfeEnvironment,
         dfeApiBaseUrl: input.dfeApiBaseUrl?.trim() || null,
         dfeUsername: input.dfeUsername?.trim() || null,
         dfePassword,
         municipalRegistration: input.municipalRegistration?.trim() || null,
         enabled: input.enabled,
      };
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(fiscalSettings)
                  .values(values)
                  .onConflictDoUpdate({
                     target: fiscalSettings.teamId,
                     set: { ...values, updatedAt: dayjs().toDate() },
                  })
                  .returning(),
            ),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao salvar configurações fiscais.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [row] = result.value;
      if (!row)
         throw new FiscalRouterError({
            error: fiscalRouterErrors.INTERNAL(),
            message: "Falha ao salvar configurações fiscais.",
         });
      return mapFiscalSettings(row);
   });

export const listNfe = protectedProcedure
   .input(listNfeInput)
   .handler(async ({ context, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const search = input.search.trim();
      const where = and(
         eq(nfeDocuments.teamId, context.teamId),
         search
            ? or(
                 ilike(nfeDocuments.accessKey, `%${search}%`),
                 ilike(nfeDocuments.number, `%${search}%`),
                 ilike(nfeDocuments.series, `%${search}%`),
                 ilike(nfeDocuments.issuerName, `%${search}%`),
                 ilike(nfeDocuments.recipientName, `%${search}%`),
              )
            : undefined,
      );
      const result = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db
                  .select(nfeColumns)
                  .from(nfeDocuments)
                  .where(where)
                  .orderBy(...buildOrderBy(input.sorting))
                  .limit(input.pageSize)
                  .offset(offset),
               context.db
                  .select({ total: count() })
                  .from(nfeDocuments)
                  .where(where),
            ]),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao listar NF-e.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      const [items, totalRows] = result.value;
      return {
         items: items.map(mapNfe),
         total: totalRows[0]?.total ?? 0,
         page: input.page,
         pageSize: input.pageSize,
      };
   });

export const createNfe = protectedProcedure
   .input(createNfeInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const issuedAt = input.issuedAt
                  ? dayjs(input.issuedAt).toDate()
                  : null;
               const [vaultDocument] = await tx
                  .insert(vaultDocuments)
                  .values({
                     organizationId: context.organizationId,
                     teamId: context.teamId,
                     title: `NF-e ${input.number} / série ${input.series}`,
                     description: input.issuerName,
                     status: input.fileKey ? "stored" : "draft",
                     source: "fiscal",
                     fileKey: input.fileKey,
                     originalFileName: input.originalFileName,
                     mimeType: input.mimeType,
                     fileSize: input.fileSize,
                     uploadedByUserId: context.userId,
                  })
                  .returning({ id: vaultDocuments.id });
               const [created] = await tx
                  .insert(nfeDocuments)
                  .values({
                     organizationId: context.organizationId,
                     teamId: context.teamId,
                     vaultDocumentId: vaultDocument?.id,
                     accessKey: input.accessKey,
                     number: input.number,
                     series: input.series,
                     issuerName: input.issuerName,
                     recipientName: input.recipientName?.trim() || null,
                     totalAmountCents: input.totalAmountCents,
                     issuedAt,
                     status: input.status,
                     fileKey: input.fileKey,
                     originalFileName: input.originalFileName,
                     mimeType: input.mimeType,
                     fileSize: input.fileSize,
                  })
                  .returning();
               return created;
            }),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao salvar NF-e.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value)
         throw new FiscalRouterError({
            error: fiscalRouterErrors.INTERNAL(),
            message: "Falha ao salvar NF-e.",
         });
      return mapNfe(result.value);
   });

export const bulkArchiveNfe = protectedProcedure
   .input(bulkArchiveNfeInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: async () => {
            const archived = await context.db
               .update(nfeDocuments)
               .set({ status: "archived" })
               .where(
                  and(
                     eq(nfeDocuments.teamId, context.teamId),
                     inArray(nfeDocuments.id, input.ids),
                  ),
               )
               .returning({ id: nfeDocuments.id });
            return { archived: archived.length };
         },
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao arquivar NF-e.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });
