/**
 * Default weights for duplicate detection scoring
 * Matches existing @packages/utils/duplicate-detection weights
 */
export const DEFAULT_WEIGHTS = {
   amount: 3,
   date: 2,
   description: 1,
} as const;

/**
 * Maximum possible score with default weights
 */
export const DEFAULT_MAX_SCORE =
   DEFAULT_WEIGHTS.amount + DEFAULT_WEIGHTS.date + DEFAULT_WEIGHTS.description;

/**
 * Default threshold percentage for duplicate detection (80%)
 */
export const DEFAULT_THRESHOLD_PERCENTAGE = 0.8;

/**
 * Default date tolerance in days
 */
export const DEFAULT_DATE_TOLERANCE_DAYS = 1;

/**
 * Minimum description similarity for scoring (50%)
 */
export const DESCRIPTION_SIMILARITY_THRESHOLD = 0.5;

/**
 * Stop words for description tokenization (Portuguese and English)
 */
export const STOP_WORDS = new Set([
   // Portuguese
   "de",
   "da",
   "do",
   "para",
   "com",
   "em",
   "no",
   "na",
   "os",
   "as",
   "um",
   "uma",
   // English
   "the",
   "a",
   "an",
   "of",
   "to",
   "in",
   "for",
   "on",
   "at",
]);

/**
 * Regex to remove special characters while preserving accented characters
 */
export const SPECIAL_CHARS_REGEX = /[^\w\sáàâãéèêíìîóòôõúùûç]/g;
