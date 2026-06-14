import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   text,
   timestamp,
   unique,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, team } from "@core/database/schemas/auth";
import { fiscalSchema } from "@core/database/schemas/schemas";

export const fiscalDocumentKindValues = ["nfse"] as const;
export type FiscalDocumentKind = (typeof fiscalDocumentKindValues)[number];

export const fiscalEnvironmentValues = ["homologation", "production"] as const;
export type FiscalEnvironment = (typeof fiscalEnvironmentValues)[number];

export const fiscalDocumentStatusValues = [
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
] as const;
export type FiscalDocumentStatus = (typeof fiscalDocumentStatusValues)[number];

export type FiscalDocumentRejection = {
   code: string;
   message: string;
   correctionHint?: string;
};

export type FiscalDocumentArtifact = {
   kind: string;
   mediaType: string;
   base64: string;
};

export const fiscalProviderSecrets = fiscalSchema.table(
   "provider_secrets",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      providerId: text("provider_id").notNull(),
      environment: text("environment").notNull().$type<FiscalEnvironment>(),
      issuerTaxId: text("issuer_tax_id").notNull(),
      municipalRegistration: text("municipal_registration").notNull(),
      usernameCiphertext: text("username_ciphertext").notNull(),
      passwordCiphertext: text("password_ciphertext").notNull(),
      encryptionVersion: text("encryption_version")
         .notNull()
         .default("aes-256-gcm:v1"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      unique("fiscal_provider_secrets_team_provider_env_unique").on(
         table.teamId,
         table.providerId,
         table.environment,
      ),
      index("fiscal_provider_secrets_team_idx").on(table.teamId),
   ],
);

export type FiscalProviderSecret = typeof fiscalProviderSecrets.$inferSelect;
export type NewFiscalProviderSecret = typeof fiscalProviderSecrets.$inferInsert;

export const fiscalDocuments = fiscalSchema.table(
   "documents",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      providerId: text("provider_id").notNull(),
      documentKind: text("document_kind")
         .notNull()
         .$type<FiscalDocumentKind>()
         .default("nfse"),
      environment: text("environment").notNull().$type<FiscalEnvironment>(),
      issuerTaxId: text("issuer_tax_id").notNull(),
      series: text("series").notNull(),
      number: text("number").notNull(),
      status: text("status").notNull().$type<FiscalDocumentStatus>(),
      providerDocumentId: text("provider_document_id"),
      protocol: text("protocol"),
      verificationUrl: text("verification_url"),
      rejections: jsonb("rejections")
         .$type<readonly FiscalDocumentRejection[]>()
         .notNull()
         .default([]),
      artifacts: jsonb("artifacts")
         .$type<readonly FiscalDocumentArtifact[]>()
         .notNull()
         .default([]),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      unique("fiscal_documents_team_provider_ref_unique").on(
         table.teamId,
         table.providerId,
         table.environment,
         table.issuerTaxId,
         table.series,
         table.number,
      ),
      index("fiscal_documents_team_status_idx").on(table.teamId, table.status),
      index("fiscal_documents_team_created_idx").on(
         table.teamId,
         table.createdAt,
      ),
   ],
);

export type FiscalDocument = typeof fiscalDocuments.$inferSelect;
export type NewFiscalDocument = typeof fiscalDocuments.$inferInsert;
