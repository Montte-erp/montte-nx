/**
 * Search Index Module for Blind Index Encryption
 *
 * Provides searchable encryption using HMAC-SHA256 blind indexes.
 * Allows server-side search on encrypted fields without decryption.
 *
 * How it works:
 * 1. Plaintext is tokenized (full text, words, and 3-char prefixes)
 * 2. Each token is hashed with HMAC-SHA256 using SEARCH_KEY
 * 3. Hashes are stored in a search_index column
 * 4. Search queries hash the search term and match against stored hashes
 */

import { createHmac } from "node:crypto";

const MIN_PREFIX_LENGTH = 3;

/**
 * Normalizes text for consistent tokenization
 * - Converts to lowercase
 * - Removes diacritics (accents)
 * - Trims whitespace
 */
function normalizeForSearch(text: string): string {
	if (!text) return "";
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

/**
 * Hashes a token using HMAC-SHA256
 * Returns a 16-character hex string (first 64 bits) for storage efficiency
 */
function hashToken(token: string, searchKey: string): string {
	const hmac = createHmac("sha256", Buffer.from(searchKey, "hex"));
	hmac.update(token);
	return hmac.digest("hex").slice(0, 16);
}

/**
 * Extracts searchable tokens from text
 * Returns: [fullText, ...words, ...prefixes]
 */
function tokenize(text: string): string[] {
	const normalized = normalizeForSearch(text);
	if (!normalized) return [];

	const tokens = new Set<string>();

	// Add full normalized text
	tokens.add(normalized);

	// Split into words and add each word + prefixes
	const words = normalized.split(/\s+/).filter((w) => w.length >= 1);
	for (const word of words) {
		tokens.add(word);

		// Add prefix (3+ chars) for partial matching
		if (word.length >= MIN_PREFIX_LENGTH) {
			tokens.add(word.slice(0, MIN_PREFIX_LENGTH));
		}
	}

	return Array.from(tokens);
}

/**
 * Creates search tokens from text using HMAC-SHA256
 * Used for both indexing and searching
 *
 * @param text - The plaintext to tokenize
 * @param searchKey - 64-character hex string (32 bytes)
 * @returns Array of hashed tokens
 */
export function createSearchTokens(text: string, searchKey: string): string[] {
	if (!text || !searchKey) return [];

	const tokens = tokenize(text);
	return tokens.map((token) => hashToken(token, searchKey));
}

/**
 * Creates a search index string from plaintext
 * Stores all hashed tokens as space-separated string for ILIKE queries
 *
 * @param text - The plaintext description to index
 * @param searchKey - 64-character hex string (32 bytes)
 * @returns Space-separated string of hashed tokens
 */
export function createSearchIndex(text: string, searchKey: string): string {
	const tokens = createSearchTokens(text, searchKey);
	return tokens.join(" ");
}

/**
 * Generates a random search key
 * Returns a 64-character hex string (32 bytes)
 */
export function generateSearchKey(): string {
	const { randomBytes } = require("node:crypto");
	return randomBytes(32).toString("hex");
}
