import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("pino", () => {
   const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(),
      level: "info",
   };
   const pino = vi.fn(() => mockLogger);
   return { default: pino, __mockLogger: mockLogger };
});

const pino = (await import("pino")).default;
const { createLogger, createSafeLogger } = await import("../src/logger");

describe("createLogger", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates a pino logger with given name and level", () => {
      createLogger({ name: "test-service", level: "debug" });
      expect(pino).toHaveBeenCalledWith(
         expect.objectContaining({
            name: "test-service",
            level: "debug",
         }),
      );
   });

   it("defaults level to info", () => {
      createLogger({ name: "test-service" });
      expect(pino).toHaveBeenCalledWith(
         expect.objectContaining({
            level: "info",
         }),
      );
   });
});

describe("createSafeLogger", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("returns a logger on success", () => {
      const logger = createSafeLogger({ name: "safe" });
      expect(logger).toBeDefined();
   });

   it("falls back to basic logger on error", () => {
      vi.mocked(pino).mockImplementationOnce(() => {
         throw new Error("transport fail");
      });
      const logger = createSafeLogger({ name: "fallback" });
      expect(logger).toBeDefined();
      expect(pino).toHaveBeenCalledTimes(2);
   });
});
