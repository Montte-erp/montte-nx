import { ORPCError, call } from "@orpc/server";
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

vi.mock("@packages/analytics/compute-insight", () => ({
   computeInsightData: vi.fn().mockResolvedValue({}),
}));
vi.mock("@packages/analytics/seed-defaults", () => ({
   createDefaultInsights: vi.fn().mockResolvedValue([]),
   createDefaultDashboard: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@core/database/repositories/insight-repository", () => ({
   getInsightById: vi.fn().mockResolvedValue(null),
}));

import { categories } from "@core/database/schemas/categories";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { transactions } from "@core/database/schemas/transactions";
import { sql } from "drizzle-orm";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as onboardingRouter from "@/integrations/orpc/router/onboarding";

let ctx: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(sql`DELETE FROM transactions`);
   await ctx.db.execute(sql`DELETE FROM bank_accounts`);
   await ctx.db.execute(sql`DELETE FROM categories`);
});

describe("createWorkspace", () => {
   it("throws when organization creation returns no id", async () => {
      const failAuthCtx: ORPCContextWithAuth = {
         ...ctx,
         auth: {
            ...ctx.auth,
            api: {
               ...ctx.auth.api,
               createOrganization: vi.fn().mockResolvedValue(null),
            } as any,
         },
      };

      await expect(
         call(onboardingRouter.createWorkspace, { workspaceName: "Test Org" }, { context: failAuthCtx }),
      ).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR");
   });

   it("throws when team creation returns no id", async () => {
      const failTeamAuthCtx: ORPCContextWithAuth = {
         ...ctx,
         auth: {
            ...ctx.auth,
            api: {
               ...ctx.auth.api,
               createOrganization: vi.fn().mockResolvedValue({ id: "org-fake-id", slug: "fake-slug" }),
               setActiveOrganization: vi.fn().mockResolvedValue(undefined),
               createTeam: vi.fn().mockResolvedValue(null),
            } as any,
         },
      };

      await expect(
         call(onboardingRouter.createWorkspace, { workspaceName: "Test Org" }, { context: failTeamAuthCtx }),
      ).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "INTERNAL_SERVER_ERROR");
   });
});

describe("getOnboardingStatus", () => {
   it("throws NOT_FOUND when organization does not exist", async () => {
      const orphanCtx: ORPCContextWithAuth = {
         ...ctx,
         session: {
            ...ctx.session!,
            session: {
               ...ctx.session!.session,
               activeOrganizationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            },
         },
      };

      await expect(
         call(onboardingRouter.getOnboardingStatus, undefined, { context: orphanCtx }),
      ).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "NOT_FOUND");
   });

   it("throws NOT_FOUND when team does not exist", async () => {
      const fakeTeamCtx: ORPCContextWithAuth = {
         ...ctx,
         session: {
            ...ctx.session!,
            session: {
               ...ctx.session!.session,
               activeTeamId: "aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff",
            },
         },
      };

      await expect(
         call(onboardingRouter.getOnboardingStatus, undefined, { context: fakeTeamCtx }),
      ).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "NOT_FOUND");
   });

   it("returns onboarding status with auto-detected tasks", async () => {
      const teamId = ctx.session!.session.activeTeamId!;

      await ctx.db.insert(categories).values({
         teamId,
         name: "Test Category",
         type: "expense",
      });

      await ctx.db.insert(bankAccounts).values({
         teamId,
         name: "Test Bank",
         type: "checking",
      });

      await ctx.db.insert(transactions).values({
         teamId,
         type: "income",
         amount: "100.00",
         date: "2025-01-15",
      });

      const result = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(result.organization).toBeDefined();
      expect(result.project).toBeDefined();
      expect(result.project.tasks).toEqual(
         expect.objectContaining({
            create_category: true,
            add_transaction: true,
            connect_bank_account: true,
         }),
      );
   });

   it("returns null tasks when no data exists", async () => {
      const result = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(result.organization.onboardingCompleted).toBeDefined();
      expect(result.project.tasks).toBeNull();
   });
});

describe("completeTask", () => {
   it("atomically merges task into team onboardingTasks", async () => {
      const result = await call(
         onboardingRouter.completeTask,
         { taskId: "setup_profile" },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const status = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(status.project.tasks).toEqual(
         expect.objectContaining({ setup_profile: true }),
      );
   });

   it("merges multiple tasks without overwriting", async () => {
      await call(
         onboardingRouter.completeTask,
         { taskId: "setup_profile" },
         { context: ctx },
      );
      await call(
         onboardingRouter.completeTask,
         { taskId: "invite_team" },
         { context: ctx },
      );

      const status = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(status.project.tasks).toEqual(
         expect.objectContaining({
            setup_profile: true,
            invite_team: true,
         }),
      );
   });
});

describe("skipTask", () => {
   it("marks task as done (same as completeTask)", async () => {
      const result = await call(
         onboardingRouter.skipTask,
         { taskId: "invite_team" },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });

      const status = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(status.project.tasks).toEqual(
         expect.objectContaining({ invite_team: true }),
      );
   });
});

describe("fixOnboarding", () => {
   it("throws NOT_FOUND when organization does not exist", async () => {
      await expect(
         call(
            onboardingRouter.fixOnboarding,
            { organizationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
            { context: ctx },
         ),
      ).rejects.toSatisfy((e: ORPCError<string, unknown>) => e.code === "NOT_FOUND");
   });
});
