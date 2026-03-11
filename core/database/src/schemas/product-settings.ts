import { sql } from "drizzle-orm";
import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { team } from "./auth";

export const AIDefaultsSchema = z.object({
   defaultLanguage: z.enum(["pt-BR", "en-US", "es"]).optional(),
   contentModel: z
      .enum([
         "openrouter/x-ai/grok-4.1-fast",
         "openrouter/google/gemini-3-flash-preview",
         "openrouter/openai/gpt-oss-120b",
         "openrouter/openai/gpt-oss-20b",
         "openrouter/moonshotai/kimi-k2.5",
         "openrouter/minimax/minimax-m2.5",
         "openrouter/z-ai/glm-5",
         "openrouter/bytedance-seed/seed-2.0-mini",
         "openrouter/liquid/lfm2-8b-a1b",
      ])
      .optional(),
   contentTemperature: z.number().min(0).max(2).optional(),
   contentMaxTokens: z.number().int().positive().optional(),
   searchDepth: z.enum(["basic", "advanced"]).optional(),
   searchMaxResults: z.number().int().positive().optional(),
   includeSearchAnswer: z.boolean().optional(),
   searchTimeRange: z.enum(["day", "week", "month", "year", "all"]).optional(),
   preferredSearchProvider: z.enum(["tavily", "exa", "firecrawl"]).optional(),
   requireAuthoritativeSources: z.boolean().optional(),
   minCredibility: z.enum(["high", "medium", "low"]).optional(),
   ragMaxResults: z.number().int().positive().optional(),
   ragMinScore: z.number().min(0).max(1).optional(),
   ragEnabled: z.boolean().optional(),
   maxChatTokens: z.number().int().positive().optional(),
   maxReasoningSteps: z.number().int().positive().optional(),
   imageGenerationModel: z
      .enum([
         "sourceful/riverflow-v2-pro",
         "sourceful/riverflow-v2-fast",
         "bytedance-seed/seedream-4.5",
         "black-forest-labs/flux.2-klein-4b",
         "black-forest-labs/flux.2-pro",
         "black-forest-labs/flux.2-flex",
         "black-forest-labs/flux.2-max",
         "google/gemini-2.5-flash-image",
         "google/gemini-3-pro-image-preview",
         "openai/gpt-5-image",
      ])
      .optional(),
});

export type AIDefaults = z.infer<typeof AIDefaultsSchema>;

export const productSettings = pgTable("product_settings", {
   id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
   teamId: uuid("team_id")
      .notNull()
      .unique()
      .references(() => team.id, { onDelete: "cascade" }),
   aiDefaults: jsonb("ai_defaults").$type<AIDefaults>().default({}),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export type ProductSettings = typeof productSettings.$inferSelect;
export type ProductSettingsInsert = typeof productSettings.$inferInsert;

export const ProductSettingsInsertSchema = createInsertSchema(productSettings);
export const ProductSettingsSelectSchema = createSelectSchema(productSettings);
