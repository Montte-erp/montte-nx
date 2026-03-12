import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
   TEST_ORG_ID,
   TEST_TEAM_ID,
   TEST_USER_ID,
   createTestContext,
} from "../../../helpers/create-test-context";
import { INSIGHT_ID, makeInsight } from "../../../helpers/mock-factories";

vi.mock("@core/database/client", () => ({ db: {} }));
vi.mock("@core/database/repositories/insight-repository");
vi.mock("@core/database/repositories/dashboard-repository");
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
vi.mock("@core/logging/root", () => ({
   getLogger: () => ({ child: () => ({ warn: vi.fn(), error: vi.fn() }) }),
}));
vi.mock("@packages/events/emit", () => ({
   createEmitFn: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("@packages/analytics/compute-insight", () => ({
   computeInsightData: vi.fn(),
}));
vi.mock("@packages/events/insight");

import {
   createInsight,
   deleteInsight,
   ensureInsightOwnership,
   listInsightsByTeam,
   updateInsight,
} from "@core/database/repositories/insight-repository";
import {
   emitInsightCreated,
   emitInsightDeleted,
   emitInsightUpdated,
} from "@packages/events/insight";
import { AppError } from "@core/logging/errors";

import * as insightsRouter from "@/integrations/orpc/router/insights";

beforeEach(() => {
   vi.clearAllMocks();
   vi.mocked(emitInsightCreated).mockResolvedValue(undefined);
   vi.mocked(emitInsightUpdated).mockResolvedValue(undefined);
   vi.mocked(emitInsightDeleted).mockResolvedValue(undefined);
});

describe("create", () => {
   const input = {
      name: "My Insight",
      description: "Test insight",
      type: "kpi" as const,
      config: {
         type: "kpi" as const,
         measure: { aggregation: "sum" as const },
         filters: {
            dateRange: { type: "relative" as const, value: "30d" as const },
         },
      },
   };

   it("creates insight and returns data", async () => {
      const insight = makeInsight();
      vi.mocked(createInsight).mockResolvedValueOnce(insight);

      const result = await call(insightsRouter.create, input, {
         context: createTestContext(),
      });

      expect(createInsight).toHaveBeenCalledWith(
         TEST_ORG_ID,
         TEST_TEAM_ID,
         TEST_USER_ID,
         expect.objectContaining({
            name: input.name,
            description: input.description,
            type: input.type,
            config: expect.objectContaining({ type: "kpi" }),
            defaultSize: "md",
         }),
      );
      expect(result).toEqual(insight);
   });

   it("emits insight.created event", async () => {
      const insight = makeInsight();
      vi.mocked(createInsight).mockResolvedValueOnce(insight);

      await call(insightsRouter.create, input, {
         context: createTestContext(),
      });

      expect(emitInsightCreated).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            insightId: INSIGHT_ID,
            name: input.name,
         }),
      );
   });
});

describe("list", () => {
   it("returns list of insights", async () => {
      const insights = [
         makeInsight(),
         makeInsight({ id: "insight-2", name: "Second Insight" }),
      ];
      vi.mocked(listInsightsByTeam).mockResolvedValueOnce(insights);

      const result = await call(insightsRouter.list, undefined, {
         context: createTestContext(),
      });

      expect(listInsightsByTeam).toHaveBeenCalledWith(TEST_TEAM_ID, undefined);
      expect(result).toHaveLength(2);
   });

   it("passes type filter when provided", async () => {
      vi.mocked(listInsightsByTeam).mockResolvedValueOnce([]);

      await call(
         insightsRouter.list,
         { type: "breakdown" },
         {
            context: createTestContext(),
         },
      );

      expect(listInsightsByTeam).toHaveBeenCalledWith(
         TEST_TEAM_ID,
         "breakdown",
      );
   });
});

describe("getById", () => {
   it("returns insight by id", async () => {
      const insight = makeInsight();
      vi.mocked(ensureInsightOwnership).mockResolvedValueOnce(insight);

      const result = await call(
         insightsRouter.getById,
         { id: INSIGHT_ID },
         { context: createTestContext() },
      );

      expect(ensureInsightOwnership).toHaveBeenCalledWith(
         INSIGHT_ID,
         TEST_ORG_ID,
         TEST_TEAM_ID,
      );
      expect(result).toEqual(insight);
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureInsightOwnership).mockRejectedValueOnce(
         AppError.notFound("Insight não encontrado."),
      );

      await expect(
         call(
            insightsRouter.getById,
            { id: INSIGHT_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Insight não encontrado.");
   });
});

describe("update", () => {
   const input = {
      id: INSIGHT_ID,
      name: "Updated Insight",
      description: "Updated description",
   };

   it("updates insight and emits event", async () => {
      vi.mocked(ensureInsightOwnership).mockResolvedValueOnce(makeInsight());
      const updated = makeInsight({
         name: "Updated Insight",
         description: "Updated description",
      });
      vi.mocked(updateInsight).mockResolvedValueOnce(updated);

      const result = await call(insightsRouter.update, input, {
         context: createTestContext(),
      });

      expect(ensureInsightOwnership).toHaveBeenCalledWith(
         INSIGHT_ID,
         TEST_ORG_ID,
         TEST_TEAM_ID,
      );
      expect(updateInsight).toHaveBeenCalledWith(
         INSIGHT_ID,
         expect.objectContaining({
            name: "Updated Insight",
            description: "Updated description",
         }),
      );
      expect(result).toEqual(updated);

      expect(emitInsightUpdated).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            insightId: INSIGHT_ID,
            changedFields: expect.arrayContaining(["name", "description"]),
         }),
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureInsightOwnership).mockRejectedValueOnce(
         AppError.notFound("Insight não encontrado."),
      );

      await expect(
         call(insightsRouter.update, input, { context: createTestContext() }),
      ).rejects.toThrow("Insight não encontrado.");
   });
});

describe("remove", () => {
   it("deletes insight and emits event", async () => {
      vi.mocked(ensureInsightOwnership).mockResolvedValueOnce(makeInsight());
      vi.mocked(deleteInsight).mockResolvedValueOnce(undefined);

      const result = await call(
         insightsRouter.remove,
         { id: INSIGHT_ID },
         { context: createTestContext() },
      );

      expect(ensureInsightOwnership).toHaveBeenCalledWith(
         INSIGHT_ID,
         TEST_ORG_ID,
         TEST_TEAM_ID,
      );
      expect(deleteInsight).toHaveBeenCalledWith(INSIGHT_ID);
      expect(result).toEqual({ success: true });

      expect(emitInsightDeleted).toHaveBeenCalledWith(
         expect.any(Function),
         expect.objectContaining({
            organizationId: TEST_ORG_ID,
            userId: TEST_USER_ID,
            teamId: TEST_TEAM_ID,
         }),
         expect.objectContaining({
            insightId: INSIGHT_ID,
         }),
      );
   });

   it("propagates NOT_FOUND from repository", async () => {
      vi.mocked(ensureInsightOwnership).mockRejectedValueOnce(
         AppError.notFound("Insight não encontrado."),
      );

      await expect(
         call(
            insightsRouter.remove,
            { id: INSIGHT_ID },
            {
               context: createTestContext(),
            },
         ),
      ).rejects.toThrow("Insight não encontrado.");
   });
});
