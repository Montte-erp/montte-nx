import { sql } from "drizzle-orm";
import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { platformSchema } from "@core/database/schemas/schemas";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { organization, team, user } from "@core/database/schemas/auth";
export const insightTypeEnum = ["kpi", "time_series", "breakdown"];
export const insightSizeEnum = ["sm", "md", "lg", "full"];
export const insightConfigSchema = z.record(z.string(), z.unknown());
export const insights = platformSchema.table(
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
      config: jsonb("config").$type().notNull(),
      defaultSize: text("default_size").notNull().default("md"),
      cachedResults: jsonb("cached_results").$type(),
      lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [index("insights_team_idx").on(table.teamId)],
);
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
