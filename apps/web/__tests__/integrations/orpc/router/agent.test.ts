import { call } from "@orpc/server";
import { sql } from "drizzle-orm";
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

import {
   cleanupIntegrationTest,
   setupIntegrationTest,
} from "../../../helpers/setup-integration-test";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";
import * as agentSettingsRouter from "@/integrations/orpc/router/agent-settings";

let ctx: ORPCContextWithAuth;
let ctx2: ORPCContextWithAuth;

beforeAll(async () => {
   const { createAuthenticatedContext } = await setupIntegrationTest();
   ctx = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
   ctx2 = await createAuthenticatedContext({
      organizationId: "auto",
      teamId: "auto",
   });
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.execute(
      sql`DELETE FROM agent_settings WHERE team_id IN (${ctx.session!.session.activeTeamId}, ${ctx2.session!.session.activeTeamId})`,
   );
});

describe("getSettings", () => {
   it("returns null when no settings exist", async () => {
      const result = await call(agentSettingsRouter.getSettings, undefined, {
         context: ctx,
      });

      expect(result).toBeNull();
   });

   it("returns settings after upsert", async () => {
      await call(
         agentSettingsRouter.upsertSettings,
         {
            modelId: "openrouter/anthropic/claude-sonnet-4-5",
            language: "en-US",
         },
         { context: ctx },
      );

      const result = await call(agentSettingsRouter.getSettings, undefined, {
         context: ctx,
      });

      expect(result).not.toBeNull();
      expect(result?.modelId).toBe("openrouter/anthropic/claude-sonnet-4-5");
      expect(result?.language).toBe("en-US");
   });
});

describe("upsertSettings", () => {
   it("creates settings and returns them with the calling team's id", async () => {
      const result = await call(
         agentSettingsRouter.upsertSettings,
         {},
         { context: ctx },
      );

      expect(result.teamId).toBe(ctx.session!.session.activeTeamId);
      expect(result.language).toBe("pt-BR");
      expect(result.tone).toBe("formal");
      expect(result.dataSourceTransactions).toBe(true);
   });

   it("updates existing settings on second call", async () => {
      await call(
         agentSettingsRouter.upsertSettings,
         { tone: "casual" },
         { context: ctx },
      );

      const updated = await call(
         agentSettingsRouter.upsertSettings,
         { tone: "technical" },
         { context: ctx },
      );

      expect(updated.tone).toBe("technical");
   });

   it("preserves unrelated fields on partial update", async () => {
      await call(
         agentSettingsRouter.upsertSettings,
         { tone: "casual" },
         { context: ctx },
      );
      await call(
         agentSettingsRouter.upsertSettings,
         { language: "en-US" },
         { context: ctx },
      );

      const result = await call(agentSettingsRouter.getSettings, undefined, {
         context: ctx,
      });
      expect(result?.tone).toBe("casual");
      expect(result?.language).toBe("en-US");
   });

   it("does not leak settings between teams", async () => {
      await call(
         agentSettingsRouter.upsertSettings,
         { tone: "casual" },
         { context: ctx },
      );

      const otherTeamResult = await call(
         agentSettingsRouter.getSettings,
         undefined,
         {
            context: ctx2,
         },
      );

      expect(otherTeamResult).toBeNull();
   });
});
