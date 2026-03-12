# Database Refactor — Schema Cleanup & Standardization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove 8 unused schemas, inline standalone enums, add Zod validators + PGlite tests for dashboards/insights/webhooks, and convert dashboard/insight/webhook repos to singleton db pattern.

**Architecture:** Delete-first (remove dead schemas), then inline enums, then refactor remaining repos to singleton pattern with validators, then add tests. Database-only scope — consumer updates happen in a separate phase.

**Tech Stack:** Drizzle ORM, Zod v4, PGlite, Vitest, `@f-o-t/money`, `@f-o-t/condition-evaluator`

---

### Task 1: Delete unused schemas

**Files:**

- Delete: `core/database/src/schemas/personal-api-key.ts`
- Delete: `core/database/src/schemas/product-settings.ts`
- Delete: `core/database/src/schemas/resource-permissions.ts`
- Delete: `core/database/src/schemas/roles.ts`
- Delete: `core/database/src/schemas/sso.ts`
- Delete: `core/database/src/schemas/activity-logs.ts`
- Delete: `core/database/src/schemas/addons.ts`
- Delete: `core/database/src/schemas/assets.ts`
- Modify: `core/database/src/schema.ts`

**Step 1: Delete the 8 schema files**

Delete these files:

- `core/database/src/schemas/personal-api-key.ts`
- `core/database/src/schemas/product-settings.ts`
- `core/database/src/schemas/resource-permissions.ts`
- `core/database/src/schemas/roles.ts`
- `core/database/src/schemas/sso.ts`
- `core/database/src/schemas/activity-logs.ts`
- `core/database/src/schemas/addons.ts`
- `core/database/src/schemas/assets.ts`

**Step 2: Remove re-exports from `schema.ts`**

Remove these lines from `core/database/src/schema.ts`:

```typescript
// Remove these:
export * from "./schemas/activity-logs";
export * from "./schemas/addons";
export * from "./schemas/assets";
export * from "./schemas/personal-api-key";
export * from "./schemas/product-settings";
export * from "./schemas/resource-permissions";
export * from "./schemas/roles";
export * from "./schemas/sso";
```

**Step 3: Commit**

```bash
git add -u core/database/src/schemas/ core/database/src/schema.ts
git commit -m "refactor(database): remove 8 unused schemas (personal-api-key, product-settings, resource-permissions, roles, sso, activity-logs, addons, assets)"
```

---

### Task 2: Delete unused repositories

**Files:**

- Delete: `core/database/src/repositories/personal-api-key-repository.ts`
- Delete: `core/database/src/repositories/product-settings-repository.ts`
- Delete: `core/database/src/repositories/resource-permission-repository.ts`
- Delete: `core/database/src/repositories/permission-helpers.ts`

**Step 1: Delete the 4 repository files**

Delete:

- `core/database/src/repositories/personal-api-key-repository.ts`
- `core/database/src/repositories/product-settings-repository.ts`
- `core/database/src/repositories/resource-permission-repository.ts`
- `core/database/src/repositories/permission-helpers.ts`

**Step 2: Commit**

```bash
git add -u core/database/src/repositories/
git commit -m "refactor(database): remove repositories for deleted schemas"
```

---

### Task 3: Clean up relations.ts

**Files:**

- Modify: `core/database/src/relations.ts`

**Step 1: Remove relation blocks for deleted schemas**

Remove these blocks from `relations.ts`:

```typescript
// Remove: Activity Logs (lines ~149-164)
activityLogs: {
   organization: r.one.organization({ ... }),
   team: r.one.team({ ... }),
   user: r.one.user({ ... }),
},

// Remove: Addons (lines ~167-174)
organizationAddons: {
   organization: r.one.organization({ ... }),
},

// Remove: Assets (lines ~177-188)
assets: {
   organization: r.one.organization({ ... }),
   team: r.one.team({ ... }),
},

// Remove: Personal API Key (lines ~332-339)
personalApiKey: {
   user: r.one.user({ ... }),
},

// Remove: Product Settings (lines ~342-349)
productSettings: {
   team: r.one.team({ ... }),
},

// Remove: Resource Permissions (lines ~352-373)
resourcePermission: {
   organization: r.one.organization({ ... }),
   grantedByUser: r.one.user({ ... }),
   granteeUser: r.one.user({ ... }),
   granteeTeam: r.one.team({ ... }),
},

// Remove: Roles (lines ~376-395)
customRoles: {
   organization: r.one.organization({ ... }),
   memberRoles: r.many.memberRoles(),
},

memberRoles: {
   member: r.one.member({ ... }),
   role: r.one.customRoles({ ... }),
},

// Remove: SSO (lines ~440-454)
verifiedDomains: {
   organization: r.one.organization({ ... }),
},

ssoConfigurations: {
   organization: r.one.organization({ ... }),
},
```

Keep OAuth relations (oauthClient, oauthRefreshToken, oauthAccessToken, oauthConsent) — they are Better Auth managed.

**Step 2: Commit**

```bash
git add core/database/src/relations.ts
git commit -m "refactor(database): clean up relations for deleted schemas"
```

---

### Task 4: Inline enums into owner schemas

**Files:**

- Modify: `core/database/src/schemas/contacts.ts`
- Modify: `core/database/src/schemas/subscriptions.ts`
- Modify: `core/database/src/schemas/financial-goals.ts`
- Modify: `core/database/src/schemas/services.ts`
- Delete: `core/database/src/schemas/enums.ts`
- Modify: `core/database/src/schema.ts`

**Step 1: Move `serviceSourceEnum` into `contacts.ts`**

