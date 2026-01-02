/**
 * Backward-compatible API for @packages/utils/duplicate-detection
 *
 * This module provides drop-in replacements for the legacy duplicate detection
 * functions, powered by the new condition-evaluator-based system.
 */

import {
   DEFAULT_DATE_TOLERANCE_DAYS,
   DEFAULT_MAX_SCORE,
   DEFAULT_THRESHOLD_PERCENTAGE,
   DEFAULT_WEIGHTS,
} from "./constants";
import {
   calculateJaccardSimilarity,
   datesWithinTolerance,
   extractDescriptionTokens,
} from "./evaluator";
import { matchTransactions } from "./matcher";
import { defaultProfile } from "./profiles/default";
import type {
   DuplicateDetectionTransaction,
   DuplicateScoreResult,
} from "./types";

// Re-export constants for backward compatibility
export const WEIGHTS = DEFAULT_WEIGHTS;
export const MAX_SCORE = DEFAULT_MAX_SCORE;
export const THRESHOLD_PERCENTAGE = DEFAULT_THRESHOLD_PERCENTAGE;
export const DATE_TOLERANCE_DAYS = DEFAULT_DATE_TOLERANCE_DAYS;

// Re-export utility functions
export { extractDescriptionTokens, datesWithinTolerance };

/**
 * Calculates token similarity using Jaccard coefficient.
 * @deprecated Use calculateJaccardSimilarity from @packages/reconciliation/operators
 */
export function calculateTokenSimilarity(
   tokens1: string[],
   tokens2: string[],
): number {
   return calculateJaccardSimilarity(tokens1, tokens2);
}

/**
 * Calculates duplicate score between two transactions.
 * Backward-compatible with @packages/utils/duplicate-detection.
 */
export function calculateDuplicateScore(
   candidate: DuplicateDetectionTransaction,
   target: DuplicateDetectionTransaction,
): DuplicateScoreResult {
   const result = matchTransactions(candidate, target, defaultProfile);

   return {
      score: result.totalScore,
      scorePercentage: result.scorePercentage,
      passed: result.passed,
   };
}
