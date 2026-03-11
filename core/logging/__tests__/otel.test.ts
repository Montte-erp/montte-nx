import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStart = vi.fn();
const mockShutdown = vi.fn();

vi.mock("@opentelemetry/sdk-node", () => {
   class MockNodeSDK {
      start = mockStart;
      shutdown = mockShutdown;
   }
   return { NodeSDK: MockNodeSDK };
});

vi.mock("@opentelemetry/exporter-logs-otlp-http", () => {
   class MockOTLPLogExporter {}
   return { OTLPLogExporter: MockOTLPLogExporter };
});

vi.mock("@opentelemetry/resources", () => ({
   resourceFromAttributes: vi.fn((attrs: Record<string, string>) => attrs),
}));

vi.mock("@opentelemetry/sdk-logs", () => {
   class MockBatchLogRecordProcessor {}
   return { BatchLogRecordProcessor: MockBatchLogRecordProcessor };
});

vi.mock("@orpc/otel", () => {
   class MockORPCInstrumentation {}
   return { ORPCInstrumentation: MockORPCInstrumentation };
});

describe("initOtel / shutdownOtel", () => {
   beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();
   });

   it("initializes the SDK and starts it", async () => {
      const { initOtel } = await import("../src/otel");
      const sdk = initOtel({
         serviceName: "test-service",
         posthogKey: "phc_test",
         posthogHost: "https://us.i.posthog.com",
      });
      expect(sdk).toBeDefined();
      expect(mockStart).toHaveBeenCalledOnce();
   });

   it("returns the same SDK on subsequent calls", async () => {
      const { initOtel } = await import("../src/otel");
      const config = {
         serviceName: "test",
         posthogKey: "phc_test",
         posthogHost: "https://us.i.posthog.com",
      };
      const sdk1 = initOtel(config);
      const sdk2 = initOtel(config);
      expect(sdk1).toBe(sdk2);
      expect(mockStart).toHaveBeenCalledOnce();
   });

   it("shutdownOtel calls sdk.shutdown()", async () => {
      const { initOtel, shutdownOtel } = await import("../src/otel");
      initOtel({
         serviceName: "test",
         posthogKey: "phc_test",
         posthogHost: "https://us.i.posthog.com",
      });
      await shutdownOtel();
      expect(mockShutdown).toHaveBeenCalledOnce();
   });

   it("shutdownOtel is safe to call without init", async () => {
      const { shutdownOtel } = await import("../src/otel");
      await expect(shutdownOtel()).resolves.toBeUndefined();
   });
});
