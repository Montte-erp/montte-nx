import { Condition } from "@f-o-t/condition-evaluator";
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   jsonb,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { organization, team, user } from "./auth";

export const dashboardTileSchema = z.object({
   insightId: z.string().uuid("ID do insight inválido."),
   size: z.enum(["sm", "md", "lg", "full"], {
      message: "Tamanho deve ser sm, md, lg ou full.",
   }),
   order: z.number().int().min(0, "Ordem deve ser maior ou igual a zero."),
});

export type DashboardTile = z.infer<typeof dashboardTileSchema>;

export const DashboardDateRangeSchema = z.object({
   type: z.enum(["relative", "absolute"]),
   value: z.string(),
});

export type DashboardDateRange = z.infer<typeof DashboardDateRangeSchema>;

export const DashboardFilterSchema = Condition;

export type DashboardFilter = z.infer<typeof DashboardFilterSchema>;

export const dashboards = pgTable(
   "dashboards",
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
      isDefault: boolean("is_default").default(false).notNull(),
      tiles: jsonb("tiles").$type<DashboardTile[]>().notNull().default([]),
      globalDateRange: jsonb("global_date_range").$type<DashboardDateRange>(),
      globalFilters: jsonb("global_filters")
         .$type<DashboardFilter[]>()
         .default([]),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("dashboards_team_idx").on(table.teamId),
      uniqueIndex("dashboards_team_default_idx")
         .on(table.teamId)
         .where(sql`${table.isDefault} = true`),
   ],
);

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;

const baseDashboardSchema = createInsertSchema(dashboards).pick({
   name: true,
   description: true,
   tiles: true,
   globalDateRange: true,
   globalFilters: true,
});

export const createDashboardSchema = baseDashboardSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   tiles: z.array(dashboardTileSchema).default([]),
   globalDateRange: DashboardDateRangeSchema.nullable().optional(),
   globalFilters: z.array(DashboardFilterSchema).default([]),
});

export const updateDashboardSchema = createDashboardSchema.partial();

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;
