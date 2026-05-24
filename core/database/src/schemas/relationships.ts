import { sql } from "drizzle-orm";
import {
   index,
   pgSchema,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";

export const relationships = pgSchema("relationships");

export const partyRoleEnum = relationships.enum("party_role", [
   "customer",
   "supplier",
]);

export const partyKindEnum = relationships.enum("party_kind", [
   "person",
   "company",
]);

export const parties = relationships.table(
   "parties",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      role: partyRoleEnum("role").notNull(),
      kind: partyKindEnum("kind").notNull(),
      name: text("name").notNull(),
      documentNumber: text("document_number"),
      email: text("email"),
      phone: text("phone"),
      archivedAt: timestamp("archived_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("parties_team_id_idx").on(table.teamId),
      index("parties_role_idx").on(table.role),
      index("parties_archived_at_idx").on(table.archivedAt),
      uniqueIndex("parties_team_id_role_document_number_uq")
         .on(table.teamId, table.role, table.documentNumber)
         .where(sql`${table.documentNumber} IS NOT NULL`),
   ],
);

export type Party = typeof parties.$inferSelect;
export type NewParty = typeof parties.$inferInsert;
