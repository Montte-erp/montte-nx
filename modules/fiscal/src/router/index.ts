import {
   and,
   asc,
   count,
   desc,
   eq,
   getTableColumns,
   ilike,
   or,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { fiscalSettings, nfeDocuments } from "@core/database/schemas/fiscal";
import { parties } from "@core/database/schemas/relationships";
import { protectedProcedure } from "@core/orpc/server";

const dfeProviderSchema = z.enum(["jacobina-saatri"]);

const updateFiscalSettingsInput = z.object({
   enabled: z.boolean().default(true),
   dfeProvider: dfeProviderSchema.default("jacobina-saatri"),
   dfeUsername: z.string().trim().max(120).optional(),
   dfePassword: z.string().trim().max(500).optional(),
   municipalRegistration: z.string().trim().max(40).optional(),
});

const nfeStatusSchema = z.enum(["received", "authorized", "cancelled"]);
const nfeStatusLabels = {
   authorized: "Autorizada",
   cancelled: "Cancelada",
   received: "Recebida",
} as const;

const listNfeInput = z.object({
   search: z.string().trim().max(160).catch("").default(""),
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(100).catch(20).default(20),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "accessKey",
               "number",
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

type SortRule = z.infer<typeof listNfeInput>["sorting"][number];

const nfeDocumentColumns = getTableColumns(nfeDocuments);

const defaultFiscalSettings = {
   dfeProvider: "jacobina-saatri",
   dfeUsername: null,
   dfePassword: null,
   hasDfePassword: false,
   municipalRegistration: null,
   enabled: false,
} as const;

function mapFiscalSettings(
   row: typeof fiscalSettings.$inferSelect | undefined,
) {
   if (!row) return defaultFiscalSettings;
   return {
      dfeProvider: row.dfeProvider,
      dfeUsername: row.dfeUsername,
      dfePassword: null,
      hasDfePassword: Boolean(row.dfePassword),
      municipalRegistration: row.municipalRegistration,
      enabled: row.enabled,
   };
}

function mapNfe(
   row: typeof nfeDocuments.$inferSelect & { supplierName?: string | null },
) {
   const status = nfeStatusSchema.catch("received").parse(row.status);
   const recipientName = row.supplierName ?? row.recipientName;
   return {
      ...row,
      recipientName,
      supplierName: recipientName,
      status,
      statusLabel: nfeStatusLabels[status],
   };
}

function buildOrderBy(sorting: SortRule[]): SQL[] {
   const rules = sorting.length ? sorting : [{ id: "updatedAt", desc: true }];
   return [
      ...rules.map((sort) => {
         const direction = sort.desc ? desc : asc;
         if (sort.id === "accessKey") return direction(nfeDocuments.accessKey);
         if (sort.id === "number") return direction(nfeDocuments.number);
         if (sort.id === "issuerName")
            return direction(nfeDocuments.issuerName);
         if (sort.id === "recipientName") {
            return direction(nfeDocuments.recipientName);
         }
         if (sort.id === "totalAmountCents") {
            return direction(nfeDocuments.totalAmountCents);
         }
         if (sort.id === "issuedAt") return direction(nfeDocuments.issuedAt);
         if (sort.id === "status") return direction(nfeDocuments.status);
         return direction(nfeDocuments.updatedAt);
      }),
      asc(nfeDocuments.id),
   ];
}

export const getFiscalSettings = protectedProcedure.handler(
   async ({ context }) => {
      const settings = await context.db.query.fiscalSettings.findFirst({
         where: (row, { eq }) => eq(row.teamId, context.teamId),
      });
      return mapFiscalSettings(settings);
   },
);

export const updateFiscalSettings = protectedProcedure
   .input(updateFiscalSettingsInput)
   .handler(async ({ context, input }) => {
      const existing = await context.db.query.fiscalSettings.findFirst({
         where: (row, { eq }) => eq(row.teamId, context.teamId),
      });
      const dfePassword =
         input.dfePassword === undefined
            ? existing?.dfePassword
            : input.dfePassword.trim() || null;
      const values = {
         organizationId: context.organizationId,
         teamId: context.teamId,
         dfeProvider: input.dfeProvider,
         dfeUsername: input.dfeUsername?.trim() || null,
         dfePassword,
         municipalRegistration: input.municipalRegistration?.trim() || null,
         enabled: input.enabled,
      };
      const [settings] = await context.db
         .insert(fiscalSettings)
         .values(values)
         .onConflictDoUpdate({
            target: fiscalSettings.teamId,
            set: { ...values, updatedAt: new Date() },
         })
         .returning();
      return mapFiscalSettings(settings);
   });

export const listNfe = protectedProcedure
   .input(listNfeInput)
   .handler(async ({ context, input }) => {
      const search = input.search.trim();
      const where = and(
         eq(nfeDocuments.teamId, context.teamId),
         eq(parties.role, "supplier"),
         search
            ? or(
                 ilike(nfeDocuments.accessKey, `%${search}%`),
                 ilike(nfeDocuments.number, `%${search}%`),
                 ilike(nfeDocuments.issuerName, `%${search}%`),
                 ilike(nfeDocuments.recipientName, `%${search}%`),
                 ilike(parties.name, `%${search}%`),
              )
            : undefined,
      );
      const [items, totalRows] = await Promise.all([
         context.db
            .select({ ...nfeDocumentColumns, supplierName: parties.name })
            .from(nfeDocuments)
            .innerJoin(parties, eq(nfeDocuments.supplierId, parties.id))
            .where(where)
            .orderBy(...buildOrderBy(input.sorting))
            .limit(input.pageSize)
            .offset((input.page - 1) * input.pageSize),
         context.db
            .select({ total: count() })
            .from(nfeDocuments)
            .innerJoin(parties, eq(nfeDocuments.supplierId, parties.id))
            .where(where),
      ]);
      return {
         items: items.map(mapNfe),
         total: totalRows[0]?.total ?? 0,
         page: input.page,
         pageSize: input.pageSize,
      };
   });