Add to `contacts.ts` (after existing imports, before `contactTypeEnum`):

```typescript
import { pgEnum } from "drizzle-orm/pg-core";
// ... (already has pgEnum in imports)

export const serviceSourceEnum = pgEnum("service_source", ["manual", "asaas"]);
export type ServiceSource = (typeof serviceSourceEnum.enumValues)[number];
```

Note: `contacts.ts` already imports `pgEnum` from `drizzle-orm/pg-core`. And it already imports `serviceSourceEnum` from `./enums` — remove that import and define inline.

**Step 2: Move `billingCycleEnum` + `subscriptionStatusEnum` into `subscriptions.ts`**

Add to `subscriptions.ts` (needs `pgEnum` import):

```typescript
import { pgEnum } from "drizzle-orm/pg-core";
// ... add pgEnum to existing pg-core import

export const billingCycleEnum = pgEnum("billing_cycle", [
   "hourly",
   "monthly",
   "annual",
   "one_time",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
   "active",
   "completed",
   "cancelled",
]);

export type BillingCycle = (typeof billingCycleEnum.enumValues)[number];
export type SubscriptionStatus =
   (typeof subscriptionStatusEnum.enumValues)[number];
```

Remove the import of these from `./enums`:

```typescript
// Remove this line:
import { serviceSourceEnum, subscriptionStatusEnum } from "./enums";
```

Note: `subscriptions.ts` currently imports `serviceSourceEnum` AND `subscriptionStatusEnum` from `./enums`. After this change, `subscriptionStatusEnum` is defined locally and `serviceSourceEnum` is imported from `./contacts`:

```typescript
import { serviceSourceEnum } from "./contacts";
```

**Step 3: Move `goalMovementTypeEnum` into `financial-goals.ts`**

Add to `financial-goals.ts` (needs `pgEnum` import):

```typescript
import { pgEnum } from "drizzle-orm/pg-core";
// ... add pgEnum to existing pg-core import

export const goalMovementTypeEnum = pgEnum("goal_movement_type", [
   "deposit",
   "withdrawal",
]);

export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];
```

Remove the import:

```typescript
// Remove this line:
import { goalMovementTypeEnum } from "./enums";
```

**Step 4: Update `services.ts` import**

`services.ts` imports `billingCycleEnum` from `./enums`. Change to:

```typescript
// Before:
import { billingCycleEnum } from "./enums";

// After:
import { billingCycleEnum } from "./subscriptions";
```

**Step 5: Delete `enums.ts` and remove from `schema.ts`**

Delete `core/database/src/schemas/enums.ts`.

Remove from `schema.ts`:

```typescript
// Remove:
export * from "./schemas/enums";
```

**Step 6: Run tests to verify nothing broke**

```bash
cd core/database && npx vitest run
```

Expected: All existing tests pass.

**Step 7: Commit**

```bash
git add -u core/database/src/schemas/ core/database/src/schema.ts
git commit -m "refactor(database): inline enums into owner schemas and delete enums.ts"
```

---

### Task 5: Add Zod validators to dashboards schema

**Files:**

- Modify: `core/database/src/schemas/dashboards.ts`

**Step 1: Add Zod schemas for JSONB types and create/update validators**

Replace the existing `DashboardTile` interface and add validators in `dashboards.ts`:

```typescript
import { Condition } from "@f-o-t/condition-evaluator";
import { sql } from "drizzle-orm";
import {
   boolean,
   index,
   jsonb,
   pgTable,
   text,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { organization, team, user } from "./auth";

export const dashboardTileSchema = z.object({
   insightId: z.string().uuid("ID do insight inválido."),
   size: z.enum(["sm", "md", "lg", "full"], {
      message: "Tamanho deve ser sm, md, lg ou full.",
   }),
   order: z.number().int().min(0, "Ordem deve ser maior ou igual a zero."),
});

export type DashboardTile = z.infer<typeof dashboardTileSchema>;

export const DashboardDateRangeSchema = z.object({
   type: z.enum(["relative", "absolute"]),
   value: z.string(),
});

export type DashboardDateRange = z.infer<typeof DashboardDateRangeSchema>;

export const DashboardFilterSchema = Condition;

export type DashboardFilter = z.infer<typeof DashboardFilterSchema>;

export const dashboards = pgTable(
   "dashboards",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      createdBy: uuid("created_by")
         .notNull()
         .references(() => user.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      isDefault: boolean("is_default").default(false).notNull(),
      tiles: jsonb("tiles").$type<DashboardTile[]>().notNull().default([]),
      globalDateRange: jsonb("global_date_range").$type<DashboardDateRange>(),
      globalFilters: jsonb("global_filters")
         .$type<DashboardFilter[]>()
         .default([]),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("dashboards_team_idx").on(table.teamId),
      uniqueIndex("dashboards_team_default_idx")
         .on(table.teamId)
         .where(sql`${table.isDefault} = true`),
   ],
);

export type Dashboard = typeof dashboards.$inferSelect;
export type NewDashboard = typeof dashboards.$inferInsert;

const baseDashboardSchema = createInsertSchema(dashboards).pick({
   name: true,
   description: true,
   tiles: true,
   globalDateRange: true,
   globalFilters: true,
});

export const createDashboardSchema = baseDashboardSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   tiles: z.array(dashboardTileSchema).default([]),
   globalDateRange: DashboardDateRangeSchema.nullable().optional(),
   globalFilters: z.array(DashboardFilterSchema).default([]),
});

export const updateDashboardSchema = createDashboardSchema.partial();

export type CreateDashboardInput = z.infer<typeof createDashboardSchema>;
export type UpdateDashboardInput = z.infer<typeof updateDashboardSchema>;
```

