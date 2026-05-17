import { vi } from "vitest";

export const posthogCaptureSpy = vi.fn();

export const promptsClientStub = {
   get: vi.fn().mockResolvedValue({
      source: "active",
      prompt: "Sistema: classifique as transações em lote.",
      name: "montte-classify-transaction",
      version: 1,
   }),
   compile: vi.fn((prompt: string) => prompt),
};

vi.mock("../../src/workflows/context", async (importOriginal) => {
   const actual =
      await importOriginal<typeof import("../../src/workflows/context")>();
   return {
      ...actual,
      getClassificationPosthog: () => ({ capture: posthogCaptureSpy }),
      getClassificationPrompts: () => promptsClientStub,
   };
});
