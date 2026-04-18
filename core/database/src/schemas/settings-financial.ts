import { boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { settingsSchema } from "@core/database/schemas/schemas";

export const financialConfig = settingsSchema.table("financial", {
   teamId: uuid("team_id").primaryKey(),
   costCenterRequired: boolean("cost_center_required").notNull().default(false),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

export const financialConfigSelectSchema = createSelectSchema(financialConfig);
export const financialConfigInsertSchema = createInsertSchema(
   financialConfig,
).omit({
   teamId: true,
   createdAt: true,
   updatedAt: true,
});

export type FinancialConfig = typeof financialConfig.$inferSelect;
export type FinancialConfigInput = z.infer<typeof financialConfigInsertSchema>;
