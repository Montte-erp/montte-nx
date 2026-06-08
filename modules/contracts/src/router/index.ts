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
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import {
   contractDocuments,
   contractExtractions,
   contracts,
   contractStatusEnum,
   contractTypeEnum,
   ingestionStatusEnum,
   signatureStatusEnum,
} from "@core/database/schemas/contracts";
import { protectedProcedure } from "@core/orpc/server";

const contractsRouterErrors = defineErrorCatalog("contracts.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna em contratos.",
      tags: ["contracts"],
   },
   NOT_FOUND: {
      status: 404,
      message: "Contrato não encontrado.",
      tags: ["contracts"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "contracts.router": typeof contractsRouterErrors;
   }
}

type ContractsRouterCatalogError =
   | ReturnType<typeof contractsRouterErrors.INTERNAL>
   | ReturnType<typeof contractsRouterErrors.NOT_FOUND>;

class ContractsRouterError extends TaggedError("ContractsRouterError")<{
   error: ContractsRouterCatalogError;
   message: string;
}>() {}

const idInput = z.object({ id: z.string().uuid() });

const paginationInput = z.object({
   page: z.number().int().positive().catch(1).default(1),
   pageSize: z.number().int().positive().max(100).catch(20).default(20),
});

const documentListInput = paginationInput.extend({
   search: z.string().trim().max(160).optional(),
   status: z.enum(ingestionStatusEnum).optional(),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "createdAt",
               "updatedAt",
               "originalFileName",
               "status",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3)
      .optional(),
});

const contractListInput = paginationInput.extend({
   search: z.string().trim().max(160).optional(),
   status: z.enum(contractStatusEnum).optional(),
   type: z.enum(contractTypeEnum).optional(),
   signatureStatus: z.enum(signatureStatusEnum).optional(),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "title",
               "counterpartyName",
               "type",
               "status",
               "signatureStatus",
               "startsAt",
               "endsAt",
               "amount",
               "updatedAt",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3)
      .optional(),
});

type DocumentSortRule = NonNullable<
   z.infer<typeof documentListInput>["sorting"]
>[number];
type ContractSortRule = NonNullable<
   z.infer<typeof contractListInput>["sorting"]
>[number];

const defaultDocumentSort: DocumentSortRule = { id: "updatedAt", desc: true };
const defaultContractSort: ContractSortRule = { id: "updatedAt", desc: true };

const documentListColumns = {
   id: contractDocuments.id,
   organizationId: contractDocuments.organizationId,
   teamId: contractDocuments.teamId,
   originalFileName: contractDocuments.originalFileName,
   mimeType: contractDocuments.mimeType,
   fileSize: contractDocuments.fileSize,
   pageCount: contractDocuments.pageCount,
   ingestionStatus: contractDocuments.ingestionStatus,
   uploadedByUserId: contractDocuments.uploadedByUserId,
   createdAt: contractDocuments.createdAt,
   updatedAt: contractDocuments.updatedAt,
};

const contractListColumns = {
   id: contracts.id,
   organizationId: contracts.organizationId,
   teamId: contracts.teamId,
   relationshipId: contracts.relationshipId,
   documentId: contracts.documentId,
   approvedExtractionId: contracts.approvedExtractionId,
   title: contracts.title,
   type: contracts.type,
   status: contracts.status,
   counterpartyName: contracts.counterpartyName,
   signatureStatus: contracts.signatureStatus,
   startsAt: contracts.startsAt,
   endsAt: contracts.endsAt,
   amount: contracts.amount,
   approvedByUserId: contracts.approvedByUserId,
   approvedAt: contracts.approvedAt,
   createdAt: contracts.createdAt,
   updatedAt: contracts.updatedAt,
};

function buildDocumentOrderBy(sorting: DocumentSortRule[] | undefined): SQL[] {
   const rules = sorting?.length ? sorting : [defaultDocumentSort];
   const orderBy: SQL[] = [];

   for (const sort of rules) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "createdAt":
            orderBy.push(direction(contractDocuments.createdAt));
            break;
         case "updatedAt":
            orderBy.push(direction(contractDocuments.updatedAt));
            break;
         case "originalFileName":
            orderBy.push(direction(contractDocuments.originalFileName));
            break;
         case "status":
            orderBy.push(direction(contractDocuments.ingestionStatus));
            break;
      }
   }

   return [...orderBy, asc(contractDocuments.id)];
}

function buildContractOrderBy(sorting: ContractSortRule[] | undefined): SQL[] {
   const rules = sorting?.length ? sorting : [defaultContractSort];
   const orderBy: SQL[] = [];

   for (const sort of rules) {
      const direction = sort.desc ? desc : asc;
      switch (sort.id) {
         case "title":
            orderBy.push(direction(contracts.title));
            break;
         case "counterpartyName":
            orderBy.push(direction(contracts.counterpartyName));
            break;
         case "type":
            orderBy.push(direction(contracts.type));
            break;
         case "status":
            orderBy.push(direction(contracts.status));
            break;
         case "signatureStatus":
            orderBy.push(direction(contracts.signatureStatus));
            break;
         case "startsAt":
            orderBy.push(direction(contracts.startsAt));
            break;
         case "endsAt":
            orderBy.push(direction(contracts.endsAt));
            break;
         case "amount":
            orderBy.push(direction(contracts.amount));
            break;
         case "updatedAt":
            orderBy.push(direction(contracts.updatedAt));
            break;
      }
   }

   return [...orderBy, asc(contracts.id)];
}

