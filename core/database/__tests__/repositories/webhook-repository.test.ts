import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { organization, team } from "@core/database/schemas/auth";
import { events } from "@core/database/schemas/events";
import {
   createWebhookEndpointSchema,
   updateWebhookEndpointSchema,
} from "@core/database/schemas/webhooks";
import * as repo from "../../src/repositories/webhook-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;
let orgId: string;
let teamId: string;

async function seedParents() {
   const [org] = await testDb.db
      .insert(organization)
      .values({
         name: "Test Org",
         slug: `org-${crypto.randomUUID().slice(0, 8)}`,
         createdAt: new Date(),
      })
      .returning();

   const [tm] = await testDb.db
      .insert(team)
      .values({
         name: "Test Team",
         slug: `team-${crypto.randomUUID().slice(0, 8)}`,
         organizationId: org!.id,
         createdAt: new Date(),
      })
      .returning();

   return { orgId: org!.id, teamId: tm!.id };
}

async function seedEvent(orgIdParam: string, teamIdParam: string) {
   const [evt] = await testDb.db
      .insert(events)
      .values({
         organizationId: orgIdParam,
         teamId: teamIdParam,
         eventName: "content.published",
         eventCategory: "content",
         properties: {},
      })
      .returning();
   return evt!;
}

beforeAll(async () => {
   testDb = await setupTestDb();
   const parents = await seedParents();
   orgId = parents.orgId;
   teamId = parents.teamId;
});

afterAll(async () => {
   await testDb.cleanup();
});

function validInput(overrides: Record<string, unknown> = {}) {
   return {
      url: "https://example.com/webhook",
      eventPatterns: ["content.published"],
      ...overrides,
   };
}

describe("webhook-repository", () => {
   describe("validators", () => {
      it("rejects invalid URL", () => {
         const result = createWebhookEndpointSchema.safeParse({
            url: "not-a-url",
            eventPatterns: ["content.published"],
         });
         expect(result.success).toBe(false);
      });

      it("rejects empty eventPatterns", () => {
         const result = createWebhookEndpointSchema.safeParse({
            url: "https://example.com/webhook",
            eventPatterns: [],
         });
         expect(result.success).toBe(false);
      });

      it("accepts valid input", () => {
         const result = createWebhookEndpointSchema.safeParse({
            url: "https://example.com/webhook",
            eventPatterns: ["content.published"],
         });
         expect(result.success).toBe(true);
      });

      it("update schema allows partial", () => {
         const result = updateWebhookEndpointSchema.safeParse({
            isActive: false,
         });
         expect(result.success).toBe(true);
      });
   });

   describe("createWebhookEndpoint", () => {
      it("creates with generated secret (64 chars hex)", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         expect(endpoint).toMatchObject({
            organizationId: orgId,
            teamId,
            url: "https://example.com/webhook",
            eventPatterns: ["content.published"],
            isActive: true,
         });
         expect(endpoint.signingSecret).toHaveLength(64);
         expect(endpoint.signingSecret).toMatch(/^[0-9a-f]{64}$/);
         expect(endpoint.id).toBeDefined();
      });
   });

   describe("listWebhookEndpoints", () => {
      it("lists for team", async () => {
         const parents = await seedParents();
         await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput({ url: "https://a.com/wh" }),
         );
         await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput({ url: "https://b.com/wh" }),
         );

         const list = await repo.listWebhookEndpoints(parents.teamId);
         expect(list).toHaveLength(2);
      });
   });

   describe("getWebhookEndpoint", () => {
      it("returns by id", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         const found = await repo.getWebhookEndpoint(endpoint.id);
         expect(found).toMatchObject({ id: endpoint.id });
      });

      it("returns null for nonexistent", async () => {
         const found = await repo.getWebhookEndpoint(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateWebhookEndpoint", () => {
      it("updates url and isActive", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         const updated = await repo.updateWebhookEndpoint(endpoint.id, {
            url: "https://new.com/wh",
            isActive: false,
         });

         expect(updated.url).toBe("https://new.com/wh");
         expect(updated.isActive).toBe(false);
      });
   });

   describe("deleteWebhookEndpoint", () => {
      it("deletes", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         await repo.deleteWebhookEndpoint(endpoint.id);
         const found = await repo.getWebhookEndpoint(endpoint.id);
         expect(found).toBeNull();
      });
   });

   describe("failure tracking", () => {
      it("incrementWebhookFailureCount increments", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         await repo.incrementWebhookFailureCount(endpoint.id);
         await repo.incrementWebhookFailureCount(endpoint.id);

         const found = await repo.getWebhookEndpoint(endpoint.id);
         expect(found!.failureCount).toBe(2);
         expect(found!.lastFailureAt).toBeDefined();
      });

      it("updateWebhookLastSuccess resets failure count", async () => {
         const endpoint = await repo.createWebhookEndpoint(
            orgId,
            teamId,
            validInput(),
         );

         await repo.incrementWebhookFailureCount(endpoint.id);
         await repo.incrementWebhookFailureCount(endpoint.id);
         await repo.updateWebhookLastSuccess(endpoint.id);

         const found = await repo.getWebhookEndpoint(endpoint.id);
         expect(found!.failureCount).toBe(0);
         expect(found!.lastSuccessAt).toBeDefined();
      });
   });

   describe("findMatchingWebhooks", () => {
      it("matches wildcard patterns", async () => {
         const parents = await seedParents();
         await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput({ eventPatterns: ["content.*"] }),
         );

         const matches = await repo.findMatchingWebhooks(
            parents.orgId,
            "content.published",
            parents.teamId,
         );
         expect(matches).toHaveLength(1);
      });

      it("matches exact", async () => {
         const parents = await seedParents();
         await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput({ eventPatterns: ["form.submitted"] }),
         );

         const matches = await repo.findMatchingWebhooks(
            parents.orgId,
            "form.submitted",
            parents.teamId,
         );
         expect(matches).toHaveLength(1);
      });

      it("excludes inactive", async () => {
         const parents = await seedParents();
         const endpoint = await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput({ eventPatterns: ["content.*"] }),
         );
         await repo.updateWebhookEndpoint(endpoint.id, { isActive: false });

         const matches = await repo.findMatchingWebhooks(
            parents.orgId,
            "content.published",
            parents.teamId,
         );
         expect(matches).toHaveLength(0);
      });
   });

   describe("webhook deliveries", () => {
      it("creates delivery, updates status, lists by endpoint", async () => {
         const parents = await seedParents();
         const endpoint = await repo.createWebhookEndpoint(
            parents.orgId,
            parents.teamId,
            validInput(),
         );
         const evt = await seedEvent(parents.orgId, parents.teamId);

         const delivery = await repo.createWebhookDelivery({
            webhookEndpointId: endpoint.id,
            eventId: evt.id,
            url: endpoint.url,
            eventName: "content.published",
            payload: { test: true },
            status: "pending",
         });

         expect(delivery.status).toBe("pending");

         const updated = await repo.updateWebhookDeliveryStatus(delivery.id, {
            status: "success",
            httpStatusCode: 200,
            deliveredAt: new Date(),
         });
         expect(updated.status).toBe("success");
         expect(updated.httpStatusCode).toBe(200);

         const deliveries = await repo.getWebhookDeliveries(endpoint.id);
         expect(deliveries).toHaveLength(1);
         expect(deliveries[0]!.id).toBe(delivery.id);
      });
   });
});
