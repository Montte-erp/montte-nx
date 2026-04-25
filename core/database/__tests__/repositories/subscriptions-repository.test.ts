import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../../src/testing/setup-test-db";
import { services, servicePrices } from "@core/database/schemas/services";
import { contacts } from "@core/database/schemas/contacts";
import * as repo from "../../src/repositories/subscriptions-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

async function createTestPrice(teamId: string) {
   const [service] = await testDb.db
      .insert(services)
      .values({
         teamId,
         name: "Plano Ouro",
      })
      .returning();
   const [price] = await testDb.db
      .insert(servicePrices)
      .values({
         teamId,
         serviceId: service!.id,
         name: "Mensal",
         basePrice: "399.00",
         type: "flat",
         interval: "monthly",
      })
      .returning();
   return price!;
}

async function createTestContact(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({
         teamId,
         name: `João Silva ${crypto.randomUUID().slice(0, 8)}`,
         type: "cliente",
      })
      .returning();
   return contact!;
}

function validCreateInput(
   contactId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      contactId,
      startDate: "2026-01-01",
      ...overrides,
   };
}

describe("subscriptions-repository", () => {
   describe("createSubscription", () => {
      it("creates with lifecycle fields", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);

         const result = await repo.createSubscription(
            testDb.db,
            teamId,
            validCreateInput(contact.id),
         );

         expect(result.isOk()).toBe(true);
         const sub = result._unsafeUnwrap();

         expect(sub).toMatchObject({
            teamId,
            contactId: contact.id,
            status: "active",
            cancelAtPeriodEnd: false,
         });
         expect(sub.canceledAt).toBeNull();
         expect(sub.id).toBeDefined();
         expect(sub.createdAt).toBeInstanceOf(Date);
      });
   });

   describe("getSubscription", () => {
      it("returns by id", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         const createResult = await repo.createSubscription(
            testDb.db,
            teamId,
            validCreateInput(contact.id),
         );
         const created = createResult._unsafeUnwrap();

         const result = await repo.getSubscription(testDb.db, created.id);
         expect(result.isOk()).toBe(true);
         const found = result._unsafeUnwrap();
         expect(found).toMatchObject({ id: created.id });
      });

      it("returns null for non-existent id", async () => {
         const result = await repo.getSubscription(
            testDb.db,
            crypto.randomUUID(),
         );
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap()).toBeNull();
      });
   });

   describe("updateSubscription", () => {
      it("updates cancelAtPeriodEnd and status", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         const created = (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id),
            )
         )._unsafeUnwrap();

         const result = await repo.updateSubscription(testDb.db, created.id, {
            cancelAtPeriodEnd: true,
            status: "cancelled",
         });

         expect(result.isOk()).toBe(true);
         const updated = result._unsafeUnwrap();
         expect(updated.cancelAtPeriodEnd).toBe(true);
         expect(updated.status).toBe("cancelled");
         expect(updated.id).toBe(created.id);
      });
   });

   describe("listSubscriptionsByTeam", () => {
      it("lists subscriptions for a team", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, {
                  startDate: "2026-02-01",
               }),
            )
         )._unsafeUnwrap();

         const result = await repo.listSubscriptionsByTeam(testDb.db, teamId);
         expect(result.isOk()).toBe(true);
         expect(result._unsafeUnwrap()).toHaveLength(2);
      });

      it("filters by status", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id),
            )
         )._unsafeUnwrap();
         const canceled = (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, {
                  startDate: "2026-02-01",
               }),
            )
         )._unsafeUnwrap();
         await (
            await repo.updateSubscription(testDb.db, canceled.id, {
               status: "cancelled",
            })
         )._unsafeUnwrap();

         const activeResult = await repo.listSubscriptionsByTeam(
            testDb.db,
            teamId,
            "active",
         );
         expect(activeResult._unsafeUnwrap()).toHaveLength(1);

         const canceledResult = await repo.listSubscriptionsByTeam(
            testDb.db,
            teamId,
            "cancelled",
         );
         expect(canceledResult._unsafeUnwrap()).toHaveLength(1);
      });
   });

   describe("listSubscriptionsByContact", () => {
      it("lists subscriptions for a contact", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id),
            )
         )._unsafeUnwrap();

         const result = await repo.listSubscriptionsByContact(
            testDb.db,
            contact.id,
         );
         expect(result.isOk()).toBe(true);
         const list = result._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.contactId).toBe(contact.id);
      });
   });

   describe("upsertSubscriptionByExternalId", () => {
      it("inserts when externalId does not exist", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         const extId = `ext-${crypto.randomUUID().slice(0, 8)}`;

         const result = await repo.upsertSubscriptionByExternalId(
            testDb.db,
            extId,
            {
               teamId,
               ...validCreateInput(contact.id, {
                  externalId: extId,
               }),
            },
         );

         expect(result.isOk()).toBe(true);
         const sub = result._unsafeUnwrap();
         expect(sub.externalId).toBe(extId);
      });

      it("updates when externalId already exists", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);
         const extId = `ext-${crypto.randomUUID().slice(0, 8)}`;

         await (
            await repo.upsertSubscriptionByExternalId(testDb.db, extId, {
               teamId,
               ...validCreateInput(contact.id, {
                  externalId: extId,
               }),
            })
         )._unsafeUnwrap();

         const result = await repo.upsertSubscriptionByExternalId(
            testDb.db,
            extId,
            {
               teamId,
               ...validCreateInput(contact.id, {
                  externalId: extId,
                  status: "completed",
               }),
            },
         );

         expect(result.isOk()).toBe(true);
         const updated = result._unsafeUnwrap();
         expect(updated.status).toBe("completed");
      });
   });

   describe("listExpiringSoon", () => {
      it("lists subscriptions expiring within N days", async () => {
         const teamId = randomTeamId();
         await createTestPrice(teamId);
         const contact = await createTestContact(teamId);

         const now = new Date();
         const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]!;
         const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]!;

         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, { endDate: in7Days }),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, { endDate: in90Days }),
            )
         )._unsafeUnwrap();

         const result = await repo.listExpiringSoon(testDb.db, teamId, 30);
         expect(result.isOk()).toBe(true);
         const expiring = result._unsafeUnwrap();
         expect(expiring).toHaveLength(1);
         expect(expiring[0]!.endDate).toBe(in7Days);
      });
   });
});
