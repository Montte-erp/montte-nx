import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { financeSchema } from "@core/database/schemas/schemas";

export const categoryTypeEnum = financeSchema.enum("category_type", [
   "income",
   "expense",
]);

export const categories = financeSchema.table(
   "categories",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      parentId: uuid("parent_id").references((): any => categories.id, {
         onDelete: "cascade",
      }),
      name: text("name").notNull(),
      type: categoryTypeEnum("type").notNull(),
      level: integer("level").notNull().default(1),
      description: text("description"),
      isDefault: boolean("is_default").notNull().default(false),
      color: text("color"),
      icon: text("icon"),
      isArchived: boolean("is_archived").notNull().default(false),
      keywords: text("keywords").array(),
      notes: text("notes"),
      participatesDre: boolean("participates_dre").notNull().default(false),
      dreGroupId: text("dre_group_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("categories_team_id_idx").on(table.teamId),
      index("categories_parent_id_idx").on(table.parentId),
      uniqueIndex("categories_team_parent_type_name_unique").on(
         table.teamId,
         table.parentId,
         table.type,
         table.name,
      ),
   ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CategoryType = (typeof categoryTypeEnum.enumValues)[number];

// =============================================================================
// Validators
// =============================================================================

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const nameSchema = z
   .string()
   .min(2, "Nome deve ter no mínimo 2 caracteres.")
   .max(120, "Nome deve ter no máximo 120 caracteres.");

const colorSchema = z
   .string()
   .regex(HEX_COLOR_REGEX, "Cor inválida. Use formato hex (#RRGGBB).")
   .nullable()
   .optional();

const baseCategorySchema = createInsertSchema(categories).pick({
   name: true,
   type: true,
   parentId: true,
   description: true,
   color: true,
   icon: true,
   keywords: true,
   notes: true,
   participatesDre: true,
   dreGroupId: true,
});

function refineDreGroup(
   data: { participatesDre?: boolean; dreGroupId?: string | null },
   ctx: z.RefinementCtx,
) {
   if (data.participatesDre && !data.dreGroupId) {
      ctx.addIssue({
         code: z.ZodIssueCode.custom,
         path: ["dreGroupId"],
         message:
            "Grupo DRE é obrigatório quando a categoria participa do DRE.",
      });
   }
}

export const createCategorySchema = baseCategorySchema
   .extend({
      name: nameSchema,
      type: z.enum(["income", "expense"]),
      parentId: z.string().uuid().nullable().optional(),
      description: z.string().max(255).nullable().optional(),
      color: colorSchema,
      icon: z.string().max(50).nullable().optional(),
      keywords: z
         .array(z.string().min(1).max(60))
         .max(20)
         .nullable()
         .optional(),
      notes: z.string().max(500).nullable().optional(),
      participatesDre: z.boolean().default(false),
      dreGroupId: z.string().max(60).nullable().optional(),
   })
   .superRefine(refineDreGroup);

export const updateCategorySchema = baseCategorySchema
   .extend({
      name: nameSchema,
      description: z.string().max(255).nullable().optional(),
      color: colorSchema,
      icon: z.string().max(50).nullable().optional(),
      keywords: z
         .array(z.string().min(1).max(60))
         .max(20)
         .nullable()
         .optional(),
      notes: z.string().max(500).nullable().optional(),
      participatesDre: z.boolean(),
      dreGroupId: z.string().max(60).nullable().optional(),
   })
   .omit({ type: true, parentId: true })
   .partial()
   .superRefine(refineDreGroup);

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
