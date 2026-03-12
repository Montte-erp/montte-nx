import { sql } from "drizzle-orm";
import { bigint, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "@core/database/schemas/auth";

export const assets = pgTable("assets", {
   id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
   organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
   name: text("name").notNull(),
   size: bigint("size", { mode: "bigint" }).notNull().default(BigInt(0)),
   createdAt: timestamp("created_at").defaultNow().notNull(),
});
