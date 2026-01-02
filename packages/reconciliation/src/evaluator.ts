import { createEvaluator, createOperator } from "@f-o-t/condition-evaluator";
import { z } from "zod";
import {
	SPECIAL_CHARS_REGEX,
	STOP_WORDS,
	DEFAULT_DATE_TOLERANCE_DAYS,
} from "./constants";

// =============================================================================
// Jaccard Similarity Helpers
// =============================================================================

/**
 * Extracts key tokens from description for similarity matching.
 * Removes common stop words and normalizes text.
 */
export function extractDescriptionTokens(description: string): string[] {
	return description
		.toLowerCase()
		.replace(SPECIAL_CHARS_REGEX, " ")
		.split(/\s+/)
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Calculates Jaccard similarity between two sets of tokens.
 * Returns a value between 0 and 1.
 */
export function calculateJaccardSimilarity(
	tokens1: string[],
	tokens2: string[],
): number {
	if (tokens1.length === 0 || tokens2.length === 0) return 0;

	const set1 = new Set(tokens1);
	const set2 = new Set(tokens2);

	let intersectionSize = 0;
	for (const token of set1) {
		if (set2.has(token)) intersectionSize++;
	}

	const unionSize = set1.size + set2.size - intersectionSize;
	if (unionSize === 0) return 0;

	return intersectionSize / unionSize;
}

// =============================================================================
// Date Tolerance Helpers
// =============================================================================

/**
 * Checks if two dates are within the specified tolerance.
 */
export function datesWithinTolerance(
	date1: Date,
	date2: Date,
	toleranceDays = DEFAULT_DATE_TOLERANCE_DAYS,
): boolean {
	const diffMs = Math.abs(date1.getTime() - date2.getTime());
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays <= toleranceDays;
}

// =============================================================================
// Options Schemas
// =============================================================================

export const JaccardOptionsSchema = z.object({
	minSimilarity: z.number().min(0).max(1).optional(),
	tokenize: z.boolean().optional(),
	weight: z.number().min(0).optional(),
	negate: z.boolean().optional(),
});

export type JaccardOptions = z.infer<typeof JaccardOptionsSchema>;

export const DateToleranceOptionsSchema = z.object({
	toleranceDays: z.number().min(0).optional(),
	weight: z.number().min(0).optional(),
	negate: z.boolean().optional(),
});

export type DateToleranceOptions = z.infer<typeof DateToleranceOptionsSchema>;

// =============================================================================
// Configured Evaluator
// =============================================================================

/**
 * Configured evaluator with reconciliation-specific operators
 */
export const reconciliationEvaluator = createEvaluator({
	operators: {
		jaccard_similarity: createOperator({
			name: "jaccard_similarity",
			type: "custom",
			description:
				"Compares string similarity using Jaccard index on tokenized descriptions",
			evaluate: (
				currentValue: unknown,
				expectedValue: unknown,
				options?: JaccardOptions,
			): boolean => {
				const current = String(currentValue ?? "");
				const expected = String(expectedValue ?? "");
				const minSimilarity = options?.minSimilarity ?? 0.5;
				const shouldTokenize = options?.tokenize ?? true;

				let similarity: number;

				if (shouldTokenize) {
					const currentTokens = extractDescriptionTokens(current);
					const expectedTokens = extractDescriptionTokens(expected);
					similarity = calculateJaccardSimilarity(currentTokens, expectedTokens);
				} else {
					const currentChars = current.toLowerCase().split("");
					const expectedChars = expected.toLowerCase().split("");
					similarity = calculateJaccardSimilarity(currentChars, expectedChars);
				}

				return similarity >= minSimilarity;
			},
			valueSchema: z.string(),
			optionsSchema: JaccardOptionsSchema,
			reasonGenerator: (
				passed: boolean,
				currentValue: unknown,
				expectedValue: unknown,
				_field: string,
			): string => {
				const current = String(currentValue ?? "").substring(0, 30);
				const expected = String(expectedValue ?? "").substring(0, 30);
				return passed
					? `Description "${current}..." is similar to "${expected}..."`
					: `Description "${current}..." is not similar to "${expected}..."`;
			},
		}),
		date_tolerance: createOperator({
			name: "date_tolerance",
			type: "custom",
			description:
				"Checks if two dates are within a specified tolerance in days",
			evaluate: (
				currentValue: unknown,
				expectedValue: unknown,
				options?: DateToleranceOptions,
			): boolean => {
				const toleranceDays =
					options?.toleranceDays ?? DEFAULT_DATE_TOLERANCE_DAYS;

				const current =
					currentValue instanceof Date
						? currentValue
						: new Date(String(currentValue));
				const expected =
					expectedValue instanceof Date
						? expectedValue
						: new Date(String(expectedValue));

				if (
					Number.isNaN(current.getTime()) ||
					Number.isNaN(expected.getTime())
				) {
					return false;
				}

				return datesWithinTolerance(current, expected, toleranceDays);
			},
			valueSchema: z.union([z.date(), z.string()]),
			optionsSchema: DateToleranceOptionsSchema,
			reasonGenerator: (
				passed: boolean,
				currentValue: unknown,
				expectedValue: unknown,
				_field: string,
			): string => {
				const format = (v: unknown) => {
					const d = v instanceof Date ? v : new Date(String(v));
					return d.toISOString().split("T")[0];
				};
				return passed
					? `Date ${format(currentValue)} is within tolerance of ${format(expectedValue)}`
					: `Date ${format(currentValue)} is outside tolerance of ${format(expectedValue)}`;
			},
		}),
	},
});

export type ReconciliationEvaluator = typeof reconciliationEvaluator;
