import { ORPCError, call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   createTestContext,
} from "../../../helpers/create-test-context";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that touches the modules
// ---------------------------------------------------------------------------

vi.mock("@packages/analytics/compute-insight", () => ({
   computeInsightData: vi.fn().mockResolvedValue({}),
}));
vi.mock("@core/database/default-insights", () => ({
   DEFAULT_INSIGHTS: [{ defaultSize: "md" }, { defaultSize: "lg" }],
}));
vi.mock("@core/database/repositories/dashboard-repository", () => ({
   createDefaultInsights: vi.fn().mockResolvedValue(["insight-1", "insight-2"]),
}));
vi.mock("@core/database/repositories/insight-repository", () => ({
   getInsightById: vi.fn().mockResolvedValue(null),
}));
vi.mock("@core/database/schemas/auth", () => ({
   organization: {
      id: "id",
      slug: "slug",
      onboardingCompleted: "onboardingCompleted",
      name: "name",
   },
   team: {
      id: "id",
      name: "name",
      organizationId: "organizationId",
      onboardingTasks: "onboardingTasks",
      onboardingCompleted: "onboardingCompleted",
      onboardingProducts: "onboardingProducts",
   },
}));
vi.mock("@core/database/schemas/content", () => ({
   content: { organizationId: "organizationId", status: "status" },
}));
vi.mock("@core/database/schemas/forms", () => ({
   forms: { organizationId: "organizationId" },
}));
vi.mock("@core/database/schemas/insights", () => ({
   insights: {
      id: "id",
      organizationId: "organizationId",
      cachedResults: "cachedResults",
      lastComputedAt: "lastComputedAt",
   },
}));
vi.mock("@core/database/schemas/dashboards", () => ({
   dashboards: {
      id: "id",
      organizationId: "organizationId",
      teamId: "teamId",
      isDefault: "isDefault",
   },
}));

import * as onboardingRouter from "@/integrations/orpc/router/onboarding";

// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

function createMockDb() {
   const mockWhere = vi.fn();
   const mockLimit = vi.fn();
   const mockFrom = vi.fn();
   const mockSet = vi.fn();

   // Chain: db.select().from().where() — returns thenable for count queries
   mockWhere.mockReturnValue({
      then: vi.fn((cb: any) => cb([{ count: 0 }])),
      limit: mockLimit,
   });
   mockLimit.mockResolvedValue([]);
   mockFrom.mockReturnValue({ where: mockWhere });

   // Chain: db.update().set().where()
   const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
   mockSet.mockReturnValue({ where: mockUpdateWhere });

   return {
      db: {
         query: {
            organization: {
               findFirst: vi.fn(),
            },
            team: {
               findFirst: vi.fn(),
            },
         },
         select: vi.fn().mockReturnValue({ from: mockFrom }),
         update: vi.fn().mockReturnValue({ set: mockSet }),
      },
      mockFrom,
      mockWhere,
      mockLimit,
      mockSet,
      mockUpdateWhere,
   };
}

