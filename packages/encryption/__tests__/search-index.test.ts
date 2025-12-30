import { describe, expect, it } from "bun:test";
import {
	createSearchIndex,
	createSearchTokens,
	generateSearchKey,
} from "../src/search-index";

const TEST_SEARCH_KEY =
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("search-index", () => {
	describe("generateSearchKey", () => {
		it("should generate a 64-character hex string", () => {
			const key = generateSearchKey();
			expect(key).toHaveLength(64);
			expect(/^[0-9a-f]+$/.test(key)).toBe(true);
		});

		it("should generate unique keys", () => {
			const key1 = generateSearchKey();
			const key2 = generateSearchKey();
			expect(key1).not.toBe(key2);
		});
	});

	describe("createSearchTokens", () => {
		it("should return empty array for empty input", () => {
			expect(createSearchTokens("", TEST_SEARCH_KEY)).toEqual([]);
		});

		it("should return empty array for null/undefined input", () => {
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchTokens(null as any, TEST_SEARCH_KEY)).toEqual([]);
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchTokens(undefined as any, TEST_SEARCH_KEY)).toEqual([]);
		});

		it("should return empty array for empty search key", () => {
			expect(createSearchTokens("test", "")).toEqual([]);
		});

		it("should return empty array for null/undefined search key", () => {
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchTokens("test", null as any)).toEqual([]);
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchTokens("test", undefined as any)).toEqual([]);
		});

		it("should produce deterministic tokens", () => {
			const tokens1 = createSearchTokens("hello world", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("hello world", TEST_SEARCH_KEY);
			expect(tokens1).toEqual(tokens2);
		});

		it("should produce different tokens for different inputs", () => {
			const tokens1 = createSearchTokens("hello", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("world", TEST_SEARCH_KEY);
			expect(tokens1).not.toEqual(tokens2);
		});

		it("should produce different tokens with different keys", () => {
			const key2 =
				"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
			const tokens1 = createSearchTokens("test", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("test", key2);
			expect(tokens1).not.toEqual(tokens2);
		});

		it("should be case insensitive", () => {
			const tokens1 = createSearchTokens("Hello World", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("hello world", TEST_SEARCH_KEY);
			expect(tokens1).toEqual(tokens2);
		});

		it("should handle accented characters (normalize to ASCII)", () => {
			const tokens1 = createSearchTokens("café", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("cafe", TEST_SEARCH_KEY);
			expect(tokens1).toEqual(tokens2);
		});

		it("should handle unicode characters", () => {
			const tokens1 = createSearchTokens("naïve résumé", TEST_SEARCH_KEY);
			const tokens2 = createSearchTokens("naive resume", TEST_SEARCH_KEY);
			expect(tokens1).toEqual(tokens2);
		});

		it("should generate word tokens", () => {
			const tokens = createSearchTokens("hello world", TEST_SEARCH_KEY);
			// Should have at least: full text, "hello", "world", "hel", "wor"
			expect(tokens.length).toBeGreaterThanOrEqual(5);
		});

		it("should generate prefix tokens for words >= 3 chars", () => {
			const tokens = createSearchTokens("payment", TEST_SEARCH_KEY);
			// Should include: full text "payment", word "payment", prefix "pay"
			expect(tokens.length).toBeGreaterThanOrEqual(2);
		});

		it("should not generate prefix tokens for short words", () => {
			const tokens = createSearchTokens("ab", TEST_SEARCH_KEY);
			// Should have: full text "ab"
			expect(tokens.length).toBe(1);
		});
	});

	describe("createSearchIndex", () => {
		it("should return space-separated string of tokens", () => {
			const index = createSearchIndex("hello world", TEST_SEARCH_KEY);
			expect(typeof index).toBe("string");
			expect(index.length).toBeGreaterThan(0);
			// Each token is 16 chars (first 64 bits of HMAC-SHA256)
			const indexTokens = index.split(" ");
			expect(indexTokens.every((t) => t.length === 16)).toBe(true);
		});

		it("should return empty string for empty input", () => {
			expect(createSearchIndex("", TEST_SEARCH_KEY)).toBe("");
		});

		it("should return empty string for null/undefined input", () => {
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchIndex(null as any, TEST_SEARCH_KEY)).toBe("");
			// biome-ignore lint/suspicious/noExplicitAny: Testing invalid input type
			expect(createSearchIndex(undefined as any, TEST_SEARCH_KEY)).toBe("");
		});

		it("should be searchable by exact word matching", () => {
			const index = createSearchIndex(
				"Electric Bill Payment",
				TEST_SEARCH_KEY,
			);
			const searchTokens = createSearchTokens("electric", TEST_SEARCH_KEY);

			// At least one search token should be found in the index
			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(true);
		});

		it("should be searchable by full phrase matching", () => {
			const index = createSearchIndex(
				"Electric Bill Payment",
				TEST_SEARCH_KEY,
			);
			const searchTokens = createSearchTokens(
				"Electric Bill Payment",
				TEST_SEARCH_KEY,
			);

			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(true);
		});

		it("should support partial word search via prefix", () => {
			const index = createSearchIndex("Payment", TEST_SEARCH_KEY);
			const searchTokens = createSearchTokens("pay", TEST_SEARCH_KEY);

			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(true);
		});

		it("should be case insensitive for search", () => {
			const index = createSearchIndex("ELECTRIC BILL", TEST_SEARCH_KEY);
			const searchTokens = createSearchTokens("electric", TEST_SEARCH_KEY);

			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(true);
		});

		it("should not match unrelated terms", () => {
			const index = createSearchIndex("Electric Bill", TEST_SEARCH_KEY);
			const searchTokens = createSearchTokens("grocery", TEST_SEARCH_KEY);

			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(false);
		});

		it("should work with accented characters", () => {
			const index = createSearchIndex("Café Expense", TEST_SEARCH_KEY);
			const searchTokens = createSearchTokens("cafe", TEST_SEARCH_KEY);

			const found = searchTokens.some((token) => index.includes(token));
			expect(found).toBe(true);
		});
	});

	describe("security properties", () => {
		it("should produce fixed-length tokens (16 chars)", () => {
			const shortInput = createSearchTokens("a", TEST_SEARCH_KEY);
			const longInput = createSearchTokens(
				"a very long description with many words",
				TEST_SEARCH_KEY,
			);

			// All tokens should be 16 characters regardless of input length
			for (const token of shortInput) {
				expect(token).toHaveLength(16);
			}
			for (const token of longInput) {
				expect(token).toHaveLength(16);
			}
		});

		it("should produce hex-only tokens", () => {
			const tokens = createSearchTokens("test value", TEST_SEARCH_KEY);

			for (const token of tokens) {
				expect(/^[0-9a-f]+$/.test(token)).toBe(true);
			}
		});

		it("should not be reversible (tokens do not contain plaintext)", () => {
			const tokens = createSearchTokens("sensitive data", TEST_SEARCH_KEY);

			for (const token of tokens) {
				expect(token).not.toContain("sensitive");
				expect(token).not.toContain("data");
			}
		});
	});
});
