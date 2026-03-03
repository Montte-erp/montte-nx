/**
 * SDK rate limit configuration.
 * All organizations share the same base rate limit in the metered billing model.
 */
export const SDK_RATE_LIMIT = {
   rateLimitEnabled: true,
   rateLimitTimeWindow: 1000 * 60, // 1 minute
   rateLimitMax: 1000,
   remaining: 1000,
   refillInterval: 1000 * 60, // 1 minute
   refillAmount: 1000,
} as const;

export type SDKRateLimitConfig = typeof SDK_RATE_LIMIT;

/**
 * SDK mode determines how the SDK can be used.
 * - static: Only for build-time fetching (SSG/ISR)
 * - ssr: Full server-side rendering support
 */
export type SDKMode = "static" | "ssr";

/**
 * Get rate limit configuration.
 */
export function getRateLimitConfig(): SDKRateLimitConfig {
   return SDK_RATE_LIMIT;
}

/**
 * Per-minute request limit.
 */
export const SDK_MINUTE_LIMIT = 1000;
