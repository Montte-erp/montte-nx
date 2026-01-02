/**
 * Workflow package constants
 * Centralized configuration values to avoid magic numbers
 */

// ============================================
// Queue Configuration
// ============================================

/**
 * Default number of retry attempts for failed jobs
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Default backoff delay in milliseconds for workflow jobs
 */
export const DEFAULT_BACKOFF_DELAY_MS = 1000;

/**
 * Backoff delay in milliseconds for maintenance/deletion jobs
 */
export const MAINTENANCE_BACKOFF_DELAY_MS = 5000;

/**
 * Backoff strategy type
 */
export const BACKOFF_TYPE = "exponential" as const;

// ============================================
// Job Retention
// ============================================

/**
 * Retention period for completed workflow jobs (1 day in seconds)
 */
export const WORKFLOW_COMPLETED_RETENTION_SECONDS = 24 * 60 * 60;

/**
 * Retention period for failed workflow jobs (7 days in seconds)
 */
export const WORKFLOW_FAILED_RETENTION_SECONDS = 7 * 24 * 60 * 60;

/**
 * Retention period for completed maintenance jobs (7 days in seconds)
 */
export const MAINTENANCE_COMPLETED_RETENTION_SECONDS = 7 * 24 * 60 * 60;

/**
 * Retention period for failed maintenance jobs (14 days in seconds)
 */
export const MAINTENANCE_FAILED_RETENTION_SECONDS = 14 * 24 * 60 * 60;

/**
 * Maximum number of completed workflow jobs to keep
 */
export const WORKFLOW_MAX_COMPLETED_JOBS = 1000;

/**
 * Maximum number of completed maintenance jobs to keep
 */
export const MAINTENANCE_MAX_COMPLETED_JOBS = 100;

// ============================================
// Engine Cache Configuration
// ============================================

/**
 * Default maximum size of the rule cache
 */
export const DEFAULT_CACHE_MAX_SIZE = 1000;

/**
 * Default cache TTL in milliseconds (1 minute)
 */
export const DEFAULT_CACHE_TTL_MS = 60000;

// ============================================
// Schedule Configuration
// ============================================

/**
 * Default timezone for scheduled jobs
 */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

// ============================================
// Application URLs
// ============================================

/**
 * Base dashboard URL - should be overridden by environment variable in production
 */
export const DEFAULT_DASHBOARD_BASE_URL =
	process.env.DASHBOARD_URL ?? "https://app.montte.co";

/**
 * Builds the full URL for the bills page
 */
export function getBillsPageUrl(organizationSlug: string): string {
	return `${DEFAULT_DASHBOARD_BASE_URL}/${organizationSlug}/bills`;
}
