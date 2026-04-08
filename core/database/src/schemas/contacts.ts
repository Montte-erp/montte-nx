import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { crmSchema } from "@core/database/schemas/crm-schema";
export const serviceSourceEnum = crmSchema.enum("service_source", [
   "manual",
   "asaas",
]);
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];

export const contactTypeEnum = crmSchema.enum("contact_type", [
   "cliente",
   "fornecedor",
   "ambos",
]);

export const contactDocumentTypeEnum = crmSchema.enum("contact_document_type", [
   "cpf",
   "cnpj",
]);

export const contacts = crmSchema.table(
   "contacts",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      type: contactTypeEnum("type").notNull(),
      email: text("email"),
      phone: text("phone"),
      document: text("document"),
      documentType: contactDocumentTypeEnum("document_type"),
      notes: text("notes"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"),
      isArchived: boolean("is_archived").notNull().default(false),
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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactType = (typeof contactTypeEnum.enumValues)[number];
export type ContactDocumentType =
   (typeof contactDocumentTypeEnum.enumValues)[number];

const baseContactSchema = createInsertSchema(contacts).pick({
   name: true,
   type: true,
   email: true,
   phone: true,
   document: true,
   documentType: true,
   notes: true,
});

export const createContactSchema = baseContactSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   type: z.enum(["cliente", "fornecedor", "ambos"] as const),
   email: z.string().email("Email inválido.").nullable().optional(),
   phone: z
      .string()
      .max(20, "Telefone deve ter no máximo 20 caracteres.")
      .nullable()
      .optional(),
   document: z
      .string()
      .max(20, "Documento deve ter no máximo 20 caracteres.")
      .nullable()
      .optional(),
   documentType: z.enum(["cpf", "cnpj"]).nullable().optional(),
   notes: z
      .string()
      .max(500, "Observações devem ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
});

export const updateContactSchema = createContactSchema.partial();

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
