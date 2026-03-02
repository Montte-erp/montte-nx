import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { team } from "./auth";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const billingCycleEnum = pgEnum("billing_cycle", [
  "hourly",
  "monthly",
  "annual",
  "one_time",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "completed",
  "cancelled",
]);

export const serviceSourceEnum = pgEnum("service_source", [
  "manual",
  "asaas",
]);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export const services = pgTable(
  "services",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("services_team_id_idx").on(table.teamId),
  ],
);

// ---------------------------------------------------------------------------
// Service Variants
// ---------------------------------------------------------------------------

export const serviceVariants = pgTable(
  "service_variants",
  {
    id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    basePrice: integer("base_price").notNull(), // cents (@f-o-t/money)
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").notNull().references(() => serviceVariants.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),          // null = open-ended
    negotiatedPrice: integer("negotiated_price").notNull(), // cents
    notes: text("notes"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    source: serviceSourceEnum("source").notNull().default("manual"),
    externalId: text("external_id"),   // Asaas subscription ID
    resourceId: uuid("resource_id"),   // reserved for future booking
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    teamId: uuid("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  team: one(team, { fields: [services.teamId], references: [team.id] }),
  variants: many(serviceVariants),
  resources: many(resources),
}));

export const serviceVariantsRelations = relations(serviceVariants, ({ one, many }) => ({
  service: one(services, { fields: [serviceVariants.serviceId], references: [services.id] }),
  subscriptions: many(contactSubscriptions),
}));

export const contactSubscriptionsRelations = relations(contactSubscriptions, ({ one }) => ({
  contact: one(contacts, { fields: [contactSubscriptions.contactId], references: [contacts.id] }),
  variant: one(serviceVariants, { fields: [contactSubscriptions.variantId], references: [serviceVariants.id] }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  service: one(services, { fields: [resources.serviceId], references: [services.id] }),
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
export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];
