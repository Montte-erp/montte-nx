import { describe, expect, it } from "bun:test";
import {
	calculateDuplicateScore,
	calculateTokenSimilarity,
	WEIGHTS,
	MAX_SCORE,
	THRESHOLD_PERCENTAGE,
	DATE_TOLERANCE_DAYS,
} from "../src/duplicate-detection";
import {
	extractDescriptionTokens,
	datesWithinTolerance,
} from "../src/evaluator";

describe("backward compatibility", () => {
	describe("constants", () => {
		it("exports correct WEIGHTS", () => {
			expect(WEIGHTS).toEqual({ amount: 3, date: 2, description: 1 });
		});

		it("exports correct MAX_SCORE", () => {
			expect(MAX_SCORE).toBe(6);
		});

		it("exports correct THRESHOLD_PERCENTAGE", () => {
			expect(THRESHOLD_PERCENTAGE).toBe(0.8);
		});

		it("exports correct DATE_TOLERANCE_DAYS", () => {
			expect(DATE_TOLERANCE_DAYS).toBe(1);
		});
	});

	describe("calculateDuplicateScore", () => {
		it("returns perfect score for identical transactions", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia para João",
			};
			const target = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia para João",
			};

			const result = calculateDuplicateScore(candidate, target);

			expect(result.passed).toBe(true);
			expect(result.scorePercentage).toBeCloseTo(1, 1);
			expect(result.score).toBeCloseTo(MAX_SCORE, 1);
		});

		it("passes with 80% threshold", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia", // Same description
			};

			const result = calculateDuplicateScore(candidate, target);

			expect(result.passed).toBe(true);
			expect(result.scorePercentage).toBeGreaterThanOrEqual(0.8);
		});

		it("fails for different amounts", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-15"),
				amount: 200.0, // Different amount
				description: "PIX transferencia",
			};

			const result = calculateDuplicateScore(candidate, target);

			// Without amount match (3 points), score is 3/6 = 50%
			expect(result.passed).toBe(false);
		});

		it("fails for dates outside tolerance", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-20"), // 5 days apart
				amount: 150.0,
				description: "PIX transferencia",
			};

			const result = calculateDuplicateScore(candidate, target);

			// Without date match (2 points), score is 4/6 = 66.7%
			expect(result.passed).toBe(false);
		});
	});

	describe("utility functions", () => {
		it("calculateTokenSimilarity works correctly", () => {
			const tokens1 = ["pix", "transferencia"];
			const tokens2 = ["pix", "transferencia"];

			expect(calculateTokenSimilarity(tokens1, tokens2)).toBe(1);
		});

		it("extractDescriptionTokens is exported", () => {
			const tokens = extractDescriptionTokens("PIX para João");
			expect(tokens).toContain("pix");
			expect(tokens).toContain("joão");
		});

		it("datesWithinTolerance is exported", () => {
			const date1 = new Date("2024-01-15");
			const date2 = new Date("2024-01-16");
			expect(datesWithinTolerance(date1, date2, 1)).toBe(true);
		});
	});
});
