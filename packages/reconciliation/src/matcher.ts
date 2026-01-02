import type {
	EvaluationContext,
	GroupEvaluationResult,
} from "@f-o-t/condition-evaluator";
import { reconciliationEvaluator } from "./evaluator";
import { getProfileOrThrow } from "./profiles/registry";
import type {
	ReconciliationTransaction,
	BatchTransaction,
	MatchResult,
	DuplicateInfo,
	BatchDuplicateResult,
	ReconciliationProfile,
} from "./types";

/**
 * Compare two transactions and return match result
 */
export function matchTransactions(
	candidate: ReconciliationTransaction,
	target: ReconciliationTransaction,
	profileOrId: ReconciliationProfile | string = "default",
): MatchResult {
	const profile =
		typeof profileOrId === "string"
			? getProfileOrThrow(profileOrId)
			: profileOrId;

	const context: EvaluationContext = {
		data: {
			candidate: {
				date: candidate.date,
				amount: candidate.amount,
				description: candidate.description,
				externalId: candidate.externalId,
			},
			target: {
				date: target.date,
				amount: target.amount,
				description: target.description,
				externalId: target.externalId,
			},
		},
	};

	const evaluation = reconciliationEvaluator.evaluateConditionGroup(
		profile.conditionGroup,
		context,
	) as GroupEvaluationResult;

	const scorePercentage = evaluation.scorePercentage ?? 0;
	const totalScore = evaluation.totalScore ?? 0;
	const maxPossibleScore = evaluation.maxPossibleScore ?? 0;

	return {
		passed: evaluation.passed,
		scorePercentage,
		totalScore,
		maxPossibleScore,
		threshold: profile.threshold,
		profileId: profile.id,
		evaluation,
	};
}

/**
 * Options for batch duplicate detection
 */
export interface FindBatchDuplicatesOptions {
	/** Profile to use for matching */
	profileOrId?: ReconciliationProfile | string;
	/** Skip self-comparison when comparing same array (default: true) */
	skipSameIndex?: boolean;
}

/**
 * Find duplicates within a batch of transactions
 */
export function findBatchDuplicates(
	candidates: BatchTransaction[],
	targets: BatchTransaction[],
	options: FindBatchDuplicatesOptions = {},
): BatchDuplicateResult {
	const startTime = performance.now();
	const { profileOrId = "default", skipSameIndex = true } = options;

	const profile =
		typeof profileOrId === "string"
			? getProfileOrThrow(profileOrId)
			: profileOrId;

	const duplicates: DuplicateInfo[] = [];
	let comparisons = 0;

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (!candidate) continue;

		for (let j = 0; j < targets.length; j++) {
			const target = targets[j];
			if (!target) continue;

			// Skip self-comparison if comparing same array
			if (skipSameIndex && i === j && candidates === targets) continue;

			comparisons++;
			const match = matchTransactions(candidate, target, profile);

			if (match.passed) {
				duplicates.push({
					candidateIndex: i,
					matchedIndex: j,
					match,
					duplicateType: "within_batch",
				});
			}
		}
	}

	const processingTimeMs = performance.now() - startTime;

	return {
		duplicates,
		profileId: profile.id,
		stats: {
			candidateCount: candidates.length,
			targetCount: targets.length,
			comparisons,
			duplicatesFound: duplicates.length,
			processingTimeMs,
		},
	};
}

/**
 * Find duplicates between candidates and database transactions
 */
export function findDatabaseDuplicates(
	candidates: BatchTransaction[],
	existingTransactions: ReconciliationTransaction[],
	profileOrId: ReconciliationProfile | string = "default",
): BatchDuplicateResult {
	const startTime = performance.now();

	const profile =
		typeof profileOrId === "string"
			? getProfileOrThrow(profileOrId)
			: profileOrId;

	const duplicates: DuplicateInfo[] = [];
	let comparisons = 0;

	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (!candidate) continue;

		for (let j = 0; j < existingTransactions.length; j++) {
			const existing = existingTransactions[j];
			if (!existing) continue;

			comparisons++;
			const match = matchTransactions(candidate, existing, profile);

			if (match.passed) {
				duplicates.push({
					candidateIndex: i,
					matchedIndex: j,
					match,
					duplicateType: "existing_database",
				});
				// Only keep first match per candidate
				break;
			}
		}
	}

	const processingTimeMs = performance.now() - startTime;

	return {
		duplicates,
		profileId: profile.id,
		stats: {
			candidateCount: candidates.length,
			targetCount: existingTransactions.length,
			comparisons,
			duplicatesFound: duplicates.length,
			processingTimeMs,
		},
	};
}
