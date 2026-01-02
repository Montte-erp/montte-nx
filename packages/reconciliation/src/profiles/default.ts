import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import type { ReconciliationProfile } from "../types";
import {
	DEFAULT_THRESHOLD_PERCENTAGE,
	DEFAULT_WEIGHTS,
	DEFAULT_MAX_SCORE,
	DEFAULT_DATE_TOLERANCE_DAYS,
	DESCRIPTION_SIMILARITY_THRESHOLD,
} from "../constants";

/**
 * Default condition group for duplicate detection.
 * Matches the behavior of @packages/utils/duplicate-detection.
 */
export const defaultConditionGroup: ConditionGroup = {
	id: "default-duplicate-detection",
	operator: "AND",
	scoringMode: "weighted",
	threshold: DEFAULT_THRESHOLD_PERCENTAGE * DEFAULT_MAX_SCORE,
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
			id: "date-tolerance",
			type: "custom",
			field: "candidate.date",
			operator: "date_tolerance",
			valueRef: "target.date",
			options: {
				toleranceDays: DEFAULT_DATE_TOLERANCE_DAYS,
				weight: DEFAULT_WEIGHTS.date,
			},
		},
		{
			id: "description-similarity",
			type: "custom",
			field: "candidate.description",
			operator: "jaccard_similarity",
			valueRef: "target.description",
			options: {
				minSimilarity: DESCRIPTION_SIMILARITY_THRESHOLD,
				tokenize: true,
				weight: DEFAULT_WEIGHTS.description,
			},
		},
	],
};

/**
 * Default profile matching the legacy duplicate detection behavior
 */
export const defaultProfile: ReconciliationProfile = {
	id: "default",
	name: "Default",
	description: "Standard duplicate detection with 80% threshold",
	conditionGroup: defaultConditionGroup,
	threshold: DEFAULT_THRESHOLD_PERCENTAGE,
};
