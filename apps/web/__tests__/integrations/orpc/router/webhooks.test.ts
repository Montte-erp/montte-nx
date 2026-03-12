import { call } from "@orpc/server";
import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";

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
vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@packages/events/webhook", () => ({
   emitWebhookEndpointCreated: vi.fn().mockResolvedValue(undefined),
   emitWebhookEndpointUpdated: vi.fn().mockResolvedValue(undefined),
   emitWebhookEndpointDeleted: vi.fn().mockResolvedValue(undefined),
}));

import { eventCatalog } from "@core/database/schemas/event-catalog";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as webhooksRouter from "@/integrations/orpc/router/webhooks";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });

   await ctx.db.insert(eventCatalog).values({
      eventName: "content.page.published",
      category: "content",
      displayName: "Page published",
      pricePerEvent: "0",
      freeTierLimit: 0,
      isBillable: false,
      isActive: true,
   });

   await ctx.db.insert(eventCatalog).values({
      eventName: "content.page.updated",
      category: "content",
      displayName: "Page updated",
      pricePerEvent: "0",
      freeTierLimit: 0,
      isBillable: false,
      isActive: true,
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM webhook_deliveries`);
   await ctx.db.execute(sql`DELETE FROM webhook_endpoints`);
});

function withMockApiKey(
   context: ORPCContextWithAuth,
   overrides?: {
      createApiKey?: ReturnType<typeof vi.fn>;
      deleteApiKey?: ReturnType<typeof vi.fn>;
   },
): ORPCContextWithAuth {
   return {
      ...context,
      auth: {
         ...context.auth,
         api: {
            ...(context.auth as any).api,
            createApiKey:
               overrides?.createApiKey ??
               vi.fn().mockResolvedValue({
                  id: "api-key-1",
                  key: "cta_wh_test_key_123",
               }),
            deleteApiKey:
               overrides?.deleteApiKey ?? vi.fn().mockResolvedValue(undefined),
         },
      } as any,
   };
}

describe("create", () => {
   const input = {
      url: "https://example.com/webhook",
      description: "Test webhook",
      eventPatterns: ["content.page.published"],
   };

   it("creates webhook endpoint and persists it", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const result = await call(webhooksRouter.create, input, {
         context: ctxWithApi,
      });

      expect(result.endpoint.url).toBe("https://example.com/webhook");
      expect(result.endpoint.eventPatterns).toEqual(["content.page.published"]);
      expect(result.endpoint.isActive).toBe(true);
      expect(result.endpoint.signingSecret).toMatch(/^.{8}\.\.\.$/);
      expect(result.plaintextSecret).toBe("cta_wh_test_key_123");

      const rows = await ctx.db.query.webhookEndpoints.findMany();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(result.endpoint.id);
      expect(rows[0]!.url).toBe("https://example.com/webhook");
   });

   it("rejects wildcard event patterns", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      await expect(
         call(
            webhooksRouter.create,
            { ...input, eventPatterns: ["content.*"] },
            { context: ctxWithApi },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects events not in catalog", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      await expect(
         call(
            webhooksRouter.create,
            { ...input, eventPatterns: ["content.page.deleted"] },
            { context: ctxWithApi },
         ),
      ).rejects.toThrow("Eventos inválidos: content.page.deleted");
   });

   it("masks signing secret in response", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const result = await call(webhooksRouter.create, input, {
         context: ctxWithApi,
      });

      const fromDb = await ctx.db.query.webhookEndpoints.findFirst({
         where: { id: result.endpoint.id },
      });
      expect(result.endpoint.signingSecret).not.toBe(fromDb!.signingSecret);
      expect(result.endpoint.signingSecret.endsWith("...")).toBe(true);
   });
});

describe("list", () => {
   it("returns endpoints with masked secrets", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      await call(
         webhooksRouter.create,
         {
            url: "https://example.com/hook1",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );
      await call(
         webhooksRouter.create,
         {
            url: "https://example.com/hook2",
            eventPatterns: ["content.page.updated"],
         },
         { context: ctxWithApi },
      );

      const result = await call(webhooksRouter.list, undefined, {
         context: ctx,
      });

      expect(result).toHaveLength(2);
      for (const endpoint of result) {
         expect(endpoint.signingSecret.endsWith("...")).toBe(true);
      }
   });

   it("returns empty array when no endpoints", async () => {
      const result = await call(webhooksRouter.list, undefined, {
         context: ctx,
      });
      expect(result).toEqual([]);
   });

   it("only returns endpoints for the requesting team", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      await call(
         webhooksRouter.create,
         {
            url: "https://example.com/team1",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const result = await call(webhooksRouter.list, undefined, {
         context: ctx2,
      });
      expect(result).toHaveLength(0);
   });
});

describe("getById", () => {
   it("returns endpoint with masked signing secret", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const result = await call(
         webhooksRouter.getById,
         { id: created.endpoint.id },
         { context: ctx },
      );

      expect(result.url).toBe("https://example.com/webhook");
      expect(result.signingSecret.endsWith("...")).toBe(true);
   });

   it("rejects access from a different team", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      await expect(
         call(
            webhooksRouter.getById,
            { id: created.endpoint.id },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});

describe("update", () => {
   it("updates endpoint and persists changes", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const updated = await call(
         webhooksRouter.update,
         {
            id: created.endpoint.id,
            url: "https://example.com/updated",
            isActive: false,
         },
         { context: ctx },
      );

      expect(updated.url).toBe("https://example.com/updated");
      expect(updated.isActive).toBe(false);

      const fromDb = await ctx.db.query.webhookEndpoints.findFirst({
         where: { id: created.endpoint.id },
      });
      expect(fromDb!.url).toBe("https://example.com/updated");
      expect(fromDb!.isActive).toBe(false);
   });

   it("validates event patterns on update", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      await expect(
         call(
            webhooksRouter.update,
            {
               id: created.endpoint.id,
               eventPatterns: ["content.*"],
            },
            { context: ctx },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects update from different team", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      await expect(
         call(
            webhooksRouter.update,
            { id: created.endpoint.id, url: "https://evil.com" },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});

describe("remove", () => {
   it("deletes endpoint and verifies removal from database", async () => {
      const deleteApiKey = vi.fn().mockResolvedValue(undefined);
      const ctxWithApi = withMockApiKey(ctx, { deleteApiKey });
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const result = await call(
         webhooksRouter.remove,
         { id: created.endpoint.id },
         { context: ctxWithApi },
      );

      expect(result).toEqual({ success: true });

      const rows = await ctx.db.query.webhookEndpoints.findMany();
      expect(rows).toHaveLength(0);
   });

   it("rejects removal from different team", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const ctx2WithApi = withMockApiKey(ctx2);
      await expect(
         call(
            webhooksRouter.remove,
            { id: created.endpoint.id },
            { context: ctx2WithApi },
         ),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});

describe("deliveries", () => {
   it("returns deliveries for a valid endpoint", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      const result = await call(
         webhooksRouter.deliveries,
         { webhookId: created.endpoint.id, page: 1, limit: 50 },
         { context: ctx },
      );

      expect(result.items).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
   });

   it("rejects access from different team", async () => {
      const ctxWithApi = withMockApiKey(ctx);
      const created = await call(
         webhooksRouter.create,
         {
            url: "https://example.com/webhook",
            eventPatterns: ["content.page.published"],
         },
         { context: ctxWithApi },
      );

      await expect(
         call(
            webhooksRouter.deliveries,
            { webhookId: created.endpoint.id, page: 1, limit: 50 },
            { context: ctx2 },
         ),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});
