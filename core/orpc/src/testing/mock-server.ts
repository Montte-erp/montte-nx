import { os } from "@orpc/server";

// Replaces `@core/orpc/server` for tests. The real module wires DB/auth/
// posthog/hyprpay/workflowClient singletons into context at module load —
// that clobbers whatever context the test passes through `call()`. This
// pass-through exposes raw `os.$context` builders so handlers receive the
// test-provided context unchanged.
//
// Use inside a test file:
//   vi.mock("@core/orpc/server", async () =>
//      (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
//   );
export function createMockServerModule() {
   const base = os.$context<Record<string, unknown>>();
   return {
      publicProcedure: base,
      authenticatedProcedure: base,
      protectedProcedure: base,
      billableProcedure: base,
   };
}
