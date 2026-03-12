import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organization, team, user } from "@core/database/schemas/auth";

export const insightTypeEnum = ["trends", "funnels", "retention"] as const;
export const insightSizeEnum = ["sm", "md", "lg", "full"] as const;

export const insightConfigSchema = z.record(z.string(), z.unknown());
export type InsightConfig = z.infer<typeof insightConfigSchema>;

export const insights = pgTable(
   "insights",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      createdBy: uuid("created_by")
         .notNull()
         .references(() => user.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      type: text("type").notNull(),
      config: jsonb("config").$type<InsightConfig>().notNull(),
      defaultSize: text("default_size").notNull().default("md"),
      cachedResults: jsonb("cached_results").$type<Record<string, unknown>>(),
      lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [index("insights_team_idx").on(table.teamId)],
);

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

const baseInsightSchema = createInsertSchema(insights).pick({
   name: true,
   description: true,
   type: true,
   config: true,
   defaultSize: true,
});

export const createInsightSchema = baseInsightSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   type: z.enum(insightTypeEnum, { message: "Tipo é obrigatório." }),
   config: insightConfigSchema,
   defaultSize: z.enum(insightSizeEnum).default("md"),
});

export const updateInsightSchema = createInsightSchema.partial();

export type CreateInsightInput = z.infer<typeof createInsightSchema>;
export type UpdateInsightInput = z.infer<typeof updateInsightSchema>;
