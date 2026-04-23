import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../helpers/setup-test-db";
import * as schema from "@core/database/schema";
import { services, servicePrices } from "@core/database/schemas/services";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { contacts } from "@core/database/schemas/contacts";
import * as repo from "../../src/repositories/subscription-items-repository";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});
afterAll(async () => {
   await testDb.cleanup();
});

function randomSeed() {
   return Math.floor(Math.random() * 1_000_000);
}

async function seedTeam() {
   const orgId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(
      testDb.db,
      { organization: schema.organization },
      { seed: randomSeed() },
   ).refine((f) => ({
      organization: {
         count: 1,
         columns: { id: f.default({ defaultValue: orgId }) },
      },
   }));
   await seed(testDb.db, { team: schema.team }, { seed: randomSeed() }).refine(
      (f) => ({
         team: {
            count: 1,
            columns: {
               id: f.default({ defaultValue: teamId }),
               organizationId: f.default({ defaultValue: orgId }),
            },
         },
      }),
   );
   return teamId;
}

async function seedFixtures(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({
         teamId,
         name: `Maria Oliveira ${crypto.randomUUID()}`,
         type: "cliente",
      })
      .returning();
   const [service] = await testDb.db
      .insert(services)
      .values({ teamId, name: "Plano Básico" })
      .returning();
   const [price] = await testDb.db
      .insert(servicePrices)
      .values({
         teamId,
         serviceId: service!.id,
         name: "Mensal",
         type: "flat",
         basePrice: "99.00",
         interval: "monthly",
      })
      .returning();
   const [subscription] = await testDb.db
      .insert(contactSubscriptions)
      .values({
         teamId,
         contactId: contact!.id,
         startDate: "2026-01-01",
         status: "active",
         source: "manual",
      })
      .returning();
   return {
      contact: contact!,
      price: price!,
      subscription: subscription!,
      service: service!,
   };
}

describe("subscription-items-repository", () => {
   describe("addSubscriptionItem", () => {
      it("adds item to subscription", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const result = await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: subscription.id,
            priceId: price.id,
            quantity: 1,
         });
         const item = result._unsafeUnwrap();
         expect(item.subscriptionId).toBe(subscription.id);
         expect(item.priceId).toBe(price.id);
         expect(item.quantity).toBe(1);
      });

      it("rejects when subscription has 20 items", async () => {
         const teamId = await seedTeam();
         const { price, subscription, service } = await seedFixtures(teamId);
         for (let i = 0; i < 20; i++) {
            const [p] = await testDb.db
               .insert(servicePrices)
               .values({
                  teamId,
                  serviceId: service.id,
                  name: `P${i}`,
                  type: "flat",
                  basePrice: "1.00",
                  interval: "monthly",
               })
               .returning();
            await repo.addSubscriptionItem(testDb.db, teamId, {
               subscriptionId: subscription.id,
               priceId: p!.id,
               quantity: 1,
            });
         }
         const overflow = await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: subscription.id,
            priceId: price.id,
            quantity: 1,
         });
         expect(overflow.isErr()).toBe(true);
      });
   });

   describe("updateSubscriptionItemQuantity", () => {
      it("updates quantity", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const item = (
            await repo.addSubscriptionItem(testDb.db, teamId, {
               subscriptionId: subscription.id,
               priceId: price.id,
               quantity: 1,
            })
         )._unsafeUnwrap();
         const updated = (
            await repo.updateSubscriptionItemQuantity(testDb.db, item.id, {
               quantity: 5,
            })
         )._unsafeUnwrap();
         expect(updated.quantity).toBe(5);
      });

      it("returns err for non-existent item", async () => {
         expect(
            (
               await repo.updateSubscriptionItemQuantity(
                  testDb.db,
                  crypto.randomUUID(),
                  { quantity: 2 },
               )
            ).isErr(),
         ).toBe(true);
      });
   });

   describe("removeSubscriptionItem", () => {
      it("removes item", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const item = (
            await repo.addSubscriptionItem(testDb.db, teamId, {
               subscriptionId: subscription.id,
               priceId: price.id,
               quantity: 1,
            })
         )._unsafeUnwrap();
         await repo.removeSubscriptionItem(testDb.db, item.id);
         expect(
            (
               await repo.listSubscriptionItems(testDb.db, subscription.id)
            )._unsafeUnwrap(),
         ).toHaveLength(0);
      });
   });

   describe("listSubscriptionItems", () => {
      it("returns items for subscription only", async () => {
         const teamId = await seedTeam();
         const { price, subscription } = await seedFixtures(teamId);
         const { subscription: otherSub } = await seedFixtures(teamId);
         await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: subscription.id,
            priceId: price.id,
            quantity: 1,
         });
         await repo.addSubscriptionItem(testDb.db, teamId, {
            subscriptionId: otherSub.id,
            priceId: price.id,
            quantity: 1,
         });
         const list = (
            await repo.listSubscriptionItems(testDb.db, subscription.id)
         )._unsafeUnwrap();
         expect(list).toHaveLength(1);
         expect(list[0]!.subscriptionId).toBe(subscription.id);
      });
   });
});
