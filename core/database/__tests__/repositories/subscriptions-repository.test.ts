import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { services, serviceVariants } from "@core/database/schemas/services";
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

async function createTestVariant(teamId: string) {
   const [service] = await testDb.db
      .insert(services)
      .values({
         teamId,
         name: "Plano Ouro",
         basePrice: "399.00",
      })
      .returning();
   const [variant] = await testDb.db
      .insert(serviceVariants)
      .values({
         teamId,
         serviceId: service!.id,
         name: "Mensal",
         basePrice: "399.00",
         billingCycle: "monthly",
      })
      .returning();
   return variant!;
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
   variantId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      contactId,
      variantId,
      startDate: "2026-01-01",
      negotiatedPrice: "399.00",
      currentPeriodStart: "2026-01-01",
      currentPeriodEnd: "2026-01-31",
      ...overrides,
   };
}

async function unwrap<T>(
   result: Awaited<ReturnType<typeof repo.createSubscription>>,
): Promise<T> {
   const r = result as { isOk(): boolean; value: T; error: unknown };
   if (!r.isOk()) throw r.error;
   return r.value;
}

describe("subscriptions-repository", () => {
   describe("createSubscription", () => {
      it("creates with lifecycle fields", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         const result = await repo.createSubscription(
            testDb.db,
            teamId,
            validCreateInput(contact.id, variant.id),
         );

         expect(result.isOk()).toBe(true);
         const sub = result._unsafeUnwrap();

         expect(sub).toMatchObject({
            teamId,
            contactId: contact.id,
            variantId: variant.id,
            status: "active",
            cancelAtPeriodEnd: false,
            currentPeriodStart: "2026-01-01",
            currentPeriodEnd: "2026-01-31",
         });
         expect(sub.canceledAt).toBeNull();
         expect(sub.id).toBeDefined();
         expect(sub.createdAt).toBeInstanceOf(Date);
      });
   });

   describe("getSubscription", () => {
      it("returns by id", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const createResult = await repo.createSubscription(
            testDb.db,
            teamId,
            validCreateInput(contact.id, variant.id),
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
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const created = (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id),
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
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id, {
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
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id),
            )
         )._unsafeUnwrap();
         const canceled = (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id, {
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
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id),
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
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const extId = `ext-${crypto.randomUUID().slice(0, 8)}`;

         const result = await repo.upsertSubscriptionByExternalId(
            testDb.db,
            extId,
            {
               teamId,
               ...validCreateInput(contact.id, variant.id, {
                  externalId: extId,
               }),
            },
         );

         expect(result.isOk()).toBe(true);
         const sub = result._unsafeUnwrap();
         expect(sub.externalId).toBe(extId);
         expect(sub.negotiatedPrice).toBe("399.00");
      });

      it("updates when externalId already exists", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);
         const extId = `ext-${crypto.randomUUID().slice(0, 8)}`;

         await (
            await repo.upsertSubscriptionByExternalId(testDb.db, extId, {
               teamId,
               ...validCreateInput(contact.id, variant.id, {
                  externalId: extId,
               }),
            })
         )._unsafeUnwrap();

         const result = await repo.upsertSubscriptionByExternalId(
            testDb.db,
            extId,
            {
               teamId,
               ...validCreateInput(contact.id, variant.id, {
                  externalId: extId,
                  negotiatedPrice: "499.00",
                  status: "completed",
               }),
            },
         );

         expect(result.isOk()).toBe(true);
         const updated = result._unsafeUnwrap();
         expect(updated.negotiatedPrice).toBe("499.00");
         expect(updated.status).toBe("completed");
      });
   });

   describe("countActiveSubscriptionsByVariant", () => {
      it("counts active subscriptions grouped by variant", async () => {
         const teamId = randomTeamId();
         const variant1 = await createTestVariant(teamId);
         const variant2 = await createTestVariant(teamId);
         const contact = await createTestContact(teamId);

         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant1.id),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant1.id),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant2.id),
            )
         )._unsafeUnwrap();
         const canceled = (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant2.id),
            )
         )._unsafeUnwrap();
         await (
            await repo.updateSubscription(testDb.db, canceled.id, {
               status: "cancelled",
            })
         )._unsafeUnwrap();

         const result = await repo.countActiveSubscriptionsByVariant(
            testDb.db,
            teamId,
         );
         expect(result.isOk()).toBe(true);
         const counts = result._unsafeUnwrap();
         const v1Count = counts.find((c) => c.variantId === variant1.id);
         const v2Count = counts.find((c) => c.variantId === variant2.id);

         expect(v1Count!.count).toBe(2);
         expect(v2Count!.count).toBe(1);
      });
   });

   describe("listExpiringSoon", () => {
      it("lists subscriptions expiring within N days", async () => {
         const teamId = randomTeamId();
         const variant = await createTestVariant(teamId);
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
               validCreateInput(contact.id, variant.id, { endDate: in7Days }),
            )
         )._unsafeUnwrap();
         await (
            await repo.createSubscription(
               testDb.db,
               teamId,
               validCreateInput(contact.id, variant.id, { endDate: in90Days }),
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
