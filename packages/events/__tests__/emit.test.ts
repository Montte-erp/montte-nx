import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseInstance } from "@core/database/client";

const {
   mockFindMatchingWebhooks,
   mockCreateWebhookDelivery,
   mockGetEventPrice,
} = vi.hoisted(() => ({
   mockFindMatchingWebhooks: vi.fn().mockResolvedValue([]),
   mockCreateWebhookDelivery: vi.fn().mockResolvedValue({ id: "delivery-1" }),
   mockGetEventPrice: vi.fn().mockResolvedValue({
      price: { amount: 0n, currency: "BRL", scale: 6 },
      isBillable: false,
   }),
}));

vi.mock("@core/database/repositories/webhook-repository", () => ({
   findMatchingWebhooks: mockFindMatchingWebhooks,
   createWebhookDelivery: mockCreateWebhookDelivery,
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         info: vi.fn(),
         warn: vi.fn(),
         error: vi.fn(),
      }),
   }),
}));

vi.mock("@core/redis/connection", () => ({}));

vi.mock("../src/utils", () => ({
   getEventPrice: mockGetEventPrice,
}));

vi.mock("@f-o-t/money", () => ({
   toMajorUnitsString: () => "0.000000",
}));

vi.mock("@core/stripe/constants", () => ({
   STRIPE_METER_EVENTS: {} as Record<string, string>,
}));

import { EVENT_CATEGORIES } from "../src/catalog";
import { emitEvent } from "../src/emit";

function createMockDb() {
   const mockReturning = vi.fn().mockResolvedValue([{ id: "event-1" }]);
   const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
   const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

   const mockLimit = vi
      .fn()
      .mockResolvedValue([{ pricePerEvent: "0", isBillable: false }]);
   const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
   const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
   const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

   return {
      insert: mockInsert,
      select: mockSelect,
   } as unknown as DatabaseInstance;
}

beforeEach(() => {
   vi.clearAllMocks();
});

describe("emitEvent", () => {
   it("inserts event into database", async () => {
      const db = createMockDb();

      await emitEvent({
         db,
         organizationId: "org-1",
         eventName: "finance.transaction_created",
         eventCategory: EVENT_CATEGORIES.finance,
         properties: { transactionId: "tx-1" },
         userId: "user-1",
         teamId: "team-1",
      });

      expect(db.insert).toHaveBeenCalled();
   });

   it("sends to PostHog when client provided", async () => {
      const db = createMockDb();
      const posthog = { capture: vi.fn() };

      await emitEvent({
         db,
         posthog: posthog as any,
         organizationId: "org-1",
         eventName: "ai.chat_message",
         eventCategory: EVENT_CATEGORIES.ai,
         properties: { chatId: "chat-1" },
         userId: "user-1",
      });

      expect(posthog.capture).toHaveBeenCalledWith(
         expect.objectContaining({
            distinctId: "user-1",
            event: "ai.chat_message",
            groups: { organization: "org-1" },
         }),
      );
   });

   it("uses organizationId as distinctId when no userId", async () => {
      const db = createMockDb();
      const posthog = { capture: vi.fn() };

      await emitEvent({
         db,
         posthog: posthog as any,
         organizationId: "org-1",
         eventName: "webhook.delivered",
         eventCategory: EVENT_CATEGORIES.webhook,
         properties: {},
      });

      expect(posthog.capture).toHaveBeenCalledWith(
         expect.objectContaining({
            distinctId: "org-1",
         }),
      );
   });

   it("calls webhook delivery handler when set", async () => {
      const { setWebhookDeliveryHandler } = await import("../src/emit");
      const mockHandler = vi.fn().mockResolvedValue(undefined);
      setWebhookDeliveryHandler(mockHandler);
      afterEach(() => setWebhookDeliveryHandler(null));

      const db = createMockDb();
      mockFindMatchingWebhooks.mockResolvedValueOnce([
         {
            id: "wh-1",
            url: "https://example.com/hook",
            signingSecret: "secret",
         },
      ]);

      await emitEvent({
         db,
         organizationId: "org-1",
         eventName: "finance.transaction_created",
         eventCategory: EVENT_CATEGORIES.finance,
         properties: { foo: "bar" },
         userId: "user-1",
         teamId: "team-1",
      });

      expect(mockFindMatchingWebhooks).toHaveBeenCalledWith(
         expect.anything(),
         "org-1",
         "finance.transaction_created",
         "team-1",
      );
      expect(mockCreateWebhookDelivery).toHaveBeenCalled();
      expect(mockHandler).toHaveBeenCalledWith(
         expect.objectContaining({
            deliveryId: "delivery-1",
            webhookEndpointId: "wh-1",
            url: "https://example.com/hook",
            signingSecret: "secret",
         }),
      );
   });

   it("does not throw on error (non-throwing)", async () => {
      const db = {
         insert: vi.fn().mockImplementation(() => {
            throw new Error("DB down");
         }),
         select: vi.fn(),
      } as unknown as DatabaseInstance;

      await expect(
         emitEvent({
            db,
            organizationId: "org-1",
            eventName: "ai.chat_message",
            eventCategory: EVENT_CATEGORIES.ai,
            properties: {},
         }),
      ).resolves.toBeUndefined();
   });
});
