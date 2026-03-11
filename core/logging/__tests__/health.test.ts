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

const { startHealthHeartbeat, stopHealthHeartbeat, emitJobLog, emitCronLog } =
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

describe("emitJobLog", () => {
   beforeEach(() => {
      mockEmit.mockClear();
   });

   it("emits info for started/completed events", () => {
      emitJobLog({
         serviceName: "worker",
         jobName: "process-email",
         event: "started",
      });
      expect(mockEmit.mock.calls[0][0].severityText).toBe("info");
   });

   it("emits error for failed events", () => {
      emitJobLog({
         serviceName: "worker",
         jobName: "process-email",
         event: "failed",
         error: "timeout",
      });
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "error",
         attributes: expect.objectContaining({
            "job.error": "timeout",
         }),
      });
   });

   it("includes optional attributes when provided", () => {
      emitJobLog({
         serviceName: "worker",
         jobName: "process-email",
         jobId: "abc-123",
         event: "completed",
         durationMs: 1500,
         attempt: 2,
         maxAttempts: 3,
      });
      expect(mockEmit.mock.calls[0][0].attributes).toMatchObject({
         "job.id": "abc-123",
         "job.durationMs": 1500,
         "job.attempt": 2,
         "job.maxAttempts": 3,
      });
   });
});

describe("emitCronLog", () => {
   beforeEach(() => {
      mockEmit.mockClear();
   });

   it("emits info for started/completed events", () => {
      emitCronLog({
         serviceName: "worker",
         taskName: "cleanup",
         event: "completed",
         durationMs: 500,
      });
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "info",
         body: "cron completed: cleanup",
         attributes: expect.objectContaining({
            "cron.durationMs": 500,
         }),
      });
   });

   it("emits error for failed events", () => {
      emitCronLog({
         serviceName: "worker",
         taskName: "cleanup",
         event: "failed",
         error: "connection lost",
      });
      expect(mockEmit.mock.calls[0][0]).toMatchObject({
         severityText: "error",
         attributes: expect.objectContaining({
            "cron.error": "connection lost",
         }),
      });
   });
});
