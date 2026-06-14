import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import {
   vaultDocumentSourceEnum,
   vaultDocumentStatusEnum,
   type VaultDocumentSource,
   type VaultDocumentStatus,
} from "@core/vault/catalog";
import { organization, team } from "@core/database/schemas/auth";
import { vaultSchema } from "@core/database/schemas/schemas";

export { vaultDocumentSourceEnum, vaultDocumentStatusEnum };
export type { VaultDocumentSource, VaultDocumentStatus };

export const vaultFolders = vaultSchema.table(
   "folders",
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
      name: text("name").notNull(),
      systemKey: text("system_key"),
      isDefault: boolean("is_default").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("vault_folders_team_id_idx").on(table.teamId),
      uniqueIndex("vault_folders_team_name_idx").on(table.teamId, table.name),
      uniqueIndex("vault_folders_team_system_key_idx").on(
         table.teamId,
         table.systemKey,
      ),
   ],
);

export const vaultDocuments = vaultSchema.table(
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
      folderId: uuid("folder_id").references(() => vaultFolders.id, {
         onDelete: "set null",
      }),
      title: text("title").notNull(),
      description: text("description"),
      status: text("status")
         .notNull()
         .$type<VaultDocumentStatus>()
         .default("draft"),
      source: text("source")
         .notNull()
         .$type<VaultDocumentSource>()
         .default("manual"),
      fileKey: text("file_key"),
      originalFileName: text("original_file_name"),
      mimeType: text("mime_type"),
      fileSize: integer("file_size"),
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
      index("vault_documents_team_id_idx").on(table.teamId),
      index("vault_documents_folder_id_idx").on(table.folderId),
      index("vault_documents_status_idx").on(table.status),
      index("vault_documents_updated_at_idx").on(table.updatedAt),
   ],
);

export type VaultFolder = typeof vaultFolders.$inferSelect;
export type NewVaultFolder = typeof vaultFolders.$inferInsert;
export type VaultDocument = typeof vaultDocuments.$inferSelect;
export type NewVaultDocument = typeof vaultDocuments.$inferInsert;
