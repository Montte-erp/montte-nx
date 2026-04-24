import type { DatabaseInstance } from "@core/database/client";
import { vi } from "vitest";

export function createPosthogMock() {
   return {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   };
}

// Returns `undefined` from `enqueue`. Handlers that introspect the workflow
// handle (e.g. `handle.workflowID`) must pass a richer mock via `overrides.extras`.
export function createWorkflowClientMock() {
   return { enqueue: vi.fn().mockResolvedValue(undefined) };
}

export function createJobPublisherMock() {
   return { publish: vi.fn().mockResolvedValue(undefined) };
}

export type TestContextOverrides = {
   teamId?: string;
   organizationId?: string;
   userId?: string;
   userEmail?: string;
   extras?: Record<string, unknown>;
};

export function createTestContext(
   db: DatabaseInstance,
   overrides: TestContextOverrides = {},
) {
   const teamId = overrides.teamId ?? crypto.randomUUID();
   const organizationId = overrides.organizationId ?? crypto.randomUUID();
   const userId = overrides.userId ?? crypto.randomUUID();
   const userEmail = overrides.userEmail ?? `test-${userId}@example.com`;
   const headers = new Headers();

   return {
      db,
      teamId,
      organizationId,
      userId,
      session: {
         user: { id: userId, email: userEmail, name: "Test" },
         session: {
            id: crypto.randomUUID(),
            activeOrganizationId: organizationId,
            activeTeamId: teamId,
         },
      },
      headers,
      request: new Request("http://localhost", { headers }),
      // auth + redis are deliberate test-only escape hatches. Handlers under test
      // must not traverse these singletons — that is middleware territory.
      auth: {} as never,
      posthog: createPosthogMock(),
      redis: {} as never,
      workflowClient: createWorkflowClientMock(),
      jobPublisher: createJobPublisherMock(),
      ...overrides.extras,
   };
}
