import { sql } from "drizzle-orm";
import {
   bigint,
   index,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { organization, team } from "./auth";

export const assets = pgTable(
   "assets",
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
      storageKey: text("storage_key").notNull(),
      bucket: text("bucket").notNull(),
      mimeType: text("mime_type").notNull(),
      size: bigint("size", { mode: "number" }).notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
   },
   (table) => [
      index("assets_organization_id_idx").on(table.organizationId),
      index("assets_team_id_idx").on(table.teamId),
   ],
);

export type Asset = typeof assets.$inferSelect;
export type AssetInsert = typeof assets.$inferInsert;

export const AssetInsertSchema = createInsertSchema(assets);
export const AssetSelectSchema = createSelectSchema(assets);
