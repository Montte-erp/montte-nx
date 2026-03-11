import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pino", () => ({
   default: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      level: "info",
   })),
}));

describe("getServerLogger / resetServerLogger", () => {
   beforeEach(() => {
      vi.resetModules();
   });

   it("creates a logger with given env", async () => {
      const { getServerLogger } = await import("../src/server");
      const logger = getServerLogger({ LOG_LEVEL: "debug" });
      expect(logger).toBeDefined();
   });

   it("returns the same logger on subsequent calls", async () => {
      const { getServerLogger } = await import("../src/server");
      const env = { LOG_LEVEL: "info" as const };
      const l1 = getServerLogger(env);
      const l2 = getServerLogger(env);
      expect(l1).toBe(l2);
   });

   it("resetServerLogger allows re-creation", async () => {
      const { getServerLogger, resetServerLogger } =
         await import("../src/server");
      const l1 = getServerLogger({ LOG_LEVEL: "info" });
      resetServerLogger();
      const l2 = getServerLogger({ LOG_LEVEL: "debug" });
      expect(l1).not.toBe(l2);
   });
});
