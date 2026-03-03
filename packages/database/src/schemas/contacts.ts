import { relations, sql } from "drizzle-orm";
import {
   index,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { serviceSourceEnum } from "./enums";
import { transactions } from "./transactions";

export const contactTypeEnum = pgEnum("contact_type", [
   "cliente",
   "fornecedor",
   "ambos",
]);

export const contactDocumentTypeEnum = pgEnum("contact_document_type", [
   "cpf",
   "cnpj",
]);

export const contacts = pgTable(
   "contacts",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: contactTypeEnum("type").notNull(),
      email: text("email"),
      phone: text("phone"),
      document: text("document"),
      documentType: contactDocumentTypeEnum("document_type"),
      notes: text("notes"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"), // Asaas customer ID
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contacts_team_id_idx").on(table.teamId),
      uniqueIndex("contacts_team_id_name_unique").on(table.teamId, table.name),
      index("contacts_external_id_idx").on(table.externalId),
   ],
);

export const contactsRelations = relations(contacts, ({ many }) => ({
   transactions: many(transactions),
}));

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactType = (typeof contactTypeEnum.enumValues)[number];
export type ContactDocumentType =
   (typeof contactDocumentTypeEnum.enumValues)[number];
