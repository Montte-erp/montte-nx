import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } =
      await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb(), createDb: () => {} };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   },
}));

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as sessionRouter from "@/integrations/orpc/router/session";

let ctx: ORPCContextWithAuth;
let setupResult: Awaited<ReturnType<typeof setupIntegrationTest>>;

beforeAll(async () => {
   setupResult = await setupIntegrationTest();
   ctx = await setupResult.createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("getSession", () => {
   it("returns the current session", async () => {
      const result = await call(sessionRouter.getSession, undefined, {
         context: ctx,
      });

      expect(result).toBeDefined();
      expect(result!.session).toBeDefined();
      expect(result!.user).toBeDefined();
      expect(result!.user.id).toBe(ctx.session!.user.id);
   });
});

describe("listSessions", () => {
   it("returns active sessions", async () => {
      const result = await call(sessionRouter.listSessions, undefined, {
         context: ctx,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
   });
});

describe("revokeSessionByToken", () => {
   it("revokes a specific session by token", async () => {
      const freshCtx = await setupResult.createAuthenticatedContext({
         organizationId: "auto",
         teamId: "auto",
      });

      const sessions = await call(sessionRouter.listSessions, undefined, {
         context: freshCtx,
      });
      const targetToken = sessions[0]!.token;

      const result = await call(
         sessionRouter.revokeSessionByToken,
         { token: targetToken },
         { context: freshCtx },
      );

      expect(result).toEqual({ success: true });
   });
});

describe("revokeOtherSessions", () => {
   it("keeps current session and revokes others", async () => {
      const freshCtx = await setupResult.createAuthenticatedContext({
         organizationId: "auto",
         teamId: "auto",
      });

      const result = await call(sessionRouter.revokeOtherSessions, undefined, {
         context: freshCtx,
      });

      expect(result).toEqual({ success: true });
   });
});

describe("revokeSessions", () => {
   it("revokes all sessions", async () => {
      const freshCtx = await setupResult.createAuthenticatedContext({
         organizationId: "auto",
         teamId: "auto",
      });

      const result = await call(sessionRouter.revokeSessions, undefined, {
         context: freshCtx,
      });

      expect(result).toEqual({ success: true });
   });
});