export const listDocuments = protectedProcedure
   .input(documentListInput)
   .handler(async ({ context, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const search = input.search?.trim();
      const where = and(
         eq(contractDocuments.teamId, context.teamId),
         input.status
            ? eq(contractDocuments.ingestionStatus, input.status)
            : undefined,
         search
            ? ilike(contractDocuments.originalFileName, `%${search}%`)
            : undefined,
      );

      const result = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db
                  .select(documentListColumns)
                  .from(contractDocuments)
                  .where(where)
                  .orderBy(...buildDocumentOrderBy(input.sorting))
                  .limit(input.pageSize)
                  .offset(offset),
               context.db
                  .select({ total: count() })
                  .from(contractDocuments)
                  .where(where),
            ]),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao listar documentos de contrato.",
            }),
      });
      if (Result.isError(result)) throw result.error;

      const [items, totalRows] = result.value;
      const total = totalRows[0]?.total ?? 0;

      return { items, total, page: input.page, pageSize: input.pageSize };
   });

export const getDocument = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.query.contractDocuments.findFirst({
               where: (f, { and, eq }) =>
                  and(eq(f.id, input.id), eq(f.teamId, context.teamId)),
               with: {
                  extractions: {
                     orderBy: (f, { desc }) => [desc(f.createdAt)],
                     limit: 10,
                  },
                  contracts: {
                     where: (f, { eq }) => eq(f.teamId, context.teamId),
                     orderBy: (f, { desc }) => [desc(f.updatedAt)],
                     limit: 10,
                  },
               },
            }),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao buscar documento de contrato.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value) {
         throw new ContractsRouterError({
            error: contractsRouterErrors.NOT_FOUND(),
            message: "Documento de contrato não encontrado.",
         });
      }

      return result.value;
   });

export const listContracts = protectedProcedure
   .input(contractListInput)
   .handler(async ({ context, input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const search = input.search?.trim();
      const where = and(
         eq(contracts.teamId, context.teamId),
         input.status ? eq(contracts.status, input.status) : undefined,
         input.type ? eq(contracts.type, input.type) : undefined,
         input.signatureStatus
            ? eq(contracts.signatureStatus, input.signatureStatus)
            : undefined,
         search
            ? or(
                 ilike(contracts.title, `%${search}%`),
                 ilike(contracts.counterpartyName, `%${search}%`),
              )
            : undefined,
      );

      const result = await Result.tryPromise({
         try: () =>
            Promise.all([
               context.db
                  .select(contractListColumns)
                  .from(contracts)
                  .where(where)
                  .orderBy(...buildContractOrderBy(input.sorting))
                  .limit(input.pageSize)
                  .offset(offset),
               context.db
                  .select({ total: count() })
                  .from(contracts)
                  .where(where),
            ]),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao listar contratos.",
            }),
      });
      if (Result.isError(result)) throw result.error;

      const [items, totalRows] = result.value;
      const total = totalRows[0]?.total ?? 0;

      return { items, total, page: input.page, pageSize: input.pageSize };
   });

export const getContract = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const contractResult = await Result.tryPromise({
         try: () =>
            context.db.query.contracts.findFirst({
               where: (f, { and, eq }) =>
                  and(eq(f.id, input.id), eq(f.teamId, context.teamId)),
            }),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao buscar contrato.",
            }),
      });
      if (Result.isError(contractResult)) throw contractResult.error;
      if (!contractResult.value) {
         throw new ContractsRouterError({
            error: contractsRouterErrors.NOT_FOUND(),
            message: "Contrato não encontrado.",
         });
      }

      const contract = contractResult.value;
      const documentId = contract.documentId;
      const approvedExtractionId = contract.approvedExtractionId;
      const relationResult = await Result.tryPromise({
         try: () =>
            Promise.all([
               documentId
                  ? context.db.query.contractDocuments.findFirst({
                       where: (f, { and, eq }) =>
                          and(
                             eq(f.id, documentId),
                             eq(f.teamId, context.teamId),
                          ),
                    })
                  : Promise.resolve(null),
               approvedExtractionId
                  ? context.db
                       .select(getTableColumns(contractExtractions))
                       .from(contractExtractions)
                       .innerJoin(
                          contractDocuments,
                          eq(
                             contractDocuments.id,
                             contractExtractions.documentId,
                          ),
                       )
                       .where(
                          and(
                             eq(contractExtractions.id, approvedExtractionId),
                             eq(contractDocuments.teamId, context.teamId),
                          ),
                       )
                       .limit(1)
                  : Promise.resolve([]),
            ]),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao buscar vínculos do contrato.",
            }),
      });
      if (Result.isError(relationResult)) throw relationResult.error;

      const [document, extractionRows] = relationResult.value;

      return {
         ...contract,
         document: document ?? null,
         approvedExtraction: extractionRows[0] ?? null,
      };
   });

export const getExtraction = protectedProcedure
   .input(idInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db
               .select(getTableColumns(contractExtractions))
               .from(contractExtractions)
               .innerJoin(
                  contractDocuments,
                  eq(contractDocuments.id, contractExtractions.documentId),
               )
               .where(
                  and(
                     eq(contractExtractions.id, input.id),
                     eq(contractDocuments.teamId, context.teamId),
                  ),
               )
               .limit(1),
         catch: () =>
            new ContractsRouterError({
               error: contractsRouterErrors.INTERNAL(),
               message: "Falha ao buscar extração de contrato.",
            }),
      });
      if (Result.isError(result)) throw result.error;

      const extraction = result.value[0];
      if (!extraction) {
         throw new ContractsRouterError({
            error: contractsRouterErrors.NOT_FOUND(),
            message: "Extração de contrato não encontrada.",
         });
      }

      return extraction;
   });
