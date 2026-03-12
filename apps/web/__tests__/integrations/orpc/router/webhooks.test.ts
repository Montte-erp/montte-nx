import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   TEST_USER_ID,
   createTestContext,
} from "../../../helpers/create-test-context";
import {
   ENDPOINT_ID,
   makeWebhookEndpoint,
} from "../../../helpers/mock-factories";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/webhook-repository");
vi.mock("@core/database/repositories/event-catalog-repository");
vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@packages/events/webhook");
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
}));

import {
   createWebhookEndpoint,
   deleteWebhookEndpoint,
   ensureWebhookOwnership,
   getWebhookDeliveries,
   listWebhookEndpoints,
   updateWebhookEndpoint,
} from "@core/database/repositories/webhook-repository";
import { listEventCatalog } from "@core/database/repositories/event-catalog-repository";
import { AppError } from "@core/logging/errors";
import {
   emitWebhookEndpointCreated,
   emitWebhookEndpointDeleted,
   emitWebhookEndpointUpdated,
} from "@packages/events/webhook";

import * as webhooksRouter from "@/integrations/orpc/router/webhooks";

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(emitWebhookEndpointCreated).mockResolvedValue(undefined);
   vi.mocked(emitWebhookEndpointUpdated).mockResolvedValue(undefined);
   vi.mocked(emitWebhookEndpointDeleted).mockResolvedValue(undefined);
});

const catalogEntry = {
   id: "event-1",
   eventName: "content.page.published",
   category: "content",
   displayName: "Page published",
   description: null,
   pricePerEvent: "0",
   freeTierLimit: 0,
   isBillable: false,
   isActive: true,
   createdAt: new Date("2026-01-01"),
   updatedAt: new Date("2026-01-01"),
};

