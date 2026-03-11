import { pgEnum } from "drizzle-orm/pg-core";

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

export const serviceSourceEnum = pgEnum("service_source", ["manual", "asaas"]);

export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus =
   (typeof subscriptionStatusEnum.enumValues)[number];
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];

export const goalMovementTypeEnum = pgEnum("goal_movement_type", [
   "deposit",
   "withdrawal",
]);

export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];
