import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import type { ReconciliationProfile } from "../types";
import { DEFAULT_WEIGHTS, DEFAULT_MAX_SCORE } from "../constants";

/**
 * Fuzzy threshold percentage (66%)
 */
const FUZZY_THRESHOLD_PERCENTAGE = 0.66;

/**
 * Extended date tolerance for fuzzy matching (3 days)
 */
const FUZZY_DATE_TOLERANCE_DAYS = 3;

/**
 * Lower similarity threshold for fuzzy matching (30%)
 */
const FUZZY_SIMILARITY_THRESHOLD = 0.3;

/**
 * Fuzzy matching with lower threshold and extended date tolerance.
 * Used for detecting potential duplicates that may have slight variations.
 */
export const fuzzyConditionGroup: ConditionGroup = {
	id: "fuzzy-duplicate-detection",
	operator: "AND",
	scoringMode: "weighted",
	threshold: FUZZY_THRESHOLD_PERCENTAGE * DEFAULT_MAX_SCORE,
	conditions: [
		{
			id: "amount-match",
			type: "number",
			field: "candidate.amount",
			operator: "eq",
			valueRef: "target.amount",
			options: {
				weight: DEFAULT_WEIGHTS.amount,
			},
		},
		{
			id: "date-tolerance-extended",
			type: "custom",
			field: "candidate.date",
			operator: "date_tolerance",
			valueRef: "target.date",
			options: {
				toleranceDays: FUZZY_DATE_TOLERANCE_DAYS,
				weight: DEFAULT_WEIGHTS.date,
			},
		},
		{
			id: "description-fuzzy",
			type: "custom",
			field: "candidate.description",
			operator: "jaccard_similarity",
			valueRef: "target.description",
			options: {
				minSimilarity: FUZZY_SIMILARITY_THRESHOLD,
				tokenize: true,
				weight: DEFAULT_WEIGHTS.description,
			},
		},
	],
};

/**
 * Fuzzy profile for relaxed matching
 */
export const fuzzyProfile: ReconciliationProfile = {
	id: "fuzzy",
	name: "Fuzzy",
	description:
		"Relaxed matching with extended date tolerance (3 days) and lower similarity threshold",
	conditionGroup: fuzzyConditionGroup,
	threshold: FUZZY_THRESHOLD_PERCENTAGE,
};