describe("create", () => {
   const input = {
      url: "https://example.com/webhook",
      description: "Test webhook",
      eventPatterns: ["content.page.published"],
   };

   it("creates webhook endpoint successfully", async () => {
      const endpoint = makeWebhookEndpoint({
         signingSecret: "cta_wh_1234567890",
         apiKeyId: "api-key-1",
         eventPatterns: ["content.page.published"],
      });
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);
      vi.mocked(createWebhookEndpoint).mockResolvedValueOnce(endpoint);
      const createApiKey = vi.fn().mockResolvedValue({
         id: "api-key-1",
         key: "cta_wh_1234567890",
      });

      const ctx = createTestContext({
         auth: { api: { createApiKey } },
      });
      const result = await call(webhooksRouter.create, input, { context: ctx });

      expect(listEventCatalog).toHaveBeenCalledWith(expect.anything());
      expect(createApiKey).toHaveBeenCalledWith(
         expect.objectContaining({
            headers: expect.any(Headers),
            body: expect.objectContaining({
               name: expect.stringContaining("Webhook"),
               prefix: "cta_wh",
               userId: TEST_USER_ID,
               metadata: expect.objectContaining({
                  organizationId: TEST_ORG_ID,
                  teamId: TEST_TEAM_ID,
                  type: "webhook",
               }),
            }),
         }),
      );
      expect(createWebhookEndpoint).toHaveBeenCalledWith(
         TEST_ORG_ID,
         TEST_TEAM_ID,
         expect.objectContaining({
            url: input.url,
            description: input.description,
            eventPatterns: input.eventPatterns,
            isActive: true,
         }),
      );
      expect(result).toEqual(
         expect.objectContaining({
            endpoint: expect.objectContaining({
               signingSecret: "cta_wh_1...",
            }),
            plaintextSecret: "cta_wh_1234567890",
         }),
      );
   });

   it("rejects wildcard event patterns", async () => {
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);
      const ctx = createTestContext({
         auth: { api: { createApiKey: vi.fn() } },
      });

      await expect(
         call(
            webhooksRouter.create,
            { ...input, eventPatterns: ["content.*"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects single wildcard pattern", async () => {
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);
      const ctx = createTestContext({
         auth: { api: { createApiKey: vi.fn() } },
      });

      await expect(
         call(
            webhooksRouter.create,
            { ...input, eventPatterns: ["*"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects events not in catalog", async () => {
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);
      const ctx = createTestContext({
         auth: { api: { createApiKey: vi.fn() } },
      });

      await expect(
         call(
            webhooksRouter.create,
            { ...input, eventPatterns: ["content.page.deleted"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Eventos inválidos: content.page.deleted");
   });

   it("returns masked secret in endpoint object", async () => {
      const endpoint = makeWebhookEndpoint({
         signingSecret: "cta_wh_1234567890",
         apiKeyId: "api-key-1",
         eventPatterns: ["content.page.published"],
      });
      vi.mocked(createWebhookEndpoint).mockResolvedValueOnce(endpoint);
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);

      const ctx = createTestContext({
         auth: {
            api: {
               createApiKey: vi.fn().mockResolvedValue({
                  id: "api-key-1",
                  key: "cta_wh_1234567890",
               }),
            },
         },
      });
      const result = await call(webhooksRouter.create, input, { context: ctx });

      expect(result.endpoint.signingSecret).toBe("cta_wh_1...");
      expect(result.plaintextSecret).toBe("cta_wh_1234567890");
      expect(result.endpoint.signingSecret).not.toBe(result.plaintextSecret);
   });

   it("emits webhookEndpointCreated event with teamId", async () => {
      const endpoint = makeWebhookEndpoint();
      vi.mocked(createWebhookEndpoint).mockResolvedValueOnce(endpoint);
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);

      const ctx = createTestContext({
         auth: {
            api: {
               createApiKey: vi.fn().mockResolvedValue({
                  id: "api-key-1",
                  key: "cta_wh_1234567890",
               }),
            },
         },
      });
      await call(webhooksRouter.create, input, { context: ctx });

      expect(emitWebhookEndpointCreated).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            endpointId: ENDPOINT_ID,
            url: input.url,
         }),
      );
   });

   it("succeeds even when event emission fails", async () => {
      const endpoint = makeWebhookEndpoint({
         signingSecret: "cta_wh_1234567890",
         apiKeyId: "api-key-1",
         eventPatterns: ["content.page.published"],
      });
      vi.mocked(createWebhookEndpoint).mockResolvedValueOnce(endpoint);
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);
      vi.mocked(emitWebhookEndpointCreated).mockRejectedValueOnce(
         new Error("emit failed"),
      );

      const ctx = createTestContext({
         auth: {
            api: {
               createApiKey: vi.fn().mockResolvedValue({
                  id: "api-key-1",
                  key: "cta_wh_1234567890",
               }),
            },
         },
      });
      const result = await call(webhooksRouter.create, input, { context: ctx });

      expect(result).toEqual(
         expect.objectContaining({
            endpoint: expect.objectContaining({
               signingSecret: "cta_wh_1...",
            }),
            plaintextSecret: "cta_wh_1234567890",
         }),
      );
   });
});

describe("list", () => {
   it("returns endpoints with masked signing secrets", async () => {
      const endpoints = [
         makeWebhookEndpoint(),
         makeWebhookEndpoint({
            id: "a0000000-0000-4000-8000-000000000002",
            url: "https://example.com/webhook2",
         }),
      ];
      vi.mocked(listWebhookEndpoints).mockResolvedValueOnce(endpoints);

      const ctx = createTestContext();
      const result = await call(webhooksRouter.list, undefined, {
         context: ctx,
      });

      expect(listWebhookEndpoints).toHaveBeenCalledWith(TEST_TEAM_ID);
      expect(result).toHaveLength(2);
      expect(result[0].signingSecret).toBe("whsec_12...");
      expect(result[1].signingSecret).toBe("whsec_12...");
   });

   it("returns empty array when no endpoints", async () => {
      vi.mocked(listWebhookEndpoints).mockResolvedValueOnce([]);

      const ctx = createTestContext();
      const result = await call(webhooksRouter.list, undefined, {
         context: ctx,
      });

      expect(result).toEqual([]);
   });
});

describe("getById", () => {
   it("returns endpoint with masked signing secret", async () => {
      const endpoint = makeWebhookEndpoint();
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(endpoint);

      const ctx = createTestContext();
      const result = await call(
         webhooksRouter.getById,
         { id: ENDPOINT_ID },
         { context: ctx },
      );

      expect(ensureWebhookOwnership).toHaveBeenCalledWith(
         ENDPOINT_ID,
         TEST_TEAM_ID,
      );
      expect(result.signingSecret).toBe("whsec_12...");
      expect(result.url).toBe("https://example.com/webhook");
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureWebhookOwnership).mockRejectedValueOnce(
         AppError.notFound("Webhook não encontrado."),
      );

      const ctx = createTestContext();
      await expect(
         call(webhooksRouter.getById, { id: ENDPOINT_ID }, { context: ctx }),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});

describe("update", () => {
   const input = {
      id: ENDPOINT_ID,
      url: "https://example.com/updated-webhook" as const,
      isActive: false as const,
   };

   it("updates endpoint successfully", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      const updated = makeWebhookEndpoint({
         url: "https://example.com/updated-webhook",
         isActive: false,
      });
      vi.mocked(updateWebhookEndpoint).mockResolvedValueOnce(updated);

      const ctx = createTestContext();
      const result = await call(webhooksRouter.update, input, { context: ctx });

      expect(updateWebhookEndpoint).toHaveBeenCalledWith(
         ENDPOINT_ID,
         expect.objectContaining({
            url: "https://example.com/updated-webhook",
            isActive: false,
         }),
      );
      expect(result).toEqual(updated);
   });

   it("rejects wildcard event patterns", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);

      const ctx = createTestContext();
      await expect(
         call(
            webhooksRouter.update,
            { id: ENDPOINT_ID, eventPatterns: ["content.*"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects single wildcard pattern", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);

      const ctx = createTestContext();
      await expect(
         call(
            webhooksRouter.update,
            { id: ENDPOINT_ID, eventPatterns: ["*"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Padrões com wildcard não são permitidos.");
   });

   it("rejects events not in catalog", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      vi.mocked(listEventCatalog).mockResolvedValueOnce([catalogEntry]);

      const ctx = createTestContext();
      await expect(
         call(
            webhooksRouter.update,
            { id: ENDPOINT_ID, eventPatterns: ["content.page.deleted"] },
            { context: ctx },
         ),
      ).rejects.toThrow("Eventos inválidos: content.page.deleted");
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureWebhookOwnership).mockRejectedValueOnce(
         AppError.notFound("Webhook não encontrado."),
      );

      const ctx = createTestContext();
      await expect(
         call(webhooksRouter.update, input, { context: ctx }),
      ).rejects.toThrow("Webhook não encontrado.");
   });

   it("emits webhookEndpointUpdated event with changedFields", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      vi.mocked(updateWebhookEndpoint).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );

      const ctx = createTestContext();
      await call(webhooksRouter.update, input, { context: ctx });

      expect(emitWebhookEndpointUpdated).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            endpointId: ENDPOINT_ID,
            changedFields: expect.arrayContaining(["url", "isActive"]),
         }),
      );
   });
});

describe("remove", () => {
   it("deletes endpoint successfully", async () => {
      const endpoint = makeWebhookEndpoint({ apiKeyId: "api-key-123" });
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(endpoint);
      vi.mocked(deleteWebhookEndpoint).mockResolvedValueOnce(undefined);
      const deleteApiKey = vi.fn().mockResolvedValue(undefined);

      const ctx = createTestContext({
         auth: { api: { deleteApiKey } },
      });
      const result = await call(
         webhooksRouter.remove,
         { id: ENDPOINT_ID },
         { context: ctx },
      );

      expect(deleteApiKey).toHaveBeenCalledWith(
         expect.objectContaining({
            headers: expect.any(Headers),
            body: { keyId: "api-key-123" },
         }),
      );
      expect(deleteWebhookEndpoint).toHaveBeenCalledWith(ENDPOINT_ID);
      expect(result).toEqual({ success: true });
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureWebhookOwnership).mockRejectedValueOnce(
         AppError.notFound("Webhook não encontrado."),
      );

      const ctx = createTestContext({
         auth: { api: { deleteApiKey: vi.fn() } },
      });
      await expect(
         call(webhooksRouter.remove, { id: ENDPOINT_ID }, { context: ctx }),
      ).rejects.toThrow("Webhook não encontrado.");
   });

   it("emits webhookEndpointDeleted event", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      vi.mocked(deleteWebhookEndpoint).mockResolvedValueOnce(undefined);

      const ctx = createTestContext({
         auth: { api: { deleteApiKey: vi.fn().mockResolvedValue(undefined) } },
      });
      await call(webhooksRouter.remove, { id: ENDPOINT_ID }, { context: ctx });

      expect(emitWebhookEndpointDeleted).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            endpointId: ENDPOINT_ID,
         }),
      );
   });
});

