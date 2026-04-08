import { boolean, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";

export const agentSettings = platformSchema.table("agent_settings", {
   teamId: uuid("team_id").primaryKey(),
   modelId: text("model_id")
      .notNull()
      .default("openrouter/moonshotai/kimi-k2.5"),
   language: varchar("language", { length: 10 }).notNull().default("pt-BR"),
   tone: varchar("tone", { length: 50 }).notNull().default("formal"),
   dataSourceTransactions: boolean("data_source_transactions")
      .notNull()
      .default(true),
   dataSourceContacts: boolean("data_source_contacts").notNull().default(true),
   dataSourceInventory: boolean("data_source_inventory")
      .notNull()
      .default(true),
   dataSourceServices: boolean("data_source_services").notNull().default(true),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

export type AgentSettings = typeof agentSettings.$inferSelect;
export type NewAgentSettings = typeof agentSettings.$inferInsert;
