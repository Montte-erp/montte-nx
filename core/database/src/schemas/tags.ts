import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { crmSchema } from "@core/database/schemas/schemas";

export const tags = crmSchema.table(
   "tags",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull().default("#6366f1"),
      description: text("description"),
      isDefault: boolean("is_default").notNull().default(false),
      isArchived: boolean("is_archived").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("tags_team_id_idx").on(table.teamId),
      uniqueIndex("tags_team_id_name_unique").on(table.teamId, table.name),
   ],
);

export const tagSchema = createSelectSchema(tags);
export type Tag = z.infer<typeof tagSchema>;

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
   .optional();

export const createTagSchema = createInsertSchema(tags)
   .pick({ name: true, color: true, description: true })
   .extend({
      name: nameSchema,
      color: colorSchema,
      description: z.string().max(255).nullable().optional(),
   });

export const updateTagSchema = createTagSchema.partial();

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
