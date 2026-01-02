import type {
   ConditionGroup,
   GroupEvaluationResult,
} from "@f-o-t/condition-evaluator";
import { z } from "zod";

// =============================================================================
// Transaction Types
// =============================================================================

/**
 * Minimal transaction interface for duplicate detection.
 * Backward-compatible with existing DuplicateDetectionTransaction.
 */
export interface ReconciliationTransaction {
   date: Date;
   amount: number;
   description: string;
   /** Optional external ID (e.g., OFX FITID) for exact matching */
   externalId?: string;
   /** Optional bank account identifier */
   bankAccountId?: string;
}

/**
 * Extended transaction with metadata for batch processing
 */
export interface BatchTransaction extends ReconciliationTransaction {
   rowIndex: number;
   fileIndex: number;
   filename?: string;
}

// =============================================================================
// Profile Types
// =============================================================================

/**
 * Reconciliation profile defining matching behavior
 */
export interface ReconciliationProfile {
   /** Unique profile identifier */
   id: string;
   /** Human-readable name */
   name: string;
   /** Description of when to use this profile */
   description: string;
   /** The condition group defining match criteria */
   conditionGroup: ConditionGroup;
   /** Threshold for considering a match (0-1) */
   threshold: number;
   /** Optional bank-specific identifier */
   bankId?: string;
}

export const ReconciliationProfileSchema = z.object({
   id: z.string(),
   name: z.string(),
   description: z.string(),
   conditionGroup: z.custom<ConditionGroup>(),
   threshold: z.number().min(0).max(1),
   bankId: z.string().optional(),
});

// =============================================================================
// Match Result Types
// =============================================================================

/**
 * Result of comparing two transactions
 */
export interface MatchResult {
   /** Whether the transactions are considered duplicates */
   passed: boolean;
   /** Score as a percentage (0-1) */
   scorePercentage: number;
   /** Raw score value */
   totalScore: number;
   /** Maximum possible score */
   maxPossibleScore: number;
   /** Threshold used for this match */
   threshold: number;
   /** Profile used for matching */
   profileId: string;
   /** Detailed evaluation result from condition-evaluator */
   evaluation: GroupEvaluationResult;
}

/**
 * Duplicate detection result for a single transaction
 */
export interface DuplicateInfo {
   /** Index of the candidate transaction */
   candidateIndex: number;
   /** Index of the matched transaction */
   matchedIndex: number;
   /** Match result details */
   match: MatchResult;
   /** Type of duplicate */
   duplicateType: "within_batch" | "existing_database";
}

/**
 * Batch duplicate detection result
 */
export interface BatchDuplicateResult {
   /** Array of duplicate information */
   duplicates: DuplicateInfo[];
   /** Profile used for detection */
   profileId: string;
   /** Processing statistics */
   stats: {
      candidateCount: number;
      targetCount: number;
      comparisons: number;
      duplicatesFound: number;
      processingTimeMs: number;
   };
}

// =============================================================================
// Legacy Compatibility Types
// =============================================================================

/**
 * Backward-compatible with @packages/utils/duplicate-detection
 */
export interface DuplicateDetectionTransaction {
   date: Date;
   amount: number;
   description: string;
}

/**
 * Backward-compatible score result
 */
export interface DuplicateScoreResult {
   score: number;
   scorePercentage: number;
   passed: boolean;
}
