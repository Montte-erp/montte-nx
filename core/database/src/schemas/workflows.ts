import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { platformSchema } from "@core/database/schemas/schemas";
import { reportTypeEnum, reports } from "@core/database/schemas/reports";
import { team, user } from "@core/database/schemas/auth";

export const workflowStatusEnum = platformSchema.enum("workflow_status", [
   "active",
   "paused",
]);

export const workflowRunStatusEnum = platformSchema.enum(
   "workflow_run_status",
   ["pending", "running", "succeeded", "failed"],
);

export const workflowRunTriggeredByEnum = platformSchema.enum(
   "workflow_run_triggered_by",
   ["schedule", "manual"],
);

const workflowPeriodKindEnum = z.enum([
   "previous-month",
   "previous-week",
   "current-month",
   "current-week",
]);

const workflowNodePositionSchema = z.object({
   x: z.number(),
   y: z.number(),
});

const workflowScheduleTriggerNodeSchema = z.object({
   id: z.literal("trigger"),
   type: z.literal("scheduleTrigger"),
   position: workflowNodePositionSchema,
   data: z.object({
      cron: z.string(),
      timezone: z.string(),
      humanLabel: z.string(),
   }),
});

const workflowCreateReportNodeSchema = z.object({
   id: z.literal("action"),
   type: z.literal("createReport"),
   position: workflowNodePositionSchema,
   data: z.object({
      reportType: z.enum(reportTypeEnum.enumValues),
      period: z.object({ kind: workflowPeriodKindEnum }),
      nameTemplate: z.string(),
   }),
});

const workflowEdgeSchema = z.object({
   id: z.literal("e-trigger-action"),
   source: z.literal("trigger"),
   target: z.literal("action"),
});

export const workflowGraphSchema = z.object({
   nodes: z.tuple([
      workflowScheduleTriggerNodeSchema,
      workflowCreateReportNodeSchema,
   ]),
   edges: z.tuple([workflowEdgeSchema]),
});

export type WorkflowGraph = z.infer<typeof workflowGraphSchema>;
export type WorkflowPeriodKind = z.infer<typeof workflowPeriodKindEnum>;

export const workflows = platformSchema.table(
   "workflows",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      templateId: text("template_id").notNull(),
      name: text("name").notNull(),
      status: workflowStatusEnum("status").notNull().default("active"),
      graph: jsonb("graph").$type<WorkflowGraph>().notNull(),
      nextRunAt: timestamp("next_run_at", { withTimezone: true }),
      createdBy: uuid("created_by")
         .notNull()
         .references(() => user.id),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("workflows_team_id_status_idx").on(table.teamId, table.status),
      index("workflows_next_run_at_idx").on(table.nextRunAt),
   ],
);

export const workflowRuns = platformSchema.table(
   "workflow_runs",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      workflowId: uuid("workflow_id")
         .notNull()
         .references(() => workflows.id, { onDelete: "cascade" }),
      status: workflowRunStatusEnum("status").notNull(),
      scheduledFor: timestamp("scheduled_for", {
         withTimezone: true,
      }).notNull(),
      startedAt: timestamp("started_at", { withTimezone: true }),
      endedAt: timestamp("ended_at", { withTimezone: true }),
      reportId: uuid("report_id").references(() => reports.id),
      idempotencyKey: text("idempotency_key").notNull(),
      error: text("error"),
      triggeredBy: workflowRunTriggeredByEnum("triggered_by").notNull(),
   },
   (table) => [
      uniqueIndex(
         "workflow_runs_workflow_id_scheduled_for_idempotency_key_uq",
      ).on(table.workflowId, table.scheduledFor, table.idempotencyKey),
      index("workflow_runs_workflow_id_status_idx").on(
         table.workflowId,
         table.status,
      ),
      index("workflow_runs_scheduled_for_status_idx").on(
         table.scheduledFor,
         table.status,
      ),
   ],
);

export const workflowSchema = createSelectSchema(workflows, {
   graph: workflowGraphSchema,
});

export const workflowRunSchema = createSelectSchema(workflowRuns);

export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type WorkflowStatus = (typeof workflowStatusEnum.enumValues)[number];
export type WorkflowRunStatus =
   (typeof workflowRunStatusEnum.enumValues)[number];
export type WorkflowRunTriggeredBy =
   (typeof workflowRunTriggeredByEnum.enumValues)[number];
