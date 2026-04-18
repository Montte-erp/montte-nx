import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEmit = vi.fn();
const mockCapture = vi.fn();

vi.mock("@opentelemetry/api-logs", () => ({
   logs: {
      getLogger: () => ({
         emit: mockEmit,
      }),
   },
}));

const { startHealthHeartbeat, stopHealthHeartbeat } =
   await import("../src/health");

describe("startHealthHeartbeat / stopHealthHeartbeat", () => {
   beforeEach(() => {
      vi.useFakeTimers();
      mockEmit.mockClear();
      mockCapture.mockClear();
      stopHealthHeartbeat();
   });

   afterEach(() => {
      stopHealthHeartbeat();
      vi.useRealTimers();
   });

   it("emits immediately on start", () => {
      startHealthHeartbeat({
         serviceName: "test",
         posthog: { capture: mockCapture } as never,
      });
      expect(mockEmit).toHaveBeenCalledOnce();
      expect(mockCapture).toHaveBeenCalledOnce();
   });

   it("emits OTel log with correct attributes", () => {
      startHealthHeartbeat({
         serviceName: "test",
         posthog: { capture: mockCapture } as never,
      });
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "info",
         body: "health heartbeat: test",
         attributes: expect.objectContaining({
            "service.name": "test",
         }),
      });
   });

   it("emits periodically", () => {
      startHealthHeartbeat({
         serviceName: "test",
         posthog: { capture: mockCapture } as never,
         intervalMs: 1000,
      });
      expect(mockEmit).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1000);
      expect(mockEmit).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(1000);
      expect(mockEmit).toHaveBeenCalledTimes(3);
   });

   it("does not start twice", () => {
      const config = {
         serviceName: "test",
         posthog: { capture: mockCapture } as never,
         intervalMs: 1000,
      };
      startHealthHeartbeat(config);
      startHealthHeartbeat(config);
      expect(mockEmit).toHaveBeenCalledTimes(1);
   });

   it("stopHealthHeartbeat stops periodic emission", () => {
      startHealthHeartbeat({
         serviceName: "test",
         posthog: { capture: mockCapture } as never,
         intervalMs: 1000,
      });
      stopHealthHeartbeat();
      vi.advanceTimersByTime(3000);
      expect(mockEmit).toHaveBeenCalledTimes(1);
   });
});
