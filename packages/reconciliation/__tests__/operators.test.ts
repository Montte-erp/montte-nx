import { describe, expect, it } from "bun:test";
import {
	extractDescriptionTokens,
	calculateJaccardSimilarity,
	datesWithinTolerance,
} from "../src/evaluator";

describe("jaccard-similarity", () => {
	describe("extractDescriptionTokens", () => {
		it("removes stop words", () => {
			const tokens = extractDescriptionTokens("PIX para João da Silva");
			expect(tokens).not.toContain("para");
			expect(tokens).not.toContain("da");
			expect(tokens).toContain("pix");
			expect(tokens).toContain("joão");
			expect(tokens).toContain("silva");
		});

		it("filters short tokens", () => {
			const tokens = extractDescriptionTokens("a bc def ghij");
			expect(tokens).not.toContain("a");
			expect(tokens).not.toContain("bc");
			expect(tokens).toContain("def");
			expect(tokens).toContain("ghij");
		});

		it("preserves accented characters", () => {
			const tokens = extractDescriptionTokens("Pagamento João São Paulo");
			expect(tokens).toContain("pagamento");
			expect(tokens).toContain("joão");
			expect(tokens).toContain("são");
			expect(tokens).toContain("paulo");
		});

		it("removes special characters", () => {
			const tokens = extractDescriptionTokens("PIX - Transferência #123");
			expect(tokens).toContain("pix");
			expect(tokens).toContain("transferência");
			expect(tokens).not.toContain("-");
			expect(tokens).not.toContain("#");
		});
	});

	describe("calculateJaccardSimilarity", () => {
		it("returns 1 for identical sets", () => {
			const tokens = ["pix", "transferencia", "banco"];
			expect(calculateJaccardSimilarity(tokens, tokens)).toBe(1);
		});

		it("returns 0 for disjoint sets", () => {
			const a = ["pix", "transferencia"];
			const b = ["boleto", "pagamento"];
			expect(calculateJaccardSimilarity(a, b)).toBe(0);
		});

		it("handles empty arrays", () => {
			expect(calculateJaccardSimilarity([], ["test"])).toBe(0);
			expect(calculateJaccardSimilarity(["test"], [])).toBe(0);
			expect(calculateJaccardSimilarity([], [])).toBe(0);
		});

		it("calculates partial overlap correctly", () => {
			const a = ["pix", "transferencia", "banco"];
			const b = ["pix", "transferencia", "pagamento"];
			// Intersection: 2 (pix, transferencia), Union: 4
			expect(calculateJaccardSimilarity(a, b)).toBe(0.5);
		});
	});
});

describe("date-tolerance", () => {
	describe("datesWithinTolerance", () => {
		it("returns true for same date", () => {
			const date = new Date("2024-01-15");
			expect(datesWithinTolerance(date, date, 1)).toBe(true);
		});

		it("returns true for dates within tolerance", () => {
			const date1 = new Date("2024-01-15");
			const date2 = new Date("2024-01-16");
			expect(datesWithinTolerance(date1, date2, 1)).toBe(true);
		});

		it("returns false for dates outside tolerance", () => {
			const date1 = new Date("2024-01-15");
			const date2 = new Date("2024-01-18");
			expect(datesWithinTolerance(date1, date2, 1)).toBe(false);
		});

		it("respects custom tolerance", () => {
			const date1 = new Date("2024-01-15");
			const date2 = new Date("2024-01-18");
			expect(datesWithinTolerance(date1, date2, 3)).toBe(true);
			expect(datesWithinTolerance(date1, date2, 2)).toBe(false);
		});

		it("works with time components", () => {
			const date1 = new Date("2024-01-15T10:00:00");
			const date2 = new Date("2024-01-16T08:00:00");
			// Less than 24 hours apart
			expect(datesWithinTolerance(date1, date2, 1)).toBe(true);
		});
	});
});
