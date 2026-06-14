import { desc } from "drizzle-orm";
import { Result, TaggedError } from "better-result";
import { defineErrorCatalog } from "evlog";
import { z } from "zod";
import { env } from "@core/environment/web";
import { protectedProcedure } from "@core/orpc/server";
import { fiscalDocuments } from "@core/database/schemas/fiscal";
import {
   loadJacobinaSaatriSecret,
   saveJacobinaSaatriSecret,
} from "@modules/fiscal/services/fiscal-vault";
import { issueJacobinaNfse as issueJacobinaNfseService } from "@modules/fiscal/services/jacobina-saatri";

const fiscalRouterErrors = defineErrorCatalog("fiscal.router", {
   INTERNAL: {
      status: 500,
      message: "Falha interna em fiscal.",
      tags: ["fiscal"],
   },
});

declare module "evlog" {
   interface RegisteredErrorCatalogs {
      "fiscal.router": typeof fiscalRouterErrors;
   }
}

class FiscalRouterError extends TaggedError("FiscalRouterError")<{
   error: ReturnType<typeof fiscalRouterErrors.INTERNAL>;
   message: string;
}>() {}

const brazilianStateSchema = z.enum([
   "AC",
   "AL",
   "AP",
   "AM",
   "BA",
   "CE",
   "DF",
   "ES",
   "GO",
   "MA",
   "MT",
   "MS",
   "MG",
   "PA",
   "PB",
   "PR",
   "PE",
   "PI",
   "RJ",
   "RN",
   "RS",
   "RO",
   "RR",
   "SC",
   "SP",
   "SE",
   "TO",
]);

const addressSchema = z.object({
   street: z.string().trim().min(1),
   number: z.string().trim().min(1),
   complement: z.string().trim().optional(),
   district: z.string().trim().min(1),
   cityCode: z.string().trim().min(7).max(7),
   city: z.string().trim().min(1),
   state: brazilianStateSchema,
   postalCode: z.string().trim().min(8).max(8),
   countryCode: z.string().trim().default("1058"),
});

const taxPartySchema = z.object({
   legalName: z.string().trim().min(1),
   tradeName: z.string().trim().optional(),
   cnpj: z.string().trim().min(14).max(14).optional(),
   cpf: z.string().trim().min(11).max(11).optional(),
   municipalRegistration: z.string().trim().optional(),
   stateRegistration: z.string().trim().optional(),
   email: z.email().optional(),
   phone: z.string().trim().optional(),
   address: addressSchema,
});

const serviceSchema = z.object({
   description: z.string().trim().min(1),
   serviceListCode: z.string().trim().min(1),
   municipalTaxCode: z.string().trim().optional(),
   nbsCode: z.string().trim().optional(),
   amount: z
      .string()
      .trim()
      .regex(/^\d+\.\d{2}$/),
   taxRate: z.string().trim().optional(),
   taxable: z.boolean().default(true),
});

const configureJacobinaSaatriInput = z.object({
   environment: z.enum(["homologation", "production"]).default("homologation"),
   issuerTaxId: z.string().trim().min(14).max(14),
   municipalRegistration: z.string().trim().min(1),
   username: z.string().trim().min(1),
   password: z.string().min(1),
});

const issueJacobinaNfseInput = z.object({
   environment: z.enum(["homologation", "production"]).default("homologation"),
   series: z.string().trim().min(1),
   number: z.string().trim().min(1),
   issuedAt: z.iso.datetime(),
   issuer: taxPartySchema.omit({ cnpj: true, municipalRegistration: true }),
   customer: taxPartySchema,
   services: z.array(serviceSchema).min(1),
});

const listDocumentsInput = z
   .object({
      environment: z.enum(["homologation", "production"]).optional(),
      status: z
         .enum([
            "draft",
            "queued",
            "sending",
            "accepted_pending_authorization",
            "authorized",
            "rejected",
            "cancellation_queued",
            "cancelled",
            "technical_error_retryable",
            "technical_error_terminal",
         ])
         .optional(),
      limit: z.number().int().min(1).max(50).default(20),
   })
   .optional();

const vaultKey = {
   value: env.FISCAL_VAULT_ENCRYPTION_KEY,
};

export const listDocuments = protectedProcedure
   .input(listDocumentsInput)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.query.fiscalDocuments.findMany({
               where: (fields, { and, eq }) => {
                  const conditions = [eq(fields.teamId, context.teamId)];
                  if (input?.environment) {
                     conditions.push(eq(fields.environment, input.environment));
                  }
                  if (input?.status) {
                     conditions.push(eq(fields.status, input.status));
                  }
                  return and(...conditions);
               },
               orderBy: [desc(fiscalDocuments.createdAt)],
               limit: input?.limit ?? 20,
               columns: {
                  id: true,
                  documentKind: true,
                  environment: true,
                  issuerTaxId: true,
                  series: true,
                  number: true,
                  status: true,
                  providerDocumentId: true,
                  protocol: true,
                  verificationUrl: true,
                  rejections: true,
                  createdAt: true,
                  updatedAt: true,
               },
            }),
         catch: () =>
            new FiscalRouterError({
               error: fiscalRouterErrors.INTERNAL(),
               message: "Falha ao listar documentos fiscais.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const configureJacobinaSaatri = protectedProcedure
   .input(configureJacobinaSaatriInput)
   .handler(async ({ context, input }) => {
      const result = await saveJacobinaSaatriSecret(context.db, vaultKey, {
         organizationId: context.organizationId,
         teamId: context.teamId,
         environment: input.environment,
         issuerTaxId: input.issuerTaxId,
         municipalRegistration: input.municipalRegistration,
         username: input.username,
         password: input.password,
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const issueJacobinaNfse = protectedProcedure
   .input(issueJacobinaNfseInput)
   .handler(async ({ context, input }) => {
      const secret = await loadJacobinaSaatriSecret(
         context.db,
         vaultKey,
         context.teamId,
      );
      if (Result.isError(secret)) throw secret.error;

      const result = await issueJacobinaNfseService({
         db: context.db,
         organizationId: context.organizationId,
         teamId: context.teamId,
         secret: secret.value,
         input,
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const health = protectedProcedure.handler(() => {
   const result = Result.ok({
      providerId: "jacobina-saatri",
      documentKind: "nfse",
      status: "unsupported-production-pending-homologation",
      notes: [
         "Suporte mínimo somente para NFS-e Jacobina/BA via SAATRI GerarNfse.",
         "NFe modelo 55 e NFC-e permanecem fora de escopo.",
         "Cancelamento, substituição e consultas ainda pendem homologação.",
      ],
   });
   if (Result.isError(result)) {
      throw new FiscalRouterError({
         error: fiscalRouterErrors.INTERNAL(),
         message: "Falha ao consultar status fiscal.",
      });
   }
   return result.value;
});
