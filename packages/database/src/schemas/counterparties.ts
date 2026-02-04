import { relations, sql } from "drizzle-orm";
import {
   boolean,
   decimal,
   index,
   integer,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { bankAccount } from "./bank-accounts";
import { bill } from "./bills";
import { inventoryItemCounterparty, stockMovement } from "./inventory";

// Enums for counterparty
export const documentTypeEnum = pgEnum("document_type", [
   "cpf",
   "cnpj",
   "foreign",
]);

export const taxRegimeEnum = pgEnum("tax_regime", [
   "simples",
   "lucro_presumido",
   "lucro_real",
   "mei",
]);

export const counterparty = pgTable(
   "counterparty",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),

      // Basic Info
      name: text("name").notNull(),
      tradeName: text("trade_name"),
      legalName: text("legal_name"),
      type: text("type").notNull(), // "client" | "supplier" | "both"

      // Document Info
      documentType: documentTypeEnum("document_type"),
      document: text("document"),
      stateRegistration: text("state_registration"),
      municipalRegistration: text("municipal_registration"),

      // Contact Info
      email: text("email"),
      phone: text("phone"),
      website: text("website"),

      // Address (inline fields)
      addressStreet: text("address_street"),
      addressNumber: text("address_number"),
      addressComplement: text("address_complement"),
      addressNeighborhood: text("address_neighborhood"),
      addressCity: text("address_city"),
      addressState: text("address_state"),
      addressZipCode: text("address_zip_code"),
      addressCountry: text("address_country").default("BR"),

      // Financial Settings
      industry: text("industry"),
      taxRegime: taxRegimeEnum("tax_regime"),
      paymentTermsDays: integer("payment_terms_days"),
      creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }),
      defaultBankAccountId: uuid("default_bank_account_id").references(
         () => bankAccount.id,
         { onDelete: "set null" },
      ),
      defaultCategoryId: text("default_category_id"),

      // Notes & Status
      notes: text("notes"),
      isActive: boolean("is_active").default(true).notNull(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),

      // Timestamps
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("counterparty_organization_id_idx").on(table.organizationId),
      index("counterparty_type_idx").on(table.type),
      index("counterparty_document_idx").on(table.document),
      index("counterparty_name_idx").on(table.name),
   ],
);

// Attachments table for counterparty files
export const counterpartyAttachment = pgTable(
   "counterparty_attachment",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      counterpartyId: uuid("counterparty_id")
         .notNull()
         .references(() => counterparty.id, { onDelete: "cascade" }),
      fileName: text("file_name").notNull(),
      storageKey: text("storage_key").notNull(),
      contentType: text("content_type").notNull(),
      fileSize: integer("file_size"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("counterparty_attachment_counterparty_id_idx").on(
         table.counterpartyId,
      ),
   ],
);

export const counterpartyRelations = relations(
   counterparty,
   ({ one, many }) => ({
      bills: many(bill),
      attachments: many(counterpartyAttachment),
      defaultBankAccount: one(bankAccount, {
         fields: [counterparty.defaultBankAccountId],
         references: [bankAccount.id],
      }),
      organization: one(organization, {
         fields: [counterparty.organizationId],
         references: [organization.id],
      }),
      inventoryItemCounterparties: many(inventoryItemCounterparty),
      stockMovements: many(stockMovement),
   }),
);

export const counterpartyAttachmentRelations = relations(
   counterpartyAttachment,
   ({ one }) => ({
      counterparty: one(counterparty, {
         fields: [counterpartyAttachment.counterpartyId],
         references: [counterparty.id],
      }),
   }),
);
