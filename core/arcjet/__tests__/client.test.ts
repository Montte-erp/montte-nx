import { describe, expect, it, vi } from "vitest";

const arcjetFactoryMock = vi.fn();
const detectBotMock = vi.fn();
const shieldMock = vi.fn();

vi.mock("arcjet", () => ({
   default: arcjetFactoryMock,
   detectBot: detectBotMock,
   shield: shieldMock,
   slidingWindow: vi.fn(),
}));

vi.mock("@core/environment/server", () => ({
   env: {
      ARCJET_KEY: "ajkey_test",
      ARCJET_ENV: "development",
   },
}));

describe("arcjet client singleton", () => {
   it("creates a single arcjet client with ARCJET_KEY", async () => {
      const withRule = vi.fn();
      arcjetFactoryMock.mockReturnValue({ withRule });

      const module = await import("../src/client");

      expect(module.arcjetClient).toBeDefined();
      expect(arcjetFactoryMock).toHaveBeenCalledTimes(1);
      expect(arcjetFactoryMock).toHaveBeenCalledWith(
         expect.objectContaining({
            key: "ajkey_test",
         }),
      );
   });
});
