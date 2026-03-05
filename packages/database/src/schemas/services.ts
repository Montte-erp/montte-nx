import { relations, sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   integer,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { categories } from "./categories";
import {
   billingCycleEnum,
   serviceSourceEnum,
   serviceTypeEnum,
   subscriptionStatusEnum,
} from "./enums";
import { tags } from "./tags";

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const services = pgTable(
   "services",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      basePrice: integer("base_price").notNull().default(0), // cents (@f-o-t/money)
      type: serviceTypeEnum("type").notNull().default("service"),
      categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
      tagId: uuid("tag_id").references(() => tags.id, { onDelete: "set null" }),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [index("services_team_id_idx").on(table.teamId)],
);

// ---------------------------------------------------------------------------
// Service Variants
// ---------------------------------------------------------------------------

export const serviceVariants = pgTable(
   "service_variants",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      basePrice: integer("base_price").notNull(), // cents (@f-o-t/money)
      billingCycle: billingCycleEnum("billing_cycle").notNull(),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("service_variants_service_id_idx").on(table.serviceId),
      index("service_variants_team_id_idx").on(table.teamId),
   ],
);

// ---------------------------------------------------------------------------
// Contact Subscriptions
// ---------------------------------------------------------------------------

export const contactSubscriptions = pgTable(
   "contact_subscriptions",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      contactId: uuid("contact_id")
         .notNull()
         .references(() => contacts.id, { onDelete: "cascade" }),
      variantId: uuid("variant_id")
         .notNull()
         .references(() => serviceVariants.id, { onDelete: "cascade" }),
      startDate: date("start_date").notNull(),
      endDate: date("end_date"), // null = open-ended
      negotiatedPrice: integer("negotiated_price").notNull(), // cents
      notes: text("notes"),
      status: subscriptionStatusEnum("status").notNull().default("active"),
      source: serviceSourceEnum("source").notNull().default("manual"),
      externalId: text("external_id"), // Asaas subscription ID
      resourceId: uuid("resource_id").references(() => resources.id, {
         onDelete: "set null",
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("contact_subscriptions_team_id_idx").on(table.teamId),
      index("contact_subscriptions_contact_id_idx").on(table.contactId),
      index("contact_subscriptions_variant_id_idx").on(table.variantId),
      index("contact_subscriptions_external_id_idx").on(table.externalId),
      index("contact_subscriptions_status_idx").on(table.status),
   ],
);

// ---------------------------------------------------------------------------
// Resources (schema only — not used in v1, reserved for booking)
// ---------------------------------------------------------------------------

export const resources = pgTable(
   "resources",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      serviceId: uuid("service_id")
         .notNull()
         .references(() => services.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      capacity: integer("capacity").notNull().default(1),
      isActive: boolean("is_active").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("resources_team_id_idx").on(table.teamId),
      index("resources_service_id_idx").on(table.serviceId),
   ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const servicesRelations = relations(services, ({ one, many }) => ({
   category: one(categories, {
      fields: [services.categoryId],
      references: [categories.id],
   }),
   tag: one(tags, {
      fields: [services.tagId],
      references: [tags.id],
   }),
   variants: many(serviceVariants),
   resources: many(resources),
}));

export const serviceVariantsRelations = relations(
   serviceVariants,
   ({ one, many }) => ({
      service: one(services, {
         fields: [serviceVariants.serviceId],
         references: [services.id],
      }),
      subscriptions: many(contactSubscriptions),
   }),
);

export const contactSubscriptionsRelations = relations(
   contactSubscriptions,
   ({ one }) => ({
      contact: one(contacts, {
         fields: [contactSubscriptions.contactId],
         references: [contacts.id],
      }),
      variant: one(serviceVariants, {
         fields: [contactSubscriptions.variantId],
         references: [serviceVariants.id],
      }),
      resource: one(resources, {
         fields: [contactSubscriptions.resourceId],
         references: [resources.id],
      }),
   }),
);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
   service: one(services, {
      fields: [resources.serviceId],
      references: [services.id],
   }),
   subscriptions: many(contactSubscriptions),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type ServiceVariant = typeof serviceVariants.$inferSelect;
export type NewServiceVariant = typeof serviceVariants.$inferInsert;
export type ContactSubscription = typeof contactSubscriptions.$inferSelect;
export type NewContactSubscription = typeof contactSubscriptions.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
