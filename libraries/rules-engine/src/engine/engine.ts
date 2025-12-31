import { type Cache, createCache } from "../cache/cache";
import { createNoopCache } from "../cache/noop";
import { evaluateRule } from "../core/evaluate";
import {
   type EngineConfig,
   getDefaultCacheConfig,
   getDefaultConflictResolution,
   getDefaultLogLevel,
   getDefaultValidationConfig,
   getDefaultVersioningConfig,
   type ResolvedEngineConfig,
} from "../types/config";
import type {
   AggregatedConsequence,
   ConsequenceDefinitions,
   DefaultConsequences,
} from "../types/consequence";
import type {
   EngineExecutionResult,
   EvaluateOptions,
   EvaluationContext,
} from "../types/evaluation";
import type {
   Rule,
   RuleFilters,
   RuleInput,
   RuleSet,
   RuleSetInput,
} from "../types/rule";
import type {
   CacheStats,
   EngineState,
   EngineStats,
   MutableEngineState,
} from "../types/state";
import { createInitialState } from "../types/state";
import { hashContext, hashRules } from "../utils/hash";
import { generateId } from "../utils/id";
import { measureTime } from "../utils/time";
import {
   executeAfterEvaluation,
   executeAfterRuleEvaluation,
   executeBeforeEvaluation,
   executeBeforeRuleEvaluation,
   executeOnCacheHit,
   executeOnCacheMiss,
   executeOnConsequenceCollected,
   executeOnRuleError,
   executeOnRuleMatch,
   executeOnRuleSkip,
   executeOnSlowRule,
} from "./hooks";
import {
   addRule,
   addRuleSet,
   addRules,
   clearRules,
   disableRule,
   enableRule,
   getRule,
   getRuleSet,
   getRuleSets,
   getRules,
   getRulesInSet,
   removeRule,
   removeRuleSet,
   updateRule,
} from "./state";

export type Engine<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = {
   readonly addRule: (
      input: RuleInput<TContext, TConsequences>,
   ) => Rule<TContext, TConsequences>;
   readonly addRules: (
      inputs: RuleInput<TContext, TConsequences>[],
   ) => Rule<TContext, TConsequences>[];
   readonly removeRule: (ruleId: string) => boolean;
   readonly updateRule: (
      ruleId: string,
      updates: Partial<RuleInput<TContext, TConsequences>>,
   ) => Rule<TContext, TConsequences> | undefined;
   readonly getRule: (
      ruleId: string,
   ) => Rule<TContext, TConsequences> | undefined;
   readonly getRules: (
      filters?: RuleFilters,
   ) => ReadonlyArray<Rule<TContext, TConsequences>>;
   readonly enableRule: (ruleId: string) => boolean;
   readonly disableRule: (ruleId: string) => boolean;
   readonly clearRules: () => void;

   readonly addRuleSet: (input: RuleSetInput) => RuleSet;
   readonly getRuleSet: (ruleSetId: string) => RuleSet | undefined;
   readonly getRuleSets: () => ReadonlyArray<RuleSet>;
   readonly removeRuleSet: (ruleSetId: string) => boolean;

   readonly evaluate: (
      context: TContext,
      options?: EvaluateOptions,
   ) => Promise<EngineExecutionResult<TContext, TConsequences>>;

   readonly clearCache: () => void;
   readonly getCacheStats: () => CacheStats;

   readonly getState: () => Readonly<EngineState<TContext, TConsequences>>;
   readonly getStats: () => EngineStats;
};

const resolveConfig = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   config: EngineConfig<TContext, TConsequences>,
): ResolvedEngineConfig<TContext, TConsequences> => {
   return {
      consequences: config.consequences,
      conflictResolution:
         config.conflictResolution ?? getDefaultConflictResolution(),
      cache: {
         ...getDefaultCacheConfig(),
         ...config.cache,
      },
      validation: {
         ...getDefaultValidationConfig(),
         ...config.validation,
      },
      versioning: {
         ...getDefaultVersioningConfig(),
         ...config.versioning,
      },
      hooks: config.hooks ?? {},
      logLevel: config.logLevel ?? getDefaultLogLevel(),
      logger: config.logger ?? console,
      continueOnError: config.continueOnError ?? true,
      slowRuleThresholdMs: config.slowRuleThresholdMs ?? 10,
      hookTimeoutMs: config.hookTimeoutMs,
   };
};