function createOnboardingContext(
   mockDb: ReturnType<typeof createMockDb>["db"],
   overrides: Record<string, unknown> = {},
) {
   return createTestContext({
      db: mockDb,
      ...overrides,
   });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mocks: ReturnType<typeof createMockDb>;

beforeEach(() => {
   vi.clearAllMocks();
   mocks = createMockDb();
});

// =============================================================================
// getOnboardingStatus
// =============================================================================

describe("getOnboardingStatus", () => {
   it("returns onboarding status with auto-detected tasks", async () => {
      mocks.db.query.organization.findFirst.mockResolvedValueOnce({
         id: TEST_ORG_ID,
         onboardingCompleted: false,
         name: "Test Org",
         slug: "test-org",
      });

      mocks.db.query.team.findFirst.mockResolvedValueOnce({
         id: TEST_TEAM_ID,
         name: "Test Team",
         organizationId: TEST_ORG_ID,
         onboardingCompleted: false,
         onboardingProducts: ["finance"],
         onboardingTasks: { setup_profile: true },
      });

      // Mock the 3 count queries (Promise.all): insights=1, categories=1, transactions=2
      let callIndex = 0;
      const counts = [1, 1, 2];
      mocks.mockWhere.mockImplementation(() => ({
         then: vi.fn((cb: any) => cb([{ count: counts[callIndex++] }])),
         limit: mocks.mockLimit,
      }));

      const ctx = createOnboardingContext(mocks.db);
      const result = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(mocks.db.query.organization.findFirst).toHaveBeenCalled();
      expect(result.organization.onboardingCompleted).toBe(false);
      expect(result.project.onboardingProducts).toEqual(["finance"]);
      expect(result.project.tasks).toEqual(
         expect.objectContaining({
            setup_profile: true,
            create_insight: true,
            create_category: true,
            add_transaction: true,
         }),
      );
   });

   it("throws NOT_FOUND when organization does not exist", async () => {
      mocks.db.query.organization.findFirst.mockResolvedValueOnce(null);

      const ctx = createOnboardingContext(mocks.db);

      await expect(
         call(onboardingRouter.getOnboardingStatus, undefined, {
            context: ctx,
         }),
      ).rejects.toSatisfy(
         (e: ORPCError<string, unknown>) => e.code === "NOT_FOUND",
      );
   });

   it("throws NOT_FOUND when team does not exist", async () => {
      mocks.db.query.organization.findFirst.mockResolvedValueOnce({
         id: TEST_ORG_ID,
         onboardingCompleted: false,
         name: "Test Org",
         slug: "test-org",
      });
      mocks.db.query.team.findFirst.mockResolvedValueOnce(null);

      const ctx = createOnboardingContext(mocks.db);

      await expect(
         call(onboardingRouter.getOnboardingStatus, undefined, {
            context: ctx,
         }),
      ).rejects.toSatisfy(
         (e: ORPCError<string, unknown>) => e.code === "NOT_FOUND",
      );
   });

   it("returns null tasks when org is fresh", async () => {
      mocks.db.query.organization.findFirst.mockResolvedValueOnce({
         id: TEST_ORG_ID,
         onboardingCompleted: false,
         name: "Test Org",
         slug: "test-org",
      });
      mocks.db.query.team.findFirst.mockResolvedValueOnce({
         id: TEST_TEAM_ID,
         name: "Test Team",
         organizationId: TEST_ORG_ID,
         onboardingCompleted: false,
         onboardingProducts: null,
         onboardingTasks: null,
      });

      // All count queries return 0
      mocks.mockWhere.mockImplementation(() => ({
         then: vi.fn((cb: any) => cb([{ count: 0 }])),
         limit: mocks.mockLimit,
      }));

      const ctx = createOnboardingContext(mocks.db);
      const result = await call(
         onboardingRouter.getOnboardingStatus,
         undefined,
         { context: ctx },
      );

      expect(result.organization.onboardingCompleted).toBe(false);
      expect(result.project.onboardingProducts).toBeNull();
      expect(result.project.tasks).toBeNull();
   });
});

// =============================================================================
// completeTask
// =============================================================================

describe("completeTask", () => {
   it("atomically merges task into team onboardingTasks", async () => {
      const ctx = createOnboardingContext(mocks.db);
      const result = await call(
         onboardingRouter.completeTask,
         { taskId: "setup_profile" },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });
      expect(mocks.db.update).toHaveBeenCalled();
      expect(mocks.mockSet).toHaveBeenCalled();
   });
});

// =============================================================================
// skipTask
// =============================================================================

describe("skipTask", () => {
   it("marks task as done (same as completeTask)", async () => {
      const ctx = createOnboardingContext(mocks.db);
      const result = await call(
         onboardingRouter.skipTask,
         { taskId: "invite_team" },
         { context: ctx },
      );

      expect(result).toEqual({ success: true });
      expect(mocks.db.update).toHaveBeenCalled();
      expect(mocks.mockSet).toHaveBeenCalled();
   });
});
