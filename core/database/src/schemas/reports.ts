import { sql } from "drizzle-orm";
import { jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import dayjs from "dayjs";
import { z } from "zod";
import { platformSchema } from "@core/database/schemas/schemas";
import { isIsoDateString } from "@core/utils/dates";

export const reportTypeEnum = platformSchema.enum("report_type", [
   "dre",
   "cash-flow",
   "cost-centers",
   "aging",
   "categories",
]);

export const reportSourceEnum = platformSchema.enum("report_source", [
   "manual",
   "workflow",
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportConfigSchema = z
   .object({
      dateFrom: isoDate,
      dateTo: isoDate,
      status: z.enum(["paid", "pending", "all"]).default("paid"),
      bankAccountId: z.string().uuid().optional(),
      categoryId: z.string().uuid().optional(),
      tagId: z.string().uuid().optional(),
      dreOnly: z.boolean().default(true),
      agingType: z.enum(["income", "expense"]).default("income"),
      agingStatus: z.enum(["open", "overdue", "settled"]).default("open"),
      categoryDepth: z.enum(["group", "subcategory"]).default("group"),
      minAmount: z.number().nonnegative().default(0),
   })
   .refine((value) => isIsoDateString(value.dateFrom), {
      path: ["dateFrom"],
      message: "Data inicial inválida.",
   })
   .refine((value) => isIsoDateString(value.dateTo), {
      path: ["dateTo"],
      message: "Data final inválida.",
   })
   .refine((value) => !dayjs(value.dateFrom).isAfter(dayjs(value.dateTo)), {
      path: ["dateTo"],
      message: "Data final deve ser maior ou igual à inicial.",
   });

export type ReportConfig = z.infer<typeof reportConfigSchema>;

export const reports = platformSchema.table("reports", {
   id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
   teamId: uuid("team_id").notNull(),
   name: text("name").notNull(),
   type: reportTypeEnum("type").notNull(),
   source: reportSourceEnum("source").notNull().default("manual"),
   config: jsonb("config").$type<ReportConfig>().notNull(),
   createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
   updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
});

export const reportSchema = createSelectSchema(reports, {
   config: reportConfigSchema,
});

export const createReportSchema = createInsertSchema(reports, {
   config: reportConfigSchema,
})
   .pick({
      name: true,
      type: true,
      config: true,
   })
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres."),
      type: z.enum(reportTypeEnum.enumValues),
   });

export type ReportType = (typeof reportTypeEnum.enumValues)[number];
export type ReportSource = (typeof reportSourceEnum.enumValues)[number];
export type Report = z.infer<typeof reportSchema>;
