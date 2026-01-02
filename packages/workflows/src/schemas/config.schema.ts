import { z } from "zod";
import {
	DEFAULT_CACHE_MAX_SIZE,
	DEFAULT_CACHE_TTL_MS,
	DEFAULT_TIMEZONE,
} from "../constants";

// ============================================
// Engine Configuration Schema
// ============================================

export const workflowEngineConfigSchema = z.object({
	/**
	 * Whether to enable rule caching
	 */
	cacheEnabled: z.boolean().default(true),

	/**
	 * Cache time-to-live in milliseconds
	 */
	cacheTtl: z.number().positive().default(DEFAULT_CACHE_TTL_MS),

	/**
	 * Maximum number of rules to cache
	 */
	cacheMaxSize: z.number().positive().default(DEFAULT_CACHE_MAX_SIZE),

	/**
	 * Whether to continue processing if an error occurs
	 */
	continueOnError: z.boolean().default(true),
});

// ============================================
// Schedule Configuration Schema
// ============================================

export const timeFormatSchema = z
	.string()
	.regex(/^([01]?\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:MM format");

export const cronPatternSchema = z.string().regex(
	/^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([1-9]|[12]\d|3[01])) (\*|(1[0-2]|[1-9])) (\*|[0-6])$/,
	"Invalid cron pattern",
);

export const scheduleConfigSchema = z.object({
	/**
	 * Time of day in HH:MM format
	 */
	time: timeFormatSchema,

	/**
	 * Day of week (0-6, where 0 is Sunday) for weekly schedules
	 */
	dayOfWeek: z.number().min(0).max(6).optional(),

	/**
	 * Custom cron pattern for advanced scheduling
	 */
	cronPattern: cronPatternSchema.optional(),

	/**
	 * Timezone for schedule execution
	 */
	timezone: z.string().default(DEFAULT_TIMEZONE),
});

// ============================================
// Runner Configuration Schema
// ============================================

export const workflowRunnerConfigSchema = z.object({
	/**
	 * Whether to run in dry-run mode (no actual side effects)
	 */
	dryRun: z.boolean().default(false),

	/**
	 * Whether to enable caching
	 */
	cacheEnabled: z.boolean().optional(),
});

// ============================================
// Inferred Types
// ============================================

export type WorkflowEngineConfig = z.infer<typeof workflowEngineConfigSchema>;
export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export type WorkflowRunnerConfig = z.infer<typeof workflowRunnerConfigSchema>;

// ============================================
// Validation Functions
// ============================================

export function validateEngineConfig(data: unknown): WorkflowEngineConfig {
	return workflowEngineConfigSchema.parse(data);
}

export function validateScheduleConfig(data: unknown): ScheduleConfig {
	return scheduleConfigSchema.parse(data);
}

export function validateRunnerConfig(data: unknown): WorkflowRunnerConfig {
	return workflowRunnerConfigSchema.parse(data);
}
