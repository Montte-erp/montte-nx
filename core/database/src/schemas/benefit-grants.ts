import { sql } from "drizzle-orm";
import { index, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { crmSchema } from "@core/database/schemas/schemas";
import { benefits } from "@core/database/schemas/benefits";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";

export const benefitGrantStatusEnum = crmSchema.enum("benefit_grant_status", [
   "active",
   "revoked",
]);

export type BenefitGrantStatus =
   (typeof benefitGrantStatusEnum.enumValues)[number];

export const benefitGrants = crmSchema.table(
   "benefit_grants",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      subscriptionId: uuid("subscription_id")
         .notNull()
         .references(() => contactSubscriptions.id, { onDelete: "cascade" }),
      benefitId: uuid("benefit_id")
         .notNull()
         .references(() => benefits.id, { onDelete: "restrict" }),
      status: benefitGrantStatusEnum("status").notNull().default("active"),
      grantedAt: timestamp("granted_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      revokedAt: timestamp("revoked_at", { withTimezone: true }),
   },
   (table) => [
      uniqueIndex("benefit_grants_subscription_benefit_idx").on(
         table.subscriptionId,
         table.benefitId,
      ),
      index("benefit_grants_team_id_idx").on(table.teamId),
      index("benefit_grants_subscription_id_idx").on(table.subscriptionId),
      index("benefit_grants_status_idx").on(table.status),
   ],
);

export type BenefitGrant = typeof benefitGrants.$inferSelect;
export type NewBenefitGrant = typeof benefitGrants.$inferInsert;
