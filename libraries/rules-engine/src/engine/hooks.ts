import type { EngineHooks } from "../types/config";
import type {
   AggregatedConsequence,
   ConsequenceDefinitions,
   DefaultConsequences,
} from "../types/consequence";
import type {
   EngineExecutionResult,
   EvaluationContext,
   RuleEvaluationResult,
} from "../types/evaluation";
import type { Rule } from "../types/rule";
import { withTimeout } from "../utils/time";

const toError = (error: unknown): Error =>
   error instanceof Error ? error : new Error(String(error));

const executeWithTimeout = async (
   hookName: string,
   hookFn: () => void | Promise<void>,
   hooks: EngineHooks<unknown, ConsequenceDefinitions>,
   timeoutMs?: number,
): Promise<void> => {
   try {
      const promise = Promise.resolve(hookFn());
      if (timeoutMs !== undefined && timeoutMs > 0) {
         await withTimeout(
            promise,
            timeoutMs,
            `Hook '${hookName}' timed out after ${timeoutMs}ms`,
         );
      } else {
         await promise;
      }
   } catch (error) {
      hooks.onHookError?.(hookName, toError(error));
   }
};

export const executeBeforeEvaluation = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   context: EvaluationContext<TContext>,
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.beforeEvaluation) return;
   await executeWithTimeout(
      "beforeEvaluation",
      () => hooks.beforeEvaluation?.(context, rules),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeAfterEvaluation = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   result: EngineExecutionResult<TContext, TConsequences>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.afterEvaluation) return;
   await executeWithTimeout(
      "afterEvaluation",
      () => hooks.afterEvaluation?.(result),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeBeforeRuleEvaluation = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   context: EvaluationContext<TContext>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.beforeRuleEvaluation) return;
   await executeWithTimeout(
      "beforeRuleEvaluation",
      () => hooks.beforeRuleEvaluation?.(rule, context),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeAfterRuleEvaluation = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   result: RuleEvaluationResult<TContext, TConsequences>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.afterRuleEvaluation) return;
   await executeWithTimeout(
      "afterRuleEvaluation",
      () => hooks.afterRuleEvaluation?.(rule, result),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnRuleMatch = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   context: EvaluationContext<TContext>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onRuleMatch) return;
   await executeWithTimeout(
      "onRuleMatch",
      () => hooks.onRuleMatch?.(rule, context),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnRuleSkip = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   reason: string,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onRuleSkip) return;
   await executeWithTimeout(
      "onRuleSkip",
      () => hooks.onRuleSkip?.(rule, reason),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnRuleError = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   ruleError: Error,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onRuleError) return;
   await executeWithTimeout(
      "onRuleError",
      () => hooks.onRuleError?.(rule, ruleError),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnConsequenceCollected = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   consequence: AggregatedConsequence<TConsequences>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onConsequenceCollected) return;
   await executeWithTimeout(
      "onConsequenceCollected",
      () => hooks.onConsequenceCollected?.(rule, consequence),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnCacheHit = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   key: string,
   result: EngineExecutionResult<TContext, TConsequences>,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onCacheHit) return;
   await executeWithTimeout(
      "onCacheHit",
      () => hooks.onCacheHit?.(key, result),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnCacheMiss = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   key: string,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onCacheMiss) return;
   await executeWithTimeout(
      "onCacheMiss",
      () => hooks.onCacheMiss?.(key),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};

export const executeOnSlowRule = async <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   hooks: EngineHooks<TContext, TConsequences>,
   rule: Rule<TContext, TConsequences>,
   timeMs: number,
   threshold: number,
   timeoutMs?: number,
): Promise<void> => {
   if (!hooks.onSlowRule) return;
   await executeWithTimeout(
      "onSlowRule",
      () => hooks.onSlowRule?.(rule, timeMs, threshold),
      hooks as EngineHooks<unknown, ConsequenceDefinitions>,
      timeoutMs,
   );
};
