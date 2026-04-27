import {
   afterAll,
   beforeAll,
   beforeEach,
   describe,
   expect,
   it,
   vi,
} from "vitest";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { coupons } from "@core/database/schemas/coupons";
import { makeCoupon } from "../helpers/billing-factories";
import { createHyprpayMock } from "../helpers/hyprpay-mock";

vi.mock("@core/orpc/server", async () =>
   (await import("@core/orpc/testing/mock-server")).createMockServerModule(),
);

import * as couponsRouter from "../../src/router/coupons";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
}, 30_000);

afterAll(async () => {
   await testDb.cleanup();
});

beforeEach(() => {
   vi.clearAllMocks();
});

describe("coupons router", () => {
   describe("list", () => {
      it("returns only current team's coupons ordered by createdAt asc", async () => {
         const { teamId: teamA } = await seedTeam(testDb.db);
         const { teamId: teamB } = await seedTeam(testDb.db);
         await makeCoupon(testDb.db, { teamId: teamA, code: "A1" });
         await makeCoupon(testDb.db, { teamId: teamA, code: "A2" });
         await makeCoupon(testDb.db, { teamId: teamB, code: "B1" });

         const ctx = createTestContext(testDb.db, {
            teamId: teamA,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(couponsRouter.list, undefined, {
            context: ctx,
         });
         expect(result.map((c) => c.code)).toEqual(["A1", "A2"]);
      });
   });

   describe("get", () => {
      it("returns coupon belonging to the same team", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, { teamId, code: "OWN" });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.get,
            { id: coupon.id },
            { context: ctx },
         );
         expect(result.id).toBe(coupon.id);
         expect(result.code).toBe("OWN");
      });

      it("throws NOT_FOUND when coupon belongs to another team", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, { teamId: otherTeamId });
         const { teamId: callerTeamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId: callerTeamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(couponsRouter.get, { id: coupon.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });

   describe("create", () => {
      it("inserts row with teamId matching context on happy path", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.create,
            {
               code: "NEW10",
               scope: "team",
               type: "percent",
               amount: "10",
               duration: "once",
            },
            { context: ctx },
         );
         expect(result.teamId).toBe(teamId);
         expect(result.code).toBe("NEW10");
         expect(result.type).toBe("percent");
         expect(result.duration).toBe("once");
      });

      it("throws CONFLICT when coupon code exists (case-insensitive)", async () => {
         const { teamId } = await seedTeam(testDb.db);
         await makeCoupon(testDb.db, { teamId, code: "PROMO" });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               couponsRouter.create,
               {
                  code: "promo",
                  scope: "team",
                  type: "percent",
                  amount: "10",
                  duration: "once",
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "CONFLICT",
         );
      });

      it("throws zod failure when scope=price without priceId", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               couponsRouter.create,
               {
                  code: "NOPRICE",
                  scope: "price",
                  type: "percent",
                  amount: "10",
                  duration: "once",
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) =>
               e.code === "INPUT_VALIDATION_FAILED" || e.code === "BAD_REQUEST",
         );
      });

      it("throws zod failure when duration=repeating without durationMonths", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               couponsRouter.create,
               {
                  code: "REPEAT",
                  scope: "team",
                  type: "percent",
                  amount: "10",
                  duration: "repeating",
               },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) =>
               e.code === "INPUT_VALIDATION_FAILED" || e.code === "BAD_REQUEST",
         );
      });
   });

   describe("update", () => {
      it("flips isActive to false and returns updated row", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, {
            teamId,
            code: "UPD",
            isActive: true,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.update,
            { id: coupon.id, isActive: false },
            { context: ctx },
         );
         expect(result.id).toBe(coupon.id);
         expect(result.isActive).toBe(false);

         const [persisted] = await testDb.db
            .select()
            .from(coupons)
            .where(eq(coupons.id, coupon.id));
         expect(persisted?.isActive).toBe(false);
      });

      it("throws NOT_FOUND when updating cross-team coupon", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, { teamId: otherTeamId });
         const { teamId: callerTeamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId: callerTeamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(
               couponsRouter.update,
               { id: coupon.id, isActive: false },
               { context: ctx },
            ),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });

   describe("deactivate", () => {
      it("sets isActive to false", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, {
            teamId,
            code: "DEACT",
            isActive: true,
         });

         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.deactivate,
            { id: coupon.id },
            { context: ctx },
         );
         expect(result.id).toBe(coupon.id);
         expect(result.isActive).toBe(false);
      });

      it("throws NOT_FOUND when deactivating cross-team coupon", async () => {
         const { teamId: otherTeamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, { teamId: otherTeamId });
         const { teamId: callerTeamId } = await seedTeam(testDb.db);

         const ctx = createTestContext(testDb.db, {
            teamId: callerTeamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         await expect(
            call(couponsRouter.deactivate, { id: coupon.id }, { context: ctx }),
         ).rejects.toSatisfy(
            (e: Error & { code?: string }) => e.code === "NOT_FOUND",
         );
      });
   });

   describe("validate", () => {
      it("returns not_found when coupon does not exist", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.validate,
            { code: "DOES-NOT-EXIST" },
            { context: ctx },
         );
         expect(result).toEqual({ valid: false, reason: "not_found" });
      });

      it("returns inactive when coupon isActive=false", async () => {
         const { teamId } = await seedTeam(testDb.db);
         const coupon = await makeCoupon(testDb.db, {
            teamId,
            code: "INACTIVE",
         });
         await testDb.db
            .update(coupons)
            .set({ isActive: false })
            .where(eq(coupons.id, coupon.id));
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.validate,
            { code: "INACTIVE" },
            { context: ctx },
         );
         expect(result).toEqual({ valid: false, reason: "inactive" });
      });

      it("returns valid: true with coupon detail when active", async () => {
         const { teamId } = await seedTeam(testDb.db);
         await makeCoupon(testDb.db, { teamId, code: "VALID" });
         const ctx = createTestContext(testDb.db, {
            teamId,
            extras: { hyprpayClient: createHyprpayMock() },
         });
         const result = await call(
            couponsRouter.validate,
            { code: "VALID" },
            { context: ctx },
         );
         expect(result.valid).toBe(true);
         if (result.valid) expect(result.coupon.code).toBe("VALID");
      });
   });
});
