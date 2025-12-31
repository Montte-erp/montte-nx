import { z } from "zod";
import type {
   AggregatedConsequence,
   ConsequenceDefinitions,
   DefaultConsequences,
} from "./consequence";
import type {
   ConflictResolutionStrategy,
   EngineExecutionResult,
   EvaluationContext,
   RuleEvaluationResult,
} from "./evaluation";
import type { Rule } from "./rule";

// ============================================================================
// Zod Schemas - Define schemas first, then infer types
// ============================================================================

export const LogLevelSchema = z.enum([
   "none",
   "error",
   "warn",
   "info",
   "debug",
]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const CacheConfigSchema = z.object({
   enabled: z.boolean().default(true),
   ttl: z.number().int().positive().default(60000),
   maxSize: z.number().int().positive().default(1000),
});
export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export const ValidationConfigSchema = z.object({
   enabled: z.boolean().default(true),
   strict: z.boolean().default(false),
});
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;

export const VersioningConfigSchema = z.object({
   enabled: z.boolean().default(false),
   maxVersions: z.number().int().positive().default(10),
});
export type VersioningConfig = z.infer<typeof VersioningConfigSchema>;

// ============================================================================
// Types that cannot be Zod schemas (contain functions or generics)
// ============================================================================

export type Logger = {
   readonly error: (...args: unknown[]) => void;
   readonly warn: (...args: unknown[]) => void;
   readonly info: (...args: unknown[]) => void;
   readonly debug: (...args: unknown[]) => void;
};

export type EngineHooks<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = {
   readonly beforeEvaluation?: (
      context: EvaluationContext<TContext>,
      rules: ReadonlyArray<Rule<TContext, TConsequences>>,
   ) => void | Promise<void>;

   readonly afterEvaluation?: (
      result: EngineExecutionResult<TContext, TConsequences>,
   ) => void | Promise<void>;

   readonly beforeRuleEvaluation?: (
      rule: Rule<TContext, TConsequences>,
      context: EvaluationContext<TContext>,
   ) => void | Promise<void>;

   readonly afterRuleEvaluation?: (
      rule: Rule<TContext, TConsequences>,
      result: RuleEvaluationResult<TContext, TConsequences>,
   ) => void | Promise<void>;

   readonly onRuleMatch?: (
      rule: Rule<TContext, TConsequences>,
      context: EvaluationContext<TContext>,
   ) => void | Promise<void>;

   readonly onRuleSkip?: (
      rule: Rule<TContext, TConsequences>,
      reason: string,
   ) => void | Promise<void>;

   readonly onRuleError?: (
      rule: Rule<TContext, TConsequences>,
      error: Error,
   ) => void | Promise<void>;

   readonly onConsequenceCollected?: (
      rule: Rule<TContext, TConsequences>,
      consequence: AggregatedConsequence<TConsequences>,
   ) => void | Promise<void>;

   readonly onCacheHit?: (
      key: string,
      result: EngineExecutionResult<TContext, TConsequences>,
   ) => void | Promise<void>;

   readonly onCacheMiss?: (key: string) => void | Promise<void>;

   readonly onSlowRule?: (
      rule: Rule<TContext, TConsequences>,
      timeMs: number,
      threshold: number,
   ) => void | Promise<void>;

   readonly onHookError?: (hookName: string, error: Error) => void;
};

export type EngineConfig<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = {
   readonly consequences?: TConsequences;
   readonly conflictResolution?: ConflictResolutionStrategy;
   readonly cache?: Partial<CacheConfig>;
   readonly validation?: Partial<ValidationConfig>;
   readonly versioning?: Partial<VersioningConfig>;
   readonly hooks?: EngineHooks<TContext, TConsequences>;
   readonly logLevel?: LogLevel;
   readonly logger?: Logger;
   readonly continueOnError?: boolean;
   readonly slowRuleThresholdMs?: number;
   readonly hookTimeoutMs?: number;
};

export type ResolvedEngineConfig<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = {
   readonly consequences: TConsequences | undefined;
   readonly conflictResolution: ConflictResolutionStrategy;
   readonly cache: CacheConfig;
   readonly validation: ValidationConfig;
   readonly versioning: VersioningConfig;
   readonly hooks: EngineHooks<TContext, TConsequences>;
   readonly logLevel: LogLevel;
   readonly logger: Logger;
   readonly continueOnError: boolean;
   readonly slowRuleThresholdMs: number;
   readonly hookTimeoutMs: number | undefined;
};

// ============================================================================
// Helper functions for parsing/resolving configs with defaults
// ============================================================================

export const parseCacheConfig = (input?: Partial<CacheConfig>): CacheConfig =>
   CacheConfigSchema.parse(input ?? {});

export const parseValidationConfig = (
   input?: Partial<ValidationConfig>,
): ValidationConfig => ValidationConfigSchema.parse(input ?? {});

export const parseVersioningConfig = (
   input?: Partial<VersioningConfig>,
): VersioningConfig => VersioningConfigSchema.parse(input ?? {});

export const getDefaultCacheConfig = (): CacheConfig =>
   CacheConfigSchema.parse({});

export const getDefaultValidationConfig = (): ValidationConfig =>
   ValidationConfigSchema.parse({});

export const getDefaultVersioningConfig = (): VersioningConfig =>
   VersioningConfigSchema.parse({});

export const getDefaultLogLevel = (): LogLevel => "warn";

export const getDefaultConflictResolution = (): ConflictResolutionStrategy =>
   "priority";
