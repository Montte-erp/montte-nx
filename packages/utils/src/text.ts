import slugfy from "slugify";

export type NormalizeTextOptions = {
   removeDiacritics?: boolean;
   trim?: boolean;
};

export function normalizeText(
   text: string,
   options?: NormalizeTextOptions,
): string {
   if (!text) return "";
   let result = text;
   if (options?.removeDiacritics !== false) {
      result = result.normalize("NFD").replace(/\p{Diacritic}/gu, "");
   }
   if (options?.trim !== false) {
      result = result.trim();
   }
   return result;
}

export function normalizeTextLower(
   text: string,
   options?: NormalizeTextOptions,
): string {
   return normalizeText(text, options).toLowerCase();
}

export function createDescriptionFromText({
   text,
   maxLength = 160,
}: {
   text: string;
   maxLength: number;
}) {
   function truncateWithEllipsis(text: string, maxLength: number): string {
      if (text.length <= maxLength) {
         return text;
      }

      const ELLIPSIS = "...";
      const truncationPoint = maxLength - ELLIPSIS.length;
      const truncatedText = text.substring(0, truncationPoint);
      const lastSpaceIndex = truncatedText.lastIndexOf(" ");

      const cutoffPoint = lastSpaceIndex > 0 ? lastSpaceIndex : truncationPoint;
      return text.substring(0, cutoffPoint) + ELLIPSIS;
   }

   function removeMarkdownHeadersAndLinks(text: string): string {
      return text
         .replace(/^#{1,6}\s.+$/gm, "") // Remove markdown headers
         .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace markdown links with text
         .trim();
   }
   function extractFirstParagraph(text: string): string {
      return text.split("\n\n")[0] || "";
   }

   const cleanText = removeMarkdownHeadersAndLinks(text);
   const firstParagraph = extractFirstParagraph(cleanText);
   const metaDescription = truncateWithEllipsis(firstParagraph, maxLength);

   return metaDescription;
}

export function createSlug(name: string): string {
   return slugfy(name, { lower: true, strict: true });
}

export function generateRandomSuffix(length = 6): string {
   return Math.random()
      .toString(36)
      .slice(2, 2 + length);
}

export function countWords(text: string) {
   return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
}

export function calculateReadTimeMinutes(wordCount: number): number {
   const wordsPerMinute = 200; // Average reading speed
   return Math.ceil(wordCount / wordsPerMinute);
}

export function formatStringForDisplay(value: string) {
   if (!value) return "Not specified";
   return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getInitials(name: string, email?: string) {
   if (name) {
      const trimmed = name.trim();
      const segments = trimmed
         .split(/\s+/)
         .filter((segment) => segment.length > 0);

      if (segments.length > 0) {
         const initials = segments
            .map((segment) => segment[0])
            .filter((char) => char !== undefined)
            .join("")
            .toUpperCase()
            .slice(0, 2);

         if (initials.length > 0) {
            return initials;
         }
      }
   }
   return email ? email.slice(0, 2).toUpperCase() : "?";
}

export function createCodeFromName(name: string): string {
   if (!name || !name.trim()) return "";

   const normalized = name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

   const words = normalized.split(" ").filter(Boolean);

   if (words.length === 0) return "";

   if (words.length === 1) {
      const word = words[0];
      if (!word) return "";

      const w = word.toUpperCase();
      if (w.length <= 3) return w;

      const letters = w.replace(/[^A-Z0-9]/g, "");
      const consonants = letters.replace(/[AEIOU]/g, "").split("");

      if (consonants.length >= 3) {
         return consonants.slice(0, 3).join("");
      }

      return (consonants.join("") + letters).slice(0, 3);
   }

   if (words.length === 2) {
      return words
         .map((w) => w.charAt(0))
         .join("")
         .toUpperCase()
         .slice(0, 2);
   }

   // For 3+ words: use initials of first three words
   return words
      .map((w) => w.charAt(0))
      .slice(0, 3)
      .join("")
      .toUpperCase();
}
