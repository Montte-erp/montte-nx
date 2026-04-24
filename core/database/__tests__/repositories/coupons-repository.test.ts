import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { seed } from "drizzle-seed";
import { setupTestDb } from "../../src/testing/setup-test-db";
import * as schema from "@core/database/schema";
import { contacts } from "@core/database/schemas/contacts";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import * as repo from "../../src/repositories/coupons-repository";
import dayjs from "dayjs";

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

async function seedContactAndSubscription(teamId: string) {
   const [contact] = await testDb.db
      .insert(contacts)
      .values({
         teamId,
         name: `Carlos Lima ${crypto.randomUUID()}`,
         type: "cliente",
      })
      .returning();
   const [sub] = await testDb.db
      .insert(contactSubscriptions)
      .values({
         teamId,
         contactId: contact!.id,
         startDate: "2026-01-01",
         status: "active",
         source: "manual",
      })
      .returning();
   return { contact: contact!, subscription: sub! };
}

function validCouponInput(overrides: Record<string, unknown> = {}) {
   return {
      code: `PROMO${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      type: "percent" as const,
      amount: "10",
      duration: "once" as const,
      ...overrides,
   };
}

describe("coupons-repository", () => {
   describe("createCoupon", () => {
      it("creates coupon with correct fields", async () => {
         const teamId = await seedTeam();
         const coupon = (
            await repo.createCoupon(
               testDb.db,
               teamId,
               validCouponInput({ code: "SUMMER20" }),
            )
         )._unsafeUnwrap();
         expect(coupon.code).toBe("SUMMER20");
         expect(coupon.usedCount).toBe(0);
         expect(coupon.isActive).toBe(true);
      });

      it("rejects duplicate code on same team (case-insensitive)", async () => {
         const teamId = await seedTeam();
         await repo.createCoupon(
            testDb.db,
            teamId,
            validCouponInput({ code: "DUPCODE" }),
         );
         expect(
            (
               await repo.createCoupon(
                  testDb.db,
                  teamId,
                  validCouponInput({ code: "dupcode" }),
               )
            ).isErr(),
         ).toBe(true);
      });

      it("allows same code on different teams", async () => {
         const [teamA, teamB] = await Promise.all([seedTeam(), seedTeam()]);
         const a = await repo.createCoupon(
            testDb.db,
            teamA,
            validCouponInput({ code: "SHARED" }),
         );
         const b = await repo.createCoupon(
            testDb.db,
            teamB,
            validCouponInput({ code: "SHARED" }),
         );
         expect(a.isOk()).toBe(true);
         expect(b.isOk()).toBe(true);
      });
   });

   describe("getCouponByCode", () => {
      it("finds by code case-insensitively", async () => {
         const teamId = await seedTeam();
         await repo.createCoupon(
            testDb.db,
            teamId,
            validCouponInput({ code: "FINDME" }),
         );
         const found = (
            await repo.getCouponByCode(testDb.db, teamId, "findme")
         )._unsafeUnwrap();
         expect(found?.code).toBe("FINDME");
      });

      it("returns null for missing code", async () => {
         const teamId = await seedTeam();
         expect(
            (
               await repo.getCouponByCode(testDb.db, teamId, "NOPE")
            )._unsafeUnwrap(),
         ).toBeNull();
      });
   });

   describe("redeemCoupon", () => {
      it("creates redemption with snapshot and increments usedCount", async () => {
         const teamId = await seedTeam();
         const coupon = (
            await repo.createCoupon(
               testDb.db,
               teamId,
               validCouponInput({ code: "SNAP10" }),
            )
         )._unsafeUnwrap();
         const { contact, subscription } =
            await seedContactAndSubscription(teamId);
         const redemption = (
            await repo.redeemCoupon(testDb.db, teamId, {
               couponId: coupon.id,
               subscriptionId: subscription.id,
               contactId: contact.id,
            })
         )._unsafeUnwrap();
         expect(redemption.discountSnapshot.code).toBe("SNAP10");
         const updated = (
            await repo.getCoupon(testDb.db, coupon.id)
         )._unsafeUnwrap();
         expect(updated?.usedCount).toBe(1);
      });

      it("rejects when maxUses reached", async () => {
         const teamId = await seedTeam();
         const coupon = (
            await repo.createCoupon(
               testDb.db,
               teamId,
               validCouponInput({ code: "MAXONE", maxUses: 1 }),
            )
         )._unsafeUnwrap();
         const { contact, subscription } =
            await seedContactAndSubscription(teamId);
         await repo.redeemCoupon(testDb.db, teamId, {
            couponId: coupon.id,
            subscriptionId: subscription.id,
            contactId: contact.id,
         });
         const { subscription: sub2 } =
            await seedContactAndSubscription(teamId);
         expect(
            (
               await repo.redeemCoupon(testDb.db, teamId, {
                  couponId: coupon.id,
                  subscriptionId: sub2.id,
                  contactId: contact.id,
               })
            ).isErr(),
         ).toBe(true);
      });

      it("rejects when coupon expired", async () => {
         const teamId = await seedTeam();
         const coupon = (
            await repo.createCoupon(
               testDb.db,
               teamId,
               validCouponInput({
                  code: "EXPIRED",
                  redeemBy: dayjs().subtract(1, "day").toDate().toISOString(),
               }),
            )
         )._unsafeUnwrap();
         const { contact, subscription } =
            await seedContactAndSubscription(teamId);
         expect(
            (
               await repo.redeemCoupon(testDb.db, teamId, {
                  couponId: coupon.id,
                  subscriptionId: subscription.id,
                  contactId: contact.id,
               })
            ).isErr(),
         ).toBe(true);
      });

      it("rejects when coupon inactive", async () => {
         const teamId = await seedTeam();
         const coupon = (
            await repo.createCoupon(
               testDb.db,
               teamId,
               validCouponInput({ code: "INACTIVE" }),
            )
         )._unsafeUnwrap();
         await repo.updateCoupon(testDb.db, coupon.id, { isActive: false });
         const { contact, subscription } =
            await seedContactAndSubscription(teamId);
         expect(
            (
               await repo.redeemCoupon(testDb.db, teamId, {
                  couponId: coupon.id,
                  subscriptionId: subscription.id,
                  contactId: contact.id,
               })
            ).isErr(),
         ).toBe(true);
      });
   });
});
