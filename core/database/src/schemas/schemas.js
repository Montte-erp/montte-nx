import { pgSchema } from "drizzle-orm/pg-core";
export const authSchema = pgSchema("auth");
export const financeSchema = pgSchema("finance");
export const crmSchema = pgSchema("crm");
export const inventorySchema = pgSchema("inventory");
export const platformSchema = pgSchema("platform");
export const settingsSchema = pgSchema("settings");
