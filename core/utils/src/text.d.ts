export type NormalizeTextOptions = {
   removeDiacritics?: boolean;
   trim?: boolean;
};
export declare function normalizeText(
   text: string,
   options?: NormalizeTextOptions,
): string;
export declare function normalizeTextLower(
   text: string,
   options?: NormalizeTextOptions,
): string;
export declare function createDescriptionFromText({
   text,
   maxLength,
}: {
   text: string;
   maxLength: number;
}): string;
export declare function getKeywordsFromText({
   text,
   minLength,
}: {
   text: string;
   minLength?: number;
}): string[];
export declare function createSlug(name: string): string;
export declare function generateRandomSuffix(length?: number): string;
export declare function countWords(text: string): number;
export declare function calculateReadTimeMinutes(wordCount: number): number;
export declare function formatStringForDisplay(value: string): string;
export declare function calculateTextStats(content: string): {
   readTimeMinutes: string;
   wordsCount: string;
};
export declare function calculateReadabilityScore({ text }: { text: string }): {
   level: string;
   score: number;
};
export declare function getInitials(name: string, email?: string): string;
export declare function createCodeFromName(name: string): string;
//# sourceMappingURL=text.d.ts.map
