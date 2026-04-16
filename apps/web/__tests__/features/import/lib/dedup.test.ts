import { describe, expect, it } from "vitest";
import { getDedupStatus } from "@/features/import/lib/dedup";

describe("getDedupStatus", () => {
   it("duplicate >= 0.9", () => expect(getDedupStatus(0.9)).toBe("duplicate"));
   it("possible >= 0.5", () => expect(getDedupStatus(0.7)).toBe("possible"));
   it("new < 0.5", () => expect(getDedupStatus(0.4)).toBe("new"));
   it("boundary 0.5", () => expect(getDedupStatus(0.5)).toBe("possible"));
   it("boundary 0.0", () => expect(getDedupStatus(0.0)).toBe("new"));
});
