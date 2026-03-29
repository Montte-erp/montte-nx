import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printJson, printTable, printRecord } from "../src/output";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
   logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
   logSpy.mockRestore();
});

describe("printJson", () => {
   it("outputs formatted JSON", () => {
      printJson({ id: 1, name: "test" });
      expect(logSpy).toHaveBeenCalledWith(
         JSON.stringify({ id: 1, name: "test" }, null, 2),
      );
   });
});

describe("printTable", () => {
   it("prints header + separator + rows", () => {
      printTable([
         { id: "1", name: "Alice" },
         { id: "2", name: "Bob" },
      ]);
      expect(logSpy).toHaveBeenCalledTimes(4);
   });

   it("prints 'No results.' for empty array", () => {
      printTable([]);
      expect(logSpy).toHaveBeenCalledWith("No results.");
   });

   it("respects custom columns", () => {
      printTable([{ id: "1", name: "Alice", age: 30 }], ["name"]);
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy.mock.calls[0][0]).toContain("name");
      expect(logSpy.mock.calls[0][0]).not.toContain("age");
   });
});

describe("printRecord", () => {
   it("prints key-value pairs", () => {
      printRecord({ id: "1", name: "Alice" });
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toContain("id");
      expect(logSpy.mock.calls[1][0]).toContain("Alice");
   });
});
