import { sql } from "drizzle-orm";
import {
   boolean,
   integer,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, team } from "@core/database/schemas/auth";
import { vaultDocuments } from "@core/database/schemas/vault";
import { fiscalSchema } from "@core/database/schemas/schemas";

export const fiscalSettings = fiscalSchema.table(
   "settings",
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
      dfeProvider: text("dfe_provider").notNull().default("dfe_kit_jacobina"),
      dfeEnvironment: text("dfe_environment").notNull().default("homologation"),
      dfeApiBaseUrl: text("dfe_api_base_url"),
      dfeUsername: text("dfe_username"),
      dfePassword: text("dfe_password"),
      municipalRegistration: text("municipal_registration"),
      enabled: boolean("enabled").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [uniqueIndex("fiscal_settings_team_id_idx").on(table.teamId)],
);

export const nfeDocuments = fiscalSchema.table(
   "nfe_documents",
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
      vaultDocumentId: uuid("vault_document_id").references(
         () => vaultDocuments.id,
         { onDelete: "set null" },
      ),
      accessKey: text("access_key").notNull(),
      number: text("number").notNull(),
      series: text("series").notNull(),
      issuerName: text("issuer_name").notNull(),
      recipientName: text("recipient_name"),
      totalAmountCents: integer("total_amount_cents").notNull().default(0),
      issuedAt: timestamp("issued_at", { withTimezone: true }),
      status: text("status").notNull().default("received"),
      fileKey: text("file_key"),
      originalFileName: text("original_file_name"),
      mimeType: text("mime_type"),
      fileSize: integer("file_size"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      uniqueIndex("nfe_documents_team_access_key_idx").on(
         table.teamId,
         table.accessKey,
      ),
      uniqueIndex("nfe_documents_vault_document_id_idx").on(
         table.vaultDocumentId,
      ),
   ],
);

export type FiscalSettings = typeof fiscalSettings.$inferSelect;
export type NewFiscalSettings = typeof fiscalSettings.$inferInsert;
export type NfeDocument = typeof nfeDocuments.$inferSelect;
export type NewNfeDocument = typeof nfeDocuments.$inferInsert;