**Step 2: Commit**

```bash
git add core/database/src/schemas/dashboards.ts
git commit -m "feat(database): add Zod validators to dashboards schema"
```

---

### Task 6: Refactor dashboard-repository to singleton db + validateInput

**Files:**

- Modify: `core/database/src/repositories/dashboard-repository.ts`

**Step 1: Rewrite to singleton pattern**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@core/database/client";
import { DEFAULT_INSIGHTS } from "../default-insights";
import {
   type CreateDashboardInput,
   type UpdateDashboardInput,
   type Dashboard,
   type DashboardTile,
   createDashboardSchema,
   updateDashboardSchema,
   dashboards,
} from "@core/database/schemas/dashboards";
import { insights } from "@core/database/schemas/insights";

export async function createDashboard(
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateDashboardInput,
): Promise<Dashboard> {
   const validated = validateInput(createDashboardSchema, data);
   try {
      const [dashboard] = await db
         .insert(dashboards)
         .values({ ...validated, organizationId, teamId, createdBy })
         .returning();
      if (!dashboard) throw AppError.database("Failed to create dashboard");
      return dashboard;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create dashboard");
   }
}

export async function listDashboards(organizationId: string) {
   try {
      return await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.organizationId, organizationId))
         .orderBy(desc(dashboards.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list dashboards");
   }
}

export async function listDashboardsByTeam(teamId: string) {
   try {
      return await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.teamId, teamId))
         .orderBy(desc(dashboards.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list dashboards by team");
   }
}

export async function getDashboardById(
   dashboardId: string,
): Promise<Dashboard | null> {
   try {
      const [dashboard] = await db
         .select()
         .from(dashboards)
         .where(eq(dashboards.id, dashboardId));
      return dashboard ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get dashboard");
   }
}

export async function updateDashboard(
   dashboardId: string,
   data: UpdateDashboardInput,
): Promise<Dashboard> {
   const validated = validateInput(updateDashboardSchema, data);
   try {
      const [updated] = await db
         .update(dashboards)
         .set(validated)
         .where(eq(dashboards.id, dashboardId))
         .returning();
      if (!updated) throw AppError.database("Dashboard not found");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update dashboard");
   }
}

export async function updateDashboardTiles(
   dashboardId: string,
   tiles: DashboardTile[],
): Promise<Dashboard> {
   try {
      const [updated] = await db
         .update(dashboards)
         .set({ tiles })
         .where(eq(dashboards.id, dashboardId))
         .returning();
      if (!updated) throw AppError.database("Dashboard not found");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update dashboard tiles");
   }
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
   try {
      const dashboard = await getDashboardById(dashboardId);

      if (dashboard?.isDefault) {
         const teamDashboards = await listDashboardsByTeam(dashboard.teamId);
         if (teamDashboards.length > 1) {
            throw AppError.validation(
               "Cannot delete home dashboard. Set another dashboard as home first.",
            );
         }
      }

      await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete dashboard");
   }
}

