/**
 * SDK rate limit configuration.
 * All organizations share the same base rate limit in the metered billing model.
 */
export declare const SDK_RATE_LIMIT: {
   readonly rateLimitEnabled: true;
   readonly rateLimitTimeWindow: number;
   readonly rateLimitMax: 1000;
   readonly remaining: 1000;
   readonly refillInterval: number;
   readonly refillAmount: 1000;
};
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
export declare function getRateLimitConfig(): SDKRateLimitConfig;
/**
 * Per-minute request limit.
 */
export declare const SDK_MINUTE_LIMIT = 1000;
//# sourceMappingURL=api-key-config.d.ts.map
