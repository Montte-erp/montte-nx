import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pino", () => ({
   default: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      level: "info",
   })),
}));

describe("getWorkerLogger / resetWorkerLogger", () => {
   beforeEach(() => {
      vi.resetModules();
   });

   it("creates a logger with given env", async () => {
      const { getWorkerLogger } = await import("../src/worker");
      const logger = getWorkerLogger({ LOG_LEVEL: "warn" });
      expect(logger).toBeDefined();
   });

   it("returns the same logger on subsequent calls", async () => {
      const { getWorkerLogger } = await import("../src/worker");
      const env = {};
      const l1 = getWorkerLogger(env);
      const l2 = getWorkerLogger(env);
      expect(l1).toBe(l2);
   });

   it("resetWorkerLogger allows re-creation", async () => {
      const { getWorkerLogger, resetWorkerLogger } =
         await import("../src/worker");
      const l1 = getWorkerLogger({});
      resetWorkerLogger();
      const l2 = getWorkerLogger({});
      expect(l1).not.toBe(l2);
   });
});
