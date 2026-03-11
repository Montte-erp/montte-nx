import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pino", () => {
   const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      level: "info",
   };
   return { default: vi.fn(() => mockLogger) };
});

describe("initLogger / getLogger", () => {
   beforeEach(() => {
      vi.resetModules();
   });

   it("getLogger returns a fallback logger when not initialized", async () => {
      const { getLogger } = await import("../src/root");
      const logger = getLogger();
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
   });

   it("initLogger sets the root logger", async () => {
      const { initLogger, getLogger } = await import("../src/root");
      const logger = initLogger({ name: "custom" });
      expect(getLogger()).toBe(logger);
   });
});