export const createEngine = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   config: EngineConfig<TContext, TConsequences> = {},
): Engine<TContext, TConsequences> => {
   const resolvedConfig = resolveConfig(config);
   const state: MutableEngineState<TContext, TConsequences> =
      createInitialState();

   const cache: Cache<EngineExecutionResult<TContext, TConsequences>> =
      resolvedConfig.cache.enabled
         ? createCache({
              ttl: resolvedConfig.cache.ttl,
              maxSize: resolvedConfig.cache.maxSize,
           })
         : createNoopCache();

   let totalEvaluations = 0;
   let totalMatches = 0;
   let totalErrors = 0;
   let cacheHits = 0;
   let cacheMisses = 0;
   let totalEvaluationTime = 0;

   const evaluate = async (
      contextData: TContext,
      options: EvaluateOptions = {},
   ): Promise<EngineExecutionResult<TContext, TConsequences>> => {
      const context: EvaluationContext<TContext> = {
         data: contextData,
         timestamp: new Date(),
         correlationId: generateId(),
      };

      let rulesToEvaluate = getRules(state, {
         enabled: options.skipDisabled !== false ? true : undefined,
         tags: options.tags,
         category: options.category,
      });

      if (options.ruleSetId) {
         const ruleSetRules = getRulesInSet(state, options.ruleSetId);
         const ruleSetIds = new Set(ruleSetRules.map((r) => r.id));
         rulesToEvaluate = rulesToEvaluate.filter((r) => ruleSetIds.has(r.id));
      }

      // Rules are already sorted by priority via state.ruleOrder (sorted on add/update)

      if (options.maxRules && options.maxRules > 0) {
         rulesToEvaluate = rulesToEvaluate.slice(0, options.maxRules);
      }

      const cacheKey = !options.bypassCache
         ? `${hashContext(contextData)}:${hashRules(rulesToEvaluate.map((r) => r.id))}`
         : null;

      if (cacheKey && cache.has(cacheKey)) {
         const cached = cache.get(cacheKey);
         if (cached) {
            cacheHits++;
            await executeOnCacheHit(
               resolvedConfig.hooks,
               cacheKey,
               cached,
               resolvedConfig.hookTimeoutMs,
            );
            return { ...cached, cacheHit: true };
         }
      }

      if (cacheKey) {
         cacheMisses++;
         await executeOnCacheMiss(
            resolvedConfig.hooks,
            cacheKey,
            resolvedConfig.hookTimeoutMs,
         );
      }

      await executeBeforeEvaluation(
         resolvedConfig.hooks,
         context,
         rulesToEvaluate,
         resolvedConfig.hookTimeoutMs,
      );

      const { result: evaluationResult, durationMs } = measureTime(() => {
         const results: Array<{
            rule: Rule<TContext, TConsequences>;
            result: ReturnType<typeof evaluateRule<TContext, TConsequences>>;
         }> = [];

         for (const rule of rulesToEvaluate) {
            const result = evaluateRule(rule, context, { skipDisabled: true });
            results.push({ rule, result });
         }

         return results;
      });

      const ruleResults: ReturnType<
         typeof evaluateRule<TContext, TConsequences>
      >[] = [];
      const matchedRules: Rule<TContext, TConsequences>[] = [];
      const consequences: AggregatedConsequence<TConsequences>[] = [];
      let stoppedEarly = false;
      let stoppedByRuleId: string | undefined;
      let rulesErrored = 0;

      const conflictResolution =
         options.conflictResolution ?? resolvedConfig.conflictResolution;

      for (const { rule, result } of evaluationResult) {
         await executeBeforeRuleEvaluation(
            resolvedConfig.hooks,
            rule,
            context,
            resolvedConfig.hookTimeoutMs,
         );

         ruleResults.push(result);

         if (result.error) {
            rulesErrored++;
            await executeOnRuleError(
               resolvedConfig.hooks,
               rule,
               result.error,
               resolvedConfig.hookTimeoutMs,
            );
            if (!resolvedConfig.continueOnError) {
               break;
            }
         }

         if (result.skipped) {
            await executeOnRuleSkip(
               resolvedConfig.hooks,
               rule,
               result.skipReason ?? "Unknown",
               resolvedConfig.hookTimeoutMs,
            );
         }

         if (result.evaluationTimeMs > resolvedConfig.slowRuleThresholdMs) {
            await executeOnSlowRule(
               resolvedConfig.hooks,
               rule,
               result.evaluationTimeMs,
               resolvedConfig.slowRuleThresholdMs,
               resolvedConfig.hookTimeoutMs,
            );
         }

         await executeAfterRuleEvaluation(
            resolvedConfig.hooks,
            rule,
            result,
            resolvedConfig.hookTimeoutMs,
         );

         if (result.matched) {
            matchedRules.push(rule);

            for (const consequence of result.consequences) {
               consequences.push(consequence);
               await executeOnConsequenceCollected(
                  resolvedConfig.hooks,
                  rule,
                  consequence,
                  resolvedConfig.hookTimeoutMs,
               );
            }

            await executeOnRuleMatch(
               resolvedConfig.hooks,
               rule,
               context,
               resolvedConfig.hookTimeoutMs,
            );

            if (rule.stopOnMatch) {
               stoppedEarly = true;
               stoppedByRuleId = rule.id;
               break;
            }

            if (conflictResolution === "first-match") {
               stoppedEarly = true;
               stoppedByRuleId = rule.id;
               break;
            }
         }
      }

      totalEvaluations++;
      totalMatches += matchedRules.length;
      totalErrors += rulesErrored;
      totalEvaluationTime += durationMs;

      const executionResult: EngineExecutionResult<TContext, TConsequences> = {
         context,
         results: ruleResults,
         matchedRules,
         consequences,
         totalRulesEvaluated: ruleResults.length,
         totalRulesMatched: matchedRules.length,
         totalRulesSkipped: ruleResults.filter((r) => r.skipped).length,
         totalRulesErrored: rulesErrored,
         executionTimeMs: durationMs,
         stoppedEarly,
         stoppedByRuleId,
         cacheHit: false,
      };

      if (cacheKey) {
         cache.set(cacheKey, executionResult);
      }

      await executeAfterEvaluation(
         resolvedConfig.hooks,
         executionResult,
         resolvedConfig.hookTimeoutMs,
      );

      return executionResult;
   };

   return {
      addRule: (input) => addRule(state, input),
      addRules: (inputs) => addRules(state, inputs),
      removeRule: (ruleId) => {
         const result = removeRule(state, ruleId);
         if (result) cache.clear();
         return result;
      },
      updateRule: (ruleId, updates) => {
         const result = updateRule(state, ruleId, updates);
         if (result) cache.clear();
         return result;
      },
      getRule: (ruleId) => getRule(state, ruleId),
      getRules: (filters) => getRules(state, filters),
      enableRule: (ruleId) => {
         const result = enableRule(state, ruleId);
         if (result) cache.clear();
         return result;
      },
      disableRule: (ruleId) => {
         const result = disableRule(state, ruleId);
         if (result) cache.clear();
         return result;
      },
      clearRules: () => {
         clearRules(state);
         cache.clear();
      },

      addRuleSet: (input) => addRuleSet(state, input),
      getRuleSet: (ruleSetId) => getRuleSet(state, ruleSetId),
      getRuleSets: () => getRuleSets(state),
      removeRuleSet: (ruleSetId) => removeRuleSet(state, ruleSetId),

      evaluate,

      clearCache: () => cache.clear(),
      getCacheStats: () => cache.getStats(),

      getState: () => ({
         rules: state.rules as ReadonlyMap<
            string,
            Rule<TContext, TConsequences>
         >,
         ruleSets: state.ruleSets as ReadonlyMap<string, RuleSet>,
         ruleOrder: state.ruleOrder,
      }),

      getStats: () => {
         const enabledRules = Array.from(state.rules.values()).filter(
            (r) => r.enabled,
         ).length;
         return {
            totalRules: state.rules.size,
            enabledRules,
            disabledRules: state.rules.size - enabledRules,
            totalRuleSets: state.ruleSets.size,
            totalEvaluations,
            totalMatches,
            totalErrors,
            avgEvaluationTimeMs:
               totalEvaluations > 0
                  ? totalEvaluationTime / totalEvaluations
                  : 0,
            cacheHits,
            cacheMisses,
            cacheHitRate:
               cacheHits + cacheMisses > 0
                  ? cacheHits / (cacheHits + cacheMisses)
                  : 0,
         };
      },
   };
};
