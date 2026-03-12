import { gunzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { compressMarkdown } from "../src/text-file-helpers";

describe("text file helpers", () => {
   it("produces gzip output that can be decompressed", () => {
      const markdown = "# Hello World\n\nThis is a test.";

      const compressed = compressMarkdown(Buffer.from(markdown));
      const decompressed = Buffer.from(gunzipSync(compressed));

      expect(compressed).toBeInstanceOf(Buffer);
      expect(decompressed.toString()).toBe(markdown);
   });
});
