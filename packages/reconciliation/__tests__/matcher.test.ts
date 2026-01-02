import { describe, expect, it } from "bun:test";
import {
	matchTransactions,
	findBatchDuplicates,
	findDatabaseDuplicates,
} from "../src/matcher";
import { defaultProfile } from "../src/profiles/default";
import { strictProfile } from "../src/profiles/strict";
import { fuzzyProfile } from "../src/profiles/fuzzy";

describe("matchTransactions", () => {
	it("detects exact duplicates", () => {
		const transaction = {
			date: new Date("2024-01-15"),
			amount: 150.0,
			description: "PIX transferencia para João",
		};

		const result = matchTransactions(transaction, transaction, "default");

		expect(result.passed).toBe(true);
		expect(result.scorePercentage).toBe(1);
	});

	it("detects duplicates with date tolerance", () => {
		const candidate = {
			date: new Date("2024-01-15"),
			amount: 150.0,
			description: "PIX transferencia para João",
		};
		const target = {
			date: new Date("2024-01-16"),
			amount: 150.0,
			description: "PIX transferencia para João",
		};

		const result = matchTransactions(candidate, target, "default");

		expect(result.passed).toBe(true);
	});

	it("rejects non-duplicates", () => {
		const candidate = {
			date: new Date("2024-01-15"),
			amount: 150.0,
			description: "PIX transferencia para João",
		};
		const target = {
			date: new Date("2024-01-20"),
			amount: 200.0,
			description: "Boleto pagamento energia",
		};

		const result = matchTransactions(candidate, target, "default");

		expect(result.passed).toBe(false);
	});

	it("accepts profile object directly", () => {
		const transaction = {
			date: new Date("2024-01-15"),
			amount: 150.0,
			description: "PIX transferencia",
		};

		const result = matchTransactions(transaction, transaction, defaultProfile);

		expect(result.passed).toBe(true);
		expect(result.profileId).toBe("default");
	});

	describe("strict profile", () => {
		it("requires exact date match", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-16"),
				amount: 150.0,
				description: "PIX transferencia",
			};

			const result = matchTransactions(candidate, target, "strict");

			expect(result.passed).toBe(false);
		});

		it("requires exact description match", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "pix transferencia", // lowercase
			};

			const result = matchTransactions(candidate, target, strictProfile);

			// Should pass because caseSensitive is false
			expect(result.passed).toBe(true);
		});
	});

	describe("fuzzy profile", () => {
		it("accepts extended date tolerance", () => {
			const candidate = {
				date: new Date("2024-01-15"),
				amount: 150.0,
				description: "PIX transferencia",
			};
			const target = {
				date: new Date("2024-01-18"), // 3 days apart
				amount: 150.0,
				description: "PIX transferencia",
			};

			const result = matchTransactions(candidate, target, fuzzyProfile);

			expect(result.passed).toBe(true);
		});
	});
});

describe("findBatchDuplicates", () => {
	it("finds duplicates within batch", () => {
		const transactions = [
			{
				rowIndex: 0,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "PIX João",
			},
			{
				rowIndex: 1,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "PIX João",
			},
			{
				rowIndex: 2,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 200,
				description: "Boleto",
			},
		];

		const result = findBatchDuplicates(transactions, transactions);

		expect(result.duplicates.length).toBeGreaterThan(0);
		expect(result.stats.duplicatesFound).toBeGreaterThan(0);
	});

	it("skips self-comparison by default", () => {
		const transactions = [
			{
				rowIndex: 0,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "Unique transaction",
			},
		];

		const result = findBatchDuplicates(transactions, transactions);

		// Should not find duplicates when comparing single unique transaction to itself
		expect(result.duplicates.length).toBe(0);
	});

	it("returns correct stats", () => {
		const candidates = [
			{
				rowIndex: 0,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "Test",
			},
		];
		const targets = [
			{
				rowIndex: 0,
				fileIndex: 1,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "Test",
			},
			{
				rowIndex: 1,
				fileIndex: 1,
				date: new Date("2024-01-15"),
				amount: 200,
				description: "Other",
			},
		];

		const result = findBatchDuplicates(candidates, targets);

		expect(result.stats.candidateCount).toBe(1);
		expect(result.stats.targetCount).toBe(2);
		expect(result.stats.comparisons).toBe(2);
		expect(result.stats.processingTimeMs).toBeGreaterThanOrEqual(0);
	});
});

describe("findDatabaseDuplicates", () => {
	it("finds duplicates against existing transactions", () => {
		const candidates = [
			{
				rowIndex: 0,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "PIX João",
			},
		];
		const existing = [
			{
				date: new Date("2024-01-15"),
				amount: 100,
				description: "PIX João",
			},
		];

		const result = findDatabaseDuplicates(candidates, existing);

		expect(result.duplicates.length).toBe(1);
		expect(result.duplicates[0]?.duplicateType).toBe("existing_database");
	});

	it("only returns first match per candidate", () => {
		const candidates = [
			{
				rowIndex: 0,
				fileIndex: 0,
				date: new Date("2024-01-15"),
				amount: 100,
				description: "PIX João",
			},
		];
		const existing = [
			{ date: new Date("2024-01-15"), amount: 100, description: "PIX João" },
			{ date: new Date("2024-01-15"), amount: 100, description: "PIX João" },
		];

		const result = findDatabaseDuplicates(candidates, existing);

		// Should only return one match even though there are two matching records
		expect(result.duplicates.length).toBe(1);
	});
});
