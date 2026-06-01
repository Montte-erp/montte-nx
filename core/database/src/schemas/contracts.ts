import { sql } from "drizzle-orm";
import {
   date,
   index,
   integer,
   jsonb,
   numeric,
   pgSchema,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, team } from "@core/database/schemas/auth";
import { parties } from "@core/database/schemas/relationships";

export const contractsSchema = pgSchema("contracts");

export const processStatusEnum = [
   "pending",
   "running",
   "completed",
   "failed",
] as const;
export type ProcessStatus = (typeof processStatusEnum)[number];

export const ingestionStatusEnum = [
   "uploaded",
   "processing",
   "needs_review",
   "approved",
   "failed",
] as const;
export type IngestionStatus = (typeof ingestionStatusEnum)[number];

export const contractTypeEnum = [
   "coworking_shared_space",
   "coworking_private_room",
   "fiscal_address",
   "legal_mentoring",
   "service",
   "other",
   "unknown",
] as const;
export type ContractType = (typeof contractTypeEnum)[number];

export const contractStatusEnum = [
   "draft",
   "needs_review",
   "active",
   "expired",
   "terminated",
   "cancelled",
   "archived",
] as const;
export type ContractStatus = (typeof contractStatusEnum)[number];

export const signatureStatusEnum = [
   "unknown",
   "unsigned",
   "partially_signed",
   "signed",
] as const;
export type SignatureStatus = (typeof signatureStatusEnum)[number];

export const contractDocuments = contractsSchema.table(
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
      fileKey: text("file_key").notNull(),
      originalFileName: text("original_file_name").notNull(),
      mimeType: text("mime_type").notNull(),
      fileSize: integer("file_size").notNull(),
      pageCount: integer("page_count"),
      ingestionStatus: text("ingestion_status")
         .notNull()
         .$type<IngestionStatus>()
         .default("uploaded"),
      uploadedByUserId: text("uploaded_by_user_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contract_documents_team_id_idx").on(table.teamId),
      index("contract_documents_ingestion_status_idx").on(
         table.ingestionStatus,
      ),
   ],
);

export type ContractDocument = typeof contractDocuments.$inferSelect;
export type NewContractDocument = typeof contractDocuments.$inferInsert;

// Append-only AI output. `data` holds the whole validated extraction
// (parties, terms, financial, obligations, signature, findings, per-field
// confidence + evidence) — shape lives in the Zod schema, not the DB.
export const contractExtractions = contractsSchema.table(
   "extractions",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      documentId: uuid("document_id")
         .notNull()
         .references(() => contractDocuments.id, { onDelete: "cascade" }),
      model: text("model").notNull(),
      promptVersion: text("prompt_version").notNull(),
      status: text("status")
         .notNull()
         .$type<ProcessStatus>()
         .default("pending"),
      confidence: numeric("confidence"),
      data: jsonb("data").$type<Record<string, unknown>>(),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
   },
   (table) => [
      index("contract_extractions_document_id_idx").on(table.documentId),
   ],
);

export type ContractExtraction = typeof contractExtractions.$inferSelect;
export type NewContractExtraction = typeof contractExtractions.$inferInsert;

// Approved operational record. Only the fields the list/filters/alerts query
// in SQL are columns; everything else reads from the approved extraction.
export const contracts = contractsSchema.table(
   "contracts",
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
      relationshipId: uuid("relationship_id").references(() => parties.id, {
         onDelete: "set null",
      }),
      documentId: uuid("document_id").references(() => contractDocuments.id, {
         onDelete: "set null",
      }),
      approvedExtractionId: uuid("approved_extraction_id").references(
         () => contractExtractions.id,
         { onDelete: "set null" },
      ),
      title: text("title").notNull(),
      type: text("type").notNull().$type<ContractType>().default("unknown"),
      status: text("status").notNull().$type<ContractStatus>().default("draft"),
      counterpartyName: text("counterparty_name").notNull(),
      signatureStatus: text("signature_status")
         .notNull()
         .$type<SignatureStatus>()
         .default("unknown"),
      startsAt: date("starts_at"),
      endsAt: date("ends_at"),
      amount: numeric("amount"),
      approvedByUserId: text("approved_by_user_id"),
      approvedAt: timestamp("approved_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contracts_team_id_idx").on(table.teamId),
      index("contracts_status_idx").on(table.status),
      index("contracts_relationship_id_idx").on(table.relationshipId),
   ],
);

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;