export async function setDashboardAsHome(
   dashboardId: string,
   teamId: string,
): Promise<Dashboard> {
   try {
      return await db.transaction(async (tx) => {
         await tx
            .update(dashboards)
            .set({ isDefault: false })
            .where(
               and(
                  eq(dashboards.teamId, teamId),
                  eq(dashboards.isDefault, true),
               ),
            );

         const [updated] = await tx
            .update(dashboards)
            .set({ isDefault: true })
            .where(eq(dashboards.id, dashboardId))
            .returning();

         if (!updated) throw AppError.database("Dashboard not found");
         return updated;
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to set dashboard as home");
   }
}

export async function createDefaultInsights(
   organizationId: string,
   teamId: string,
   userId: string,
): Promise<string[]> {
   try {
      const insightRecords = DEFAULT_INSIGHTS.map((def) => ({
         organizationId,
         teamId,
         createdBy: userId,
         name: def.name,
         description: def.description,
         type: def.type,
         config: def.config as Record<string, unknown>,
         defaultSize: def.defaultSize,
      }));

      const created = await db
         .insert(insights)
         .values(insightRecords)
         .returning({ id: insights.id });

      return created.map((r) => r.id);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create default insights");
   }
}

export async function getDefaultDashboard(
   organizationId: string,
   teamId: string,
): Promise<Dashboard> {
   try {
      const result = await db
         .select()
         .from(dashboards)
         .where(
            and(
               eq(dashboards.organizationId, organizationId),
               eq(dashboards.teamId, teamId),
               eq(dashboards.isDefault, true),
            ),
         )
         .limit(1);

      if (!result[0]) {
         throw AppError.notFound("Default dashboard not found");
      }

      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get default dashboard");
   }
}
```

**Step 2: Commit**

```bash
git add core/database/src/repositories/dashboard-repository.ts
git commit -m "refactor(database): convert dashboard-repository to singleton db + validateInput"
```

---

### Task 7: Add dashboard repository tests

**Files:**

- Create: `core/database/__tests__/repositories/dashboard-repository.test.ts`

**Step 1: Write tests**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/dashboard-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function ids() {
   return {
      organizationId: crypto.randomUUID(),
      teamId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
   };
}

function validInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Meu Dashboard",
      ...overrides,
   };
}

describe("dashboard-repository", () => {
   describe("validators", () => {
      it("rejects name shorter than 2 chars", async () => {
         const { organizationId, teamId, userId } = ids();
         await expect(
            repo.createDashboard(
               organizationId,
               teamId,
               userId,
               validInput({ name: "A" }),
            ),
         ).rejects.toThrow();
      });

      it("rejects name longer than 120 chars", async () => {
         const { organizationId, teamId, userId } = ids();
         await expect(
            repo.createDashboard(
               organizationId,
               teamId,
               userId,
               validInput({ name: "A".repeat(121) }),
            ),
         ).rejects.toThrow();
      });

      it("rejects invalid tile schema", async () => {
         const { organizationId, teamId, userId } = ids();
         await expect(
            repo.createDashboard(
               organizationId,
               teamId,
               userId,
               validInput({
                  tiles: [{ insightId: "not-uuid", size: "xl", order: -1 }],
               }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("createDashboard", () => {
      it("creates dashboard with defaults", async () => {
         const { organizationId, teamId, userId } = ids();
         const dashboard = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         expect(dashboard).toMatchObject({
            organizationId,
            teamId,
            createdBy: userId,
            name: "Meu Dashboard",
            isDefault: false,
            tiles: [],
         });
         expect(dashboard.id).toBeDefined();
      });

      it("creates dashboard with tiles", async () => {
         const { organizationId, teamId, userId } = ids();
         const insightId = crypto.randomUUID();
         const dashboard = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput({
               tiles: [{ insightId, size: "md", order: 0 }],
            }),
         );

         expect(dashboard.tiles).toHaveLength(1);
         expect(dashboard.tiles[0]).toMatchObject({
            insightId,
            size: "md",
            order: 0,
         });
      });
   });

   describe("listDashboardsByTeam", () => {
      it("lists dashboards for a team", async () => {
         const { organizationId, teamId, userId } = ids();
         await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput({ name: "D1" }),
         );
         await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput({ name: "D2" }),
         );

         const list = await repo.listDashboardsByTeam(teamId);
         expect(list).toHaveLength(2);
      });

      it("does not return other team's dashboards", async () => {
         const ctx1 = ids();
         const ctx2 = ids();
         await repo.createDashboard(
            ctx1.organizationId,
            ctx1.teamId,
            ctx1.userId,
            validInput({ name: "D1" }),
         );
         await repo.createDashboard(
            ctx2.organizationId,
            ctx2.teamId,
            ctx2.userId,
            validInput({ name: "D2" }),
         );

         const list = await repo.listDashboardsByTeam(ctx1.teamId);
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("D1");
      });
   });

   describe("getDashboardById", () => {
      it("returns dashboard by id", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const found = await repo.getDashboardById(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Meu Dashboard" });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getDashboardById(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateDashboard", () => {
      it("updates name and description", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const updated = await repo.updateDashboard(created.id, {
            name: "Novo Nome",
            description: "Desc",
         });
         expect(updated.name).toBe("Novo Nome");
         expect(updated.description).toBe("Desc");
      });
   });

   describe("updateDashboardTiles", () => {
      it("replaces tiles array", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const insightId = crypto.randomUUID();
         const updated = await repo.updateDashboardTiles(created.id, [
            { insightId, size: "lg", order: 0 },
         ]);
         expect(updated.tiles).toHaveLength(1);
         expect(updated.tiles[0]!.insightId).toBe(insightId);
      });
   });

   describe("deleteDashboard", () => {
      it("deletes a dashboard", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         await repo.deleteDashboard(created.id);
         const found = await repo.getDashboardById(created.id);
         expect(found).toBeNull();
      });
   });

   describe("setDashboardAsHome", () => {
      it("sets dashboard as default and unsets previous", async () => {
         const { organizationId, teamId, userId } = ids();
         const d1 = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput({ name: "D1" }),
         );
         const d2 = await repo.createDashboard(
            organizationId,
            teamId,
            userId,
            validInput({ name: "D2" }),
         );

         await repo.setDashboardAsHome(d1.id, teamId);
         const home1 = await repo.getDashboardById(d1.id);
         expect(home1!.isDefault).toBe(true);

         await repo.setDashboardAsHome(d2.id, teamId);
         const prev = await repo.getDashboardById(d1.id);
         const current = await repo.getDashboardById(d2.id);
         expect(prev!.isDefault).toBe(false);
         expect(current!.isDefault).toBe(true);
      });
   });
});
```

**Step 2: Run tests**

```bash
cd core/database && npx vitest run __tests__/repositories/dashboard-repository.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/dashboard-repository.test.ts
git commit -m "test(database): add dashboard repository tests"
```

---

### Task 8: Add Zod validators to insights schema + refactor repository

**Files:**

- Modify: `core/database/src/schemas/insights.ts`
- Modify: `core/database/src/repositories/insight-repository.ts`

**Step 1: Add validators to insights schema**

```typescript
import { sql } from "drizzle-orm";
import {
   index,
   jsonb,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { organization, team, user } from "./auth";

export const insightTypeEnum = ["trends", "funnels", "retention"] as const;
export const insightSizeEnum = ["sm", "md", "lg", "full"] as const;

export const insightConfigSchema = z.record(z.string(), z.unknown());

export type InsightConfig = z.infer<typeof insightConfigSchema>;

export const insights = pgTable(
   "insights",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      teamId: uuid("team_id")
         .notNull()
         .references(() => team.id, { onDelete: "cascade" }),
      createdBy: uuid("created_by")
         .notNull()
         .references(() => user.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      description: text("description"),
      type: text("type").notNull(),
      config: jsonb("config").$type<InsightConfig>().notNull(),
      defaultSize: text("default_size").notNull().default("md"),
      cachedResults: jsonb("cached_results").$type<Record<string, unknown>>(),
      lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [index("insights_team_idx").on(table.teamId)],
);

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;

const baseInsightSchema = createInsertSchema(insights).pick({
   name: true,
   description: true,
   type: true,
   config: true,
   defaultSize: true,
});

export const createInsightSchema = baseInsightSchema.extend({
   name: z
      .string()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   type: z.enum(insightTypeEnum, { message: "Tipo é obrigatório." }),
   config: insightConfigSchema,
   defaultSize: z.enum(insightSizeEnum).default("md"),
});

export const updateInsightSchema = createInsightSchema.partial();

export type CreateInsightInput = z.infer<typeof createInsightSchema>;
export type UpdateInsightInput = z.infer<typeof updateInsightSchema>;
```

**Step 2: Refactor insight-repository to singleton db + validateInput**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateInsightInput,
   type UpdateInsightInput,
   type Insight,
   createInsightSchema,
   updateInsightSchema,
   insights,
} from "@core/database/schemas/insights";

export async function createInsight(
   organizationId: string,
   teamId: string,
   createdBy: string,
   data: CreateInsightInput,
): Promise<Insight> {
   const validated = validateInput(createInsightSchema, data);
   try {
      const [insight] = await db
         .insert(insights)
         .values({ ...validated, organizationId, teamId, createdBy })
         .returning();
      if (!insight) throw AppError.database("Failed to create insight");
      return insight;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create insight");
   }
}

export async function listInsights(organizationId: string, type?: string) {
   try {
      const conditions = [eq(insights.organizationId, organizationId)];
      if (type) conditions.push(eq(insights.type, type));

      return await db
         .select()
         .from(insights)
         .where(and(...conditions))
         .orderBy(desc(insights.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list insights");
   }
}

export async function listInsightsByTeam(teamId: string, type?: string) {
   try {
      const conditions = [eq(insights.teamId, teamId)];
      if (type) conditions.push(eq(insights.type, type));

      return await db
         .select()
         .from(insights)
         .where(and(...conditions))
         .orderBy(desc(insights.updatedAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list insights by team");
   }
}

export async function getInsightById(
   insightId: string,
): Promise<Insight | null> {
   try {
      const [insight] = await db
         .select()
         .from(insights)
         .where(eq(insights.id, insightId));
      return insight ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get insight");
   }
}

export async function getInsightsByIds(
   insightIds: string[],
): Promise<Insight[]> {
   if (insightIds.length === 0) return [];

   try {
      return await db
         .select()
         .from(insights)
         .where(inArray(insights.id, insightIds));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get insights by IDs");
   }
}

export async function updateInsight(
   insightId: string,
   data: UpdateInsightInput,
): Promise<Insight> {
   const validated = validateInput(updateInsightSchema, data);
   try {
      const [updated] = await db
         .update(insights)
         .set(validated)
         .where(eq(insights.id, insightId))
         .returning();
      if (!updated) throw AppError.database("Insight not found");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update insight");
   }
}

export async function deleteInsight(insightId: string): Promise<void> {
   try {
      await db.delete(insights).where(eq(insights.id, insightId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete insight");
   }
}
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/insights.ts core/database/src/repositories/insight-repository.ts
git commit -m "refactor(database): add Zod validators to insights schema and convert repo to singleton db"
```

---

### Task 9: Add insight repository tests

**Files:**

- Create: `core/database/__tests__/repositories/insight-repository.test.ts`

**Step 1: Write tests**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import * as repo from "../../src/repositories/insight-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function ids() {
   return {
      organizationId: crypto.randomUUID(),
      teamId: crypto.randomUUID(),
      userId: crypto.randomUUID(),
   };
}

function validInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Meu Insight",
      type: "trends" as const,
      config: { events: ["page_view"], interval: "day" },
      ...overrides,
   };
}

describe("insight-repository", () => {
   describe("validators", () => {
      it("rejects name shorter than 2 chars", async () => {
         const { organizationId, teamId, userId } = ids();
         await expect(
            repo.createInsight(
               organizationId,
               teamId,
               userId,
               validInput({ name: "A" }),
            ),
         ).rejects.toThrow();
      });

      it("rejects invalid type", async () => {
         const { organizationId, teamId, userId } = ids();
         await expect(
            repo.createInsight(
               organizationId,
               teamId,
               userId,
               validInput({ type: "invalid" }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("createInsight", () => {
      it("creates insight with defaults", async () => {
         const { organizationId, teamId, userId } = ids();
         const insight = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         expect(insight).toMatchObject({
            organizationId,
            teamId,
            createdBy: userId,
            name: "Meu Insight",
            type: "trends",
            defaultSize: "md",
         });
         expect(insight.id).toBeDefined();
         expect(insight.config).toMatchObject({ events: ["page_view"] });
      });
   });

   describe("listInsightsByTeam", () => {
      it("lists insights for a team", async () => {
         const { organizationId, teamId, userId } = ids();
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "I1" }),
         );
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "I2" }),
         );

         const list = await repo.listInsightsByTeam(teamId);
         expect(list).toHaveLength(2);
      });

      it("filters by type", async () => {
         const { organizationId, teamId, userId } = ids();
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "Trends", type: "trends" }),
         );
         await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "Funnels", type: "funnels" }),
         );

         const list = await repo.listInsightsByTeam(teamId, "funnels");
         expect(list).toHaveLength(1);
         expect(list[0]!.name).toBe("Funnels");
      });
   });

   describe("getInsightById", () => {
      it("returns insight by id", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const found = await repo.getInsightById(created.id);
         expect(found).toMatchObject({ id: created.id, name: "Meu Insight" });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getInsightById(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("getInsightsByIds", () => {
      it("returns multiple insights by ids", async () => {
         const { organizationId, teamId, userId } = ids();
         const i1 = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "I1" }),
         );
         const i2 = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput({ name: "I2" }),
         );

         const found = await repo.getInsightsByIds([i1.id, i2.id]);
         expect(found).toHaveLength(2);
      });

      it("returns empty for empty array", async () => {
         const found = await repo.getInsightsByIds([]);
         expect(found).toHaveLength(0);
      });
   });

   describe("updateInsight", () => {
      it("updates name and config", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         const updated = await repo.updateInsight(created.id, {
            name: "Novo Nome",
            config: { events: ["signup"] },
         });
         expect(updated.name).toBe("Novo Nome");
         expect(updated.config).toMatchObject({ events: ["signup"] });
      });
   });

   describe("deleteInsight", () => {
      it("deletes an insight", async () => {
         const { organizationId, teamId, userId } = ids();
         const created = await repo.createInsight(
            organizationId,
            teamId,
            userId,
            validInput(),
         );

         await repo.deleteInsight(created.id);
         const found = await repo.getInsightById(created.id);
         expect(found).toBeNull();
      });
   });
});
```

**Step 2: Run tests**

```bash
cd core/database && npx vitest run __tests__/repositories/insight-repository.test.ts
```

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/insight-repository.test.ts
git commit -m "test(database): add insight repository tests"
```

---

### Task 10: Add Zod validators to webhooks schema + refactor repository

**Files:**

- Modify: `core/database/src/schemas/webhooks.ts`
- Modify: `core/database/src/repositories/webhook-repository.ts`

**Step 1: Add validators to webhooks schema**

Add these at the end of `core/database/src/schemas/webhooks.ts`, after the type exports:

```typescript
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// ... (add these imports at top)

// ... (after type exports)

const baseWebhookEndpointSchema = createInsertSchema(webhookEndpoints).pick({
   url: true,
   description: true,
   eventPatterns: true,
   isActive: true,
});

export const createWebhookEndpointSchema = baseWebhookEndpointSchema.extend({
   url: z.string().url("URL inválida."),
   description: z
      .string()
      .max(500, "Descrição deve ter no máximo 500 caracteres.")
      .nullable()
      .optional(),
   eventPatterns: z
      .array(z.string().min(1, "Padrão de evento não pode ser vazio."))
      .min(1, "Pelo menos um padrão de evento é obrigatório."),
   isActive: z.boolean().default(true),
});

export const updateWebhookEndpointSchema =
   createWebhookEndpointSchema.partial();

export type CreateWebhookEndpointInput = z.infer<
   typeof createWebhookEndpointSchema
>;
export type UpdateWebhookEndpointInput = z.infer<
   typeof updateWebhookEndpointSchema
>;
```

**Step 2: Refactor webhook-repository to singleton db + validateInput**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateWebhookEndpointInput,
   type UpdateWebhookEndpointInput,
   type NewWebhookDelivery,
   createWebhookEndpointSchema,
   updateWebhookEndpointSchema,
   webhookDeliveries,
   webhookEndpoints,
} from "@core/database/schemas/webhooks";

export function generateWebhookSecret(): string {
   const bytes = crypto.getRandomValues(new Uint8Array(32));
   return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createWebhookEndpoint(
   organizationId: string,
   teamId: string,
   data: CreateWebhookEndpointInput,
) {
   const validated = validateInput(createWebhookEndpointSchema, data);
   try {
      const [endpoint] = await db
         .insert(webhookEndpoints)
         .values({
            ...validated,
            organizationId,
            teamId,
            signingSecret: generateWebhookSecret(),
         })
         .returning();
      if (!endpoint)
         throw AppError.database("Failed to create webhook endpoint");
      return endpoint;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create webhook endpoint");
   }
}

export async function listWebhookEndpoints(teamId: string) {
   try {
      return await db
         .select()
         .from(webhookEndpoints)
         .where(eq(webhookEndpoints.teamId, teamId))
         .orderBy(desc(webhookEndpoints.createdAt));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list webhook endpoints");
   }
}

export async function getWebhookEndpoint(webhookId: string) {
   try {
      const [endpoint] = await db
         .select()
         .from(webhookEndpoints)
         .where(eq(webhookEndpoints.id, webhookId))
         .limit(1);
      return endpoint ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get webhook endpoint");
   }
}

export async function updateWebhookEndpoint(
   webhookId: string,
   data: UpdateWebhookEndpointInput,
) {
   const validated = validateInput(updateWebhookEndpointSchema, data);
   try {
      const [updated] = await db
         .update(webhookEndpoints)
         .set(validated)
         .where(eq(webhookEndpoints.id, webhookId))
         .returning();
      if (!updated) throw AppError.database("Webhook endpoint not found");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook endpoint");
   }
}

export async function deleteWebhookEndpoint(webhookId: string) {
   try {
      await db
         .delete(webhookEndpoints)
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete webhook endpoint");
   }
}

export async function updateWebhookLastSuccess(webhookId: string) {
   try {
      await db
         .update(webhookEndpoints)
         .set({
            lastSuccessAt: new Date(),
            failureCount: 0,
         })
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook success");
   }
}

export async function incrementWebhookFailureCount(webhookId: string) {
   try {
      await db
         .update(webhookEndpoints)
         .set({
            failureCount: sql`${webhookEndpoints.failureCount} + 1`,
            lastFailureAt: new Date(),
         })
         .where(eq(webhookEndpoints.id, webhookId));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to increment failure count");
   }
}

export async function findMatchingWebhooks(
   organizationId: string,
   eventName: string,
   teamId?: string,
) {
   try {
      const endpoints = await db
         .select()
         .from(webhookEndpoints)
         .where(
            and(
               eq(webhookEndpoints.organizationId, organizationId),
               eq(webhookEndpoints.isActive, true),
               ...(teamId ? [eq(webhookEndpoints.teamId, teamId)] : []),
            ),
         );

      return endpoints.filter((endpoint) =>
         endpoint.eventPatterns.some((pattern) =>
            matchesPattern(eventName, pattern),
         ),
      );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to find matching webhooks");
   }
}

function matchesPattern(eventName: string, pattern: string): boolean {
   if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventName.startsWith(`${prefix}.`);
   }
   return eventName === pattern;
}

export async function createWebhookDelivery(data: NewWebhookDelivery) {
   try {
      const [delivery] = await db
         .insert(webhookDeliveries)
         .values(data)
         .returning();
      return delivery;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create webhook delivery");
   }
}

export async function updateWebhookDeliveryStatus(
   deliveryId: string,
   data: {
      status: string;
      httpStatusCode?: number;
      responseBody?: string;
      errorMessage?: string;
      attemptNumber?: number;
      nextRetryAt?: Date;
      deliveredAt?: Date;
   },
) {
   try {
      const [updated] = await db
         .update(webhookDeliveries)
         .set(data)
         .where(eq(webhookDeliveries.id, deliveryId))
         .returning();
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update webhook delivery");
   }
}

export async function getWebhookDeliveries(
   webhookId: string,
   options: { offset?: number; limit?: number } = {},
) {
   try {
      const { offset = 0, limit = 50 } = options;

      return await db
         .select()
         .from(webhookDeliveries)
         .where(eq(webhookDeliveries.webhookEndpointId, webhookId))
         .orderBy(desc(webhookDeliveries.createdAt))
         .offset(offset)
         .limit(limit);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get webhook deliveries");
   }
}
```

**Step 3: Commit**

```bash
git add core/database/src/schemas/webhooks.ts core/database/src/repositories/webhook-repository.ts
git commit -m "refactor(database): add Zod validators to webhooks schema and convert repo to singleton db"
```

---

### Task 11: Add webhook repository tests

**Files:**

- Create: `core/database/__tests__/repositories/webhook-repository.test.ts`

**Step 1: Write tests**

Note: webhook deliveries reference `events.id` via FK. In tests we need to insert an event record first, or test only the endpoint CRUD (which has no FK to events). For simplicity, test endpoint CRUD fully and delivery CRUD by inserting a minimal event record.

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { events } from "@core/database/schemas/events";
import * as repo from "../../src/repositories/webhook-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function ids() {
   return {
      organizationId: crypto.randomUUID(),
      teamId: crypto.randomUUID(),
   };
}

function validEndpointInput(overrides: Record<string, unknown> = {}) {
   return {
      url: "https://example.com/webhook",
      eventPatterns: ["content.*"],
      ...overrides,
   };
}

describe("webhook-repository", () => {
   describe("validators", () => {
      it("rejects invalid URL", async () => {
         const { organizationId, teamId } = ids();
         await expect(
            repo.createWebhookEndpoint(
               organizationId,
               teamId,
               validEndpointInput({ url: "not-a-url" }),
            ),
         ).rejects.toThrow();
      });

      it("rejects empty eventPatterns", async () => {
         const { organizationId, teamId } = ids();
         await expect(
            repo.createWebhookEndpoint(
               organizationId,
               teamId,
               validEndpointInput({ eventPatterns: [] }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("createWebhookEndpoint", () => {
      it("creates endpoint with generated secret", async () => {
         const { organizationId, teamId } = ids();
         const endpoint = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         expect(endpoint).toMatchObject({
            organizationId,
            teamId,
            url: "https://example.com/webhook",
            isActive: true,
            failureCount: 0,
         });
         expect(endpoint.signingSecret).toHaveLength(64);
         expect(endpoint.eventPatterns).toEqual(["content.*"]);
      });
   });

   describe("listWebhookEndpoints", () => {
      it("lists endpoints for a team", async () => {
         const { organizationId, teamId } = ids();
         await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput({ url: "https://a.com/wh" }),
         );
         await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput({ url: "https://b.com/wh" }),
         );

         const list = await repo.listWebhookEndpoints(teamId);
         expect(list).toHaveLength(2);
      });
   });

   describe("getWebhookEndpoint", () => {
      it("returns endpoint by id", async () => {
         const { organizationId, teamId } = ids();
         const created = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         const found = await repo.getWebhookEndpoint(created.id);
         expect(found).toMatchObject({ id: created.id });
      });

      it("returns null for nonexistent id", async () => {
         const found = await repo.getWebhookEndpoint(crypto.randomUUID());
         expect(found).toBeNull();
      });
   });

   describe("updateWebhookEndpoint", () => {
      it("updates url and isActive", async () => {
         const { organizationId, teamId } = ids();
         const created = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         const updated = await repo.updateWebhookEndpoint(created.id, {
            url: "https://new.com/wh",
            isActive: false,
         });
         expect(updated.url).toBe("https://new.com/wh");
         expect(updated.isActive).toBe(false);
      });
   });

   describe("deleteWebhookEndpoint", () => {
      it("deletes an endpoint", async () => {
         const { organizationId, teamId } = ids();
         const created = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         await repo.deleteWebhookEndpoint(created.id);
         const found = await repo.getWebhookEndpoint(created.id);
         expect(found).toBeNull();
      });
   });

   describe("failure tracking", () => {
      it("increments failure count", async () => {
         const { organizationId, teamId } = ids();
         const created = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         await repo.incrementWebhookFailureCount(created.id);
         await repo.incrementWebhookFailureCount(created.id);

         const found = await repo.getWebhookEndpoint(created.id);
         expect(found!.failureCount).toBe(2);
         expect(found!.lastFailureAt).toBeDefined();
      });

      it("resets failure count on success", async () => {
         const { organizationId, teamId } = ids();
         const created = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         await repo.incrementWebhookFailureCount(created.id);
         await repo.updateWebhookLastSuccess(created.id);

         const found = await repo.getWebhookEndpoint(created.id);
         expect(found!.failureCount).toBe(0);
         expect(found!.lastSuccessAt).toBeDefined();
      });
   });

   describe("findMatchingWebhooks", () => {
      it("matches wildcard patterns", async () => {
         const { organizationId, teamId } = ids();
         await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput({ eventPatterns: ["content.*"] }),
         );

         const matched = await repo.findMatchingWebhooks(
            organizationId,
            "content.page.published",
            teamId,
         );
         expect(matched).toHaveLength(1);
      });

      it("matches exact patterns", async () => {
         const { organizationId, teamId } = ids();
         await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput({ eventPatterns: ["form.submitted"] }),
         );

         const matched = await repo.findMatchingWebhooks(
            organizationId,
            "form.submitted",
            teamId,
         );
         expect(matched).toHaveLength(1);

         const noMatch = await repo.findMatchingWebhooks(
            organizationId,
            "form.created",
            teamId,
         );
         expect(noMatch).toHaveLength(0);
      });

      it("excludes inactive endpoints", async () => {
         const { organizationId, teamId } = ids();
         const endpoint = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput({ eventPatterns: ["content.*"] }),
         );
         await repo.updateWebhookEndpoint(endpoint.id, { isActive: false });

         const matched = await repo.findMatchingWebhooks(
            organizationId,
            "content.page.published",
            teamId,
         );
         expect(matched).toHaveLength(0);
      });
   });

   describe("webhook deliveries", () => {
      it("creates and lists deliveries", async () => {
         const { organizationId, teamId } = ids();
         const endpoint = await repo.createWebhookEndpoint(
            organizationId,
            teamId,
            validEndpointInput(),
         );

         const [event] = await testDb.db
            .insert(events)
            .values({
               organizationId,
               teamId,
               eventName: "content.created",
               eventCategory: "content",
               timestamp: new Date(),
               properties: {},
               isBillable: false,
            })
            .returning();

         const delivery = await repo.createWebhookDelivery({
            webhookEndpointId: endpoint.id,
            eventId: event!.id,
            url: endpoint.url,
            eventName: "content.created",
            payload: { type: "content.created" },
            status: "pending",
         });

         expect(delivery.status).toBe("pending");

         const updated = await repo.updateWebhookDeliveryStatus(delivery!.id, {
            status: "delivered",
            httpStatusCode: 200,
            deliveredAt: new Date(),
         });
         expect(updated!.status).toBe("delivered");

         const deliveries = await repo.getWebhookDeliveries(endpoint.id);
         expect(deliveries).toHaveLength(1);
      });
   });
});
```

**Step 2: Run tests**

```bash
cd core/database && npx vitest run __tests__/repositories/webhook-repository.test.ts
```

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/webhook-repository.test.ts
git commit -m "test(database): add webhook repository tests"
```

---

### Task 12: Review services schema — update enum import

**Files:**

- Modify: `core/database/src/schemas/services.ts`

**Step 1: Update `billingCycleEnum` import**

In `core/database/src/schemas/services.ts`, change:

```typescript
// Before:
import { billingCycleEnum } from "./enums";

// After:
import { billingCycleEnum } from "./subscriptions";
```

Services already uses `createInsertSchema` from `drizzle-orm/zod` and has proper validators. No other changes needed — repo already uses singleton db + validateInput.

**Step 2: Run services tests**

```bash
cd core/database && npx vitest run __tests__/repositories/services-repository.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add core/database/src/schemas/services.ts
git commit -m "refactor(database): update services billingCycleEnum import from subscriptions"
```

---

### Task 13: Review financial-goals schema — inline enum

**Files:**

- Modify: `core/database/src/schemas/financial-goals.ts`

**Step 1: Inline `goalMovementTypeEnum`**

In `core/database/src/schemas/financial-goals.ts`:

Remove the import:

```typescript
// Remove:
import { goalMovementTypeEnum } from "./enums";
```

Add `pgEnum` to the drizzle import and define the enum inline:

```typescript
import {
   boolean,
   date,
   index,
   integer,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";

export const goalMovementTypeEnum = pgEnum("goal_movement_type", [
   "deposit",
   "withdrawal",
]);

export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];
```

The repo already uses singleton db + validateInput. No changes needed there.

**Step 2: Run financial-goals tests**

```bash
cd core/database && npx vitest run __tests__/repositories/financial-goals-repository.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add core/database/src/schemas/financial-goals.ts
git commit -m "refactor(database): inline goalMovementTypeEnum into financial-goals schema"
```

---

### Task 14: Run full test suite

**Step 1: Run all database tests**

```bash
cd core/database && npx vitest run
```

Expected: All tests pass across all test files.

**Step 2: If any test fails, fix it before proceeding.**

This task validates the entire refactoring is consistent.
