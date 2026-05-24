import "dayjs/locale/pt-br";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { CronExpressionParser } from "cron-parser";
import {
   type ReportConfig,
   type ReportType,
} from "@core/database/schemas/reports";
import type { WorkflowGraph } from "@core/database/schemas/workflows";
import type { WorkflowTemplatePeriod } from "./templates";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("pt-br");

export const WORKFLOW_TIMEZONE = "America/Sao_Paulo";
export const WORKFLOW_EXECUTE_QUEUE_NAME = "workflows/execute";
export const WORKFLOW_SCHEDULER_QUEUE_NAME = "workflows/scheduler";
export const WORKFLOW_EXECUTE_WORKFLOW_NAME = "executeWorkflowWorkflowFn";
export const WORKFLOW_SCHEDULER_WORKFLOW_NAME = "pollDueWorkflowsWorkflowFn";

export type WorkflowPeriod = {
   from: Date;
   to: Date;
};

export function normalizeWorkflowTimezone(
   timezoneValue: string | null | undefined,
) {
   return timezoneValue === WORKFLOW_TIMEZONE
      ? timezoneValue
      : WORKFLOW_TIMEZONE;
}

export function buildHumanLabel(cron: string) {
   const [minute, hour, dayOfMonth, , dayOfWeek] = cron.split(" ");
   const hourLabel = hour?.padStart(2, "0") ?? "00";
   const minuteLabel = minute?.padStart(2, "0") ?? "00";
   if (dayOfMonth && dayOfMonth !== "*" && dayOfWeek === "*") {
      return `Todo dia ${dayOfMonth} às ${hourLabel}:${minuteLabel}`;
   }
   if (dayOfWeek && dayOfWeek !== "*" && dayOfMonth === "*") {
      const weekdayNames = [
         "domingo",
         "segunda",
         "terça",
         "quarta",
         "quinta",
         "sexta",
         "sábado",
      ];
      const normalizedWeekday = ((Number(dayOfWeek) % 7) + 7) % 7;
      const weekday = weekdayNames[normalizedWeekday] ?? "segunda";
      return `Toda ${weekday} às ${hourLabel}:${minuteLabel}`;
   }
   return `Agendado às ${hourLabel}:${minuteLabel}`;
}

export function buildNextRunAt(
   cron: string,
   timezoneValue: string,
   currentDate: Date,
) {
   const interval = CronExpressionParser.parse(cron, {
      currentDate,
      tz: timezoneValue,
   });
   return interval.next().toDate();
}

export function computeWorkflowPeriod(
   period: WorkflowTemplatePeriod,
   scheduledFor: Date,
   timezoneValue: string,
): WorkflowPeriod {
   const local = dayjs(scheduledFor).tz(timezoneValue);
   if (period === "previous-month") {
      const currentMonthStart = local.startOf("month");
      return {
         from: currentMonthStart.subtract(1, "month").toDate(),
         to: currentMonthStart.toDate(),
      };
   }
   if (period === "current-month") {
      const monthStart = local.startOf("month");
      return {
         from: monthStart.toDate(),
         to: monthStart.add(1, "month").toDate(),
      };
   }
   const weekday = local.day();
   const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
   const weekStart = local.startOf("day").add(mondayOffset, "day");
   if (period === "previous-week") {
      return {
         from: weekStart.subtract(7, "day").toDate(),
         to: weekStart.toDate(),
      };
   }
   return {
      from: weekStart.toDate(),
      to: weekStart.add(7, "day").toDate(),
   };
}

export function renderWorkflowName(
   template: string,
   period: WorkflowPeriod,
   timezoneValue: string,
) {
   const start = dayjs(period.from).tz(timezoneValue);
   const end = dayjs(period.to).tz(timezoneValue);
   return template
      .replaceAll("{month}", start.format("MMMM"))
      .replaceAll("{year}", start.format("YYYY"))
      .replaceAll("{week}", start.format("DD/MM"))
      .replaceAll(
         "{range}",
         `${start.format("DD/MM")} — ${end.format("DD/MM")}`,
      );
}

export function buildWorkflowReportConfig(input: {
   reportType: ReportType;
   period: WorkflowPeriod;
   timezone: string;
}): ReportConfig {
   const start = dayjs(input.period.from).tz(input.timezone);
   const end = dayjs(input.period.to).tz(input.timezone).subtract(1, "day");
   const base: ReportConfig = {
      dateFrom: start.format("YYYY-MM-DD"),
      dateTo: end.format("YYYY-MM-DD"),
      status: "paid",
      bankAccountId: undefined,
      categoryId: undefined,
      tagId: undefined,
      dreOnly: true,
      agingType: "income",
      agingStatus: "open",
      categoryDepth: "group",
      minAmount: 0,
   };
   if (input.reportType === "aging") {
      return { ...base, agingType: "expense" };
   }
   return base;
}

export function createWorkflowIdempotencyKey(
   workflowId: string,
   scheduledFor: Date,
) {
   return `${workflowId}-${scheduledFor.toISOString()}`;
}

export function findWorkflowScheduleNode(graph: WorkflowGraph) {
   return graph.nodes.find(
      (node): node is WorkflowGraph["nodes"][0] =>
         node.type === "scheduleTrigger",
   );
}

export function findWorkflowActionNode(graph: WorkflowGraph) {
   return graph.nodes.find(
      (node): node is WorkflowGraph["nodes"][1] => node.type === "createReport",
   );
}
