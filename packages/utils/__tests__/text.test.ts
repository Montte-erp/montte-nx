import { describe, expect, it } from "bun:test";
import {
   calculateReadTimeMinutes,
   countWords,
   createCodeFromName,
   createDescriptionFromText,
   createSlug,
   formatStringForDisplay,
   generateRandomSuffix,
   getInitials,
} from "../src/text";

describe("text utilities", () => {
   describe("createDescriptionFromText", () => {
      it("should create a description from text within maxLength", () => {
         const text = "This is a simple test.";
         const result = createDescriptionFromText({ maxLength: 50, text });
         expect(result).toBe("This is a simple test.");
      });

      it("should truncate text longer than maxLength", () => {
         const text =
            "This is a very long text that should be truncated because it exceeds the maximum length.";
         const result = createDescriptionFromText({ maxLength: 50, text });
         expect(result.length).toBeLessThanOrEqual(50);
         expect(result).toContain("...");
      });

      it("should remove markdown headers and links", () => {
         const text =
            "# Title\n\nThis is a [link](https://example.com) in text.";
         const result = createDescriptionFromText({ maxLength: 100, text });
         expect(result).not.toContain("# Title");
         expect(result).not.toContain("[link](https://example.com)");
         expect(result).toContain("link");
      });

      it("should extract first paragraph", () => {
         const text = "First paragraph.\n\nSecond paragraph.";
         const result = createDescriptionFromText({ maxLength: 100, text });
         expect(result).toContain("First paragraph");
         expect(result).not.toContain("Second paragraph");
      });

      it("should use default maxLength", () => {
         const text = "Short text.";
         const result = createDescriptionFromText({ maxLength: 160, text });
         expect(result).toBe("Short text.");
      });

      it("should truncate at word boundary", () => {
         const text =
            "This is a test sentence that will be truncated properly.";
         const result = createDescriptionFromText({ maxLength: 25, text });
         expect(result.endsWith("...")).toBe(true);
      });

      it("should handle empty text", () => {
         const text = "";
         const result = createDescriptionFromText({ maxLength: 100, text });
         expect(result).toBe("");
      });

      it("should handle text with no spaces for truncation", () => {
         const text = "Verylongwordwithoutspaces";
         const result = createDescriptionFromText({ maxLength: 15, text });
         expect(result.endsWith("...")).toBe(true);
      });
   });

   describe("createSlug", () => {
      it("should create slug from text", () => {
         const result = createSlug("Hello World Test");
         expect(result).toBe("hello-world-test");
      });

      it("should handle special characters", () => {
         const result = createSlug("Hello! @#$%^&*() World");
         expect(result).toBe("hello-dollarpercentand-world");
      });

      it("should handle accented characters", () => {
         const result = createSlug("Café résumé");
         expect(result).toBe("cafe-resume");
      });

      it("should handle empty string", () => {
         const result = createSlug("");
         expect(result).toBe("");
      });
   });

   describe("generateRandomSuffix", () => {
      it("should generate random suffix with default length", () => {
         const result = generateRandomSuffix();
         expect(result.length).toBe(6);
      });

      it("should generate random suffix with custom length", () => {
         const result = generateRandomSuffix(10);
         expect(result.length).toBe(10);
      });

      it("should generate different suffixes", () => {
         const result1 = generateRandomSuffix();
         const result2 = generateRandomSuffix();
         expect(result1).not.toBe(result2);
      });
   });

   describe("countWords", () => {
      it("should count words in text", () => {
         const result = countWords("This is a test");
         expect(result).toBe(4);
      });

      it("should handle multiple spaces", () => {
         const result = countWords("This    is   a   test");
         expect(result).toBe(4);
      });

      it("should handle empty string", () => {
         const result = countWords("");
         expect(result).toBe(0);
      });

      it("should handle whitespace only", () => {
         const result = countWords("   ");
         expect(result).toBe(0);
      });

      it("should handle newlines", () => {
         const result = countWords("One\ntwo\nthree");
         expect(result).toBe(3);
      });
   });

   describe("calculateReadTimeMinutes", () => {
      it("should calculate read time", () => {
         const result = calculateReadTimeMinutes(200);
         expect(result).toBe(1);
      });

      it("should round up partial minutes", () => {
         const result = calculateReadTimeMinutes(250);
         expect(result).toBe(2);
      });

      it("should handle zero words", () => {
         const result = calculateReadTimeMinutes(0);
         expect(result).toBe(0);
      });

      it("should handle large word counts", () => {
         const result = calculateReadTimeMinutes(1000);
         expect(result).toBe(5);
      });
   });

   describe("formatStringForDisplay", () => {
      it("should format value for display", () => {
         const result = formatStringForDisplay("test_value");
         expect(result).toBe("Test Value");
      });

      it("should return default for empty value", () => {
         const result = formatStringForDisplay("");
         expect(result).toBe("Not specified");
      });

      it("should handle already formatted strings", () => {
         const result = formatStringForDisplay("hello world");
         expect(result).toBe("Hello World");
      });

      it("should handle multiple underscores", () => {
         const result = formatStringForDisplay("one_two_three");
         expect(result).toBe("One Two Three");
      });
   });

   describe("getInitials", () => {
      it("should get initials from name", () => {
         const result = getInitials("John Doe");
         expect(result).toBe("JD");
      });

      it("should handle single name", () => {
         const result = getInitials("John");
         expect(result).toBe("J");
      });

      it("should handle three names", () => {
         const result = getInitials("John Michael Doe");
         expect(result).toBe("JM");
      });

      it("should handle empty name with email", () => {
         const result = getInitials("", "john@example.com");
         expect(result).toBe("JO");
      });

      it("should handle empty name without email", () => {
         const result = getInitials("");
         expect(result).toBe("?");
      });

      it("should handle name with extra spaces", () => {
         const result = getInitials("  John   Doe  ");
         expect(result).toBe("JD");
      });

      it("should handle whitespace-only name with email", () => {
         const result = getInitials("   ", "test@example.com");
         expect(result).toBe("TE");
      });
   });

   describe("createCodeFromName", () => {
      it("should create code from single word", () => {
         const result = createCodeFromName("Testing");
         expect(result).toBe("TST");
      });

      it("should create code from two words", () => {
         const result = createCodeFromName("Hello World");
         expect(result).toBe("HW");
      });

      it("should create code from three words", () => {
         const result = createCodeFromName("One Two Three");
         expect(result).toBe("OTT");
      });

      it("should handle empty string", () => {
         const result = createCodeFromName("");
         expect(result).toBe("");
      });

      it("should handle whitespace only", () => {
         const result = createCodeFromName("   ");
         expect(result).toBe("");
      });

      it("should handle accented characters", () => {
         const result = createCodeFromName("Café");
         expect(result).toBe("CFC");
      });

      it("should handle short single word", () => {
         const result = createCodeFromName("Hi");
         expect(result).toBe("HI");
      });

      it("should handle word with few consonants", () => {
         const result = createCodeFromName("Aeiou");
         expect(result).toBe("AEI");
      });

      it("should handle more than three words", () => {
         const result = createCodeFromName("One Two Three Four Five");
         expect(result).toBe("OTT");
      });

      it("should handle special characters", () => {
         const result = createCodeFromName("Hello! World?");
         expect(result).toBe("HW");
      });
   });
});