describe("deliveries", () => {
   it("returns deliveries for valid endpoint with pagination", async () => {
      vi.mocked(ensureWebhookOwnership).mockResolvedValueOnce(
         makeWebhookEndpoint(),
      );
      const mockDeliveries = [
         {
            id: "delivery-1",
            webhookEndpointId: ENDPOINT_ID,
            eventId: "event-1",
            url: "https://example.com/webhook",
            eventName: "content.page.published",
            payload: { id: "payload-1" },
            status: "delivered",
            httpStatusCode: 200,
            responseBody: "ok",
            errorMessage: null,
            attemptNumber: 1,
            maxAttempts: 5,
            nextRetryAt: null,
            createdAt: new Date("2026-01-02"),
            deliveredAt: new Date("2026-01-02"),
         },
         {
            id: "delivery-2",
            webhookEndpointId: ENDPOINT_ID,
            eventId: "event-2",
            url: "https://example.com/webhook",
            eventName: "content.page.updated",
            payload: { id: "payload-2" },
            status: "failed",
            httpStatusCode: 500,
            responseBody: "error",
            errorMessage: "failed",
            attemptNumber: 2,
            maxAttempts: 5,
            nextRetryAt: new Date("2026-01-03"),
            createdAt: new Date("2026-01-02"),
            deliveredAt: null,
         },
      ];
      vi.mocked(getWebhookDeliveries).mockResolvedValueOnce(mockDeliveries);

      const ctx = createTestContext();
      const result = await call(
         webhooksRouter.deliveries,
         { webhookId: ENDPOINT_ID, page: 1, limit: 50 },
         { context: ctx },
      );

      expect(ensureWebhookOwnership).toHaveBeenCalledWith(
         ENDPOINT_ID,
         TEST_TEAM_ID,
      );
      expect(getWebhookDeliveries).toHaveBeenCalledWith(ENDPOINT_ID, {
         offset: 0,
         limit: 50,
      });
      expect(result).toEqual({
         items: mockDeliveries,
         page: 1,
         limit: 50,
      });
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureWebhookOwnership).mockRejectedValueOnce(
         AppError.notFound("Webhook não encontrado."),
      );

      const ctx = createTestContext();
      await expect(
         call(
            webhooksRouter.deliveries,
            { webhookId: ENDPOINT_ID, page: 1, limit: 50 },
            { context: ctx },
         ),
      ).rejects.toThrow("Webhook não encontrado.");
   });
});
