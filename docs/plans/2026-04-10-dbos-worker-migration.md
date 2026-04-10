# DBOS Worker Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace BullMQ + node-cron in `apps/worker` with DBOS durable workflows, then merge `apps/worker` into `apps/server` — eliminating a separate Railway service.

**Architecture:**
- DBOS runs inside `apps/server` alongside Elysia. `DBOS.launch()` starts before `app.listen()`.
- Scheduled jobs (`refresh-insights`, `bill-occurrences`) use `@DBOS.scheduled` decorators.
- `budget-alerts` is a `@DBOS.workflow()` enqueued in-process (no cross-process needed).
- `apps/worker` is deleted. One fewer Railway service.

**End state:**
```
apps/web    — dashboard SSR, oRPC for the UI, session auth
apps/server — SDK API (Elysia) + DBOS runtime (jobs + future inbound webhooks)
apps/worker — deleted
```

**Out of scope:** outbound webhook delivery workflow, `packages/events/src/queues/` cleanup, `apps/web/src/integrations/queue/` cleanup — deferred to the webhooks feature issue.

---

## What changes

| Path | Action |
|------|--------|
| `apps/server/src/workflows/refresh-insights.ts` | **Created** |
| `apps/server/src/workflows/bill-occurrences.ts` | **Created** |
| `apps/server/src/workflows/budget-alerts.ts` | **Created** |
| `apps/server/src/index.ts` | **Modified** — add `DBOS.launch()` + graceful shutdown |
| `apps/server/package.json` | **Modified** — add dbos, analytics, remove nothing (worker deps come over) |
| `apps/worker/` | **Deleted** entirely |
| `apps/worker/src/workers/webhook-delivery.ts` | **Kept alive temporarily** — see Task 6 |

---

### Task 1: Install DBOS in apps/server

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Add dependencies**

Add to `dependencies`:
```json
"@dbos-inc/dbos-sdk": "^2",
"@packages/analytics": "workspace:*"
```

The worker already had `@packages/analytics` (for insight refresh) and `@core/transactional` (for budget alerts). `@core/transactional` is already in server. Check analytics is the only missing one.

**Step 2: Install**
```bash
cd /home/yorizel/Documents/montte-nx && bun install
```

**Step 3: Create DBOS config**

Create `apps/server/dbos-config.yaml`:
```yaml
name: montte-server
language: node
database:
  hostname: localhost
  port: 5432
  username: postgres
  password: ""
  connectionTimeoutMillis: 3000
  ssl: false
```

> DBOS reads `DATABASE_URL` from `process.env` at runtime — the config file is a fallback. Verify DBOS v2 docs on whether to pass `{ databaseUrl }` explicitly to `DBOS.launch()`.

**Step 4: Commit**
```bash
git add apps/server/package.json apps/server/dbos-config.yaml bun.lock
git commit -m "chore(server): add @dbos-inc/dbos-sdk and @packages/analytics"
```

---

### Task 2: Create RefreshInsightsWorkflow

**Files:**
- Create: `apps/server/src/workflows/refresh-insights.ts`

**Step 1: Create the file**

```typescript
// apps/server/src/workflows/refresh-insights.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import { computeInsightData } from "@packages/analytics/compute-insight";
import { insights } from "@core/database/schemas/insights";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:insights" });

export class RefreshInsightsWorkflow {
  @DBOS.step()
  static async refreshAll(): Promise<void> {
    const startTime = Date.now();
    const allInsights = await db.select().from(insights);
    logger.info({ count: allInsights.length }, "Refreshing insights");

    let successCount = 0;
    let failureCount = 0;

    for (const insight of allInsights) {
      try {
        const freshData = await computeInsightData(db, insight);
        await db
          .update(insights)
          .set({ cachedResults: freshData, lastComputedAt: new Date() })
          .where(eq(insights.id, insight.id));
        successCount++;
      } catch (error) {
        logger.error({ err: error, insightId: insight.id }, "Failed to refresh insight");
        failureCount++;
      }
    }

    logger.info(
      { durationMs: Date.now() - startTime, successCount, failureCount },
      "Insight refresh complete",
    );
  }

  @DBOS.scheduled({ crontab: "0 */3 * * *" })
  @DBOS.workflow()
  static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
    await RefreshInsightsWorkflow.refreshAll();
  }
}
```

**Step 2: Typecheck**
```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "workflows/refresh"
```

**Step 3: Commit**
```bash
git add apps/server/src/workflows/refresh-insights.ts
git commit -m "feat(server): add RefreshInsightsWorkflow as DBOS scheduled workflow"
```

---

### Task 3: Create BillOccurrencesWorkflow

**Files:**
- Create: `apps/server/src/workflows/bill-occurrences.ts`

**Step 1: Create the file**

```typescript
// apps/server/src/workflows/bill-occurrences.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import {
  createBillsBatch,
  getActiveRecurrenceSettings,
  getLastBillForRecurrenceGroup,
} from "@core/database/repositories/bills-repository";
import { getLogger } from "@core/logging/root";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:bills" });

function computeNextDueDate(from: string, frequency: string): string {
  const d = new Date(from);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().substring(0, 10);
}

export class BillOccurrencesWorkflow {
  @DBOS.step()
  static async generateAll(): Promise<void> {
    const settings = await getActiveRecurrenceSettings(db);

    for (const setting of settings) {
      const lastBill = await getLastBillForRecurrenceGroup(db, setting.id);
      if (!lastBill) continue;

      const today = new Date();
      const windowEnd = new Date(today);
      windowEnd.setMonth(windowEnd.getMonth() + setting.windowMonths);

      const toCreate = [];
      let nextDue = computeNextDueDate(lastBill.dueDate, setting.frequency);

      while (new Date(nextDue) <= windowEnd) {
        if (setting.endsAt && new Date(nextDue) > new Date(setting.endsAt)) break;
        toCreate.push({
          teamId: lastBill.teamId,
          name: lastBill.name,
          description: lastBill.description,
          type: lastBill.type,
          amount: lastBill.amount,
          dueDate: nextDue,
          bankAccountId: lastBill.bankAccountId,
          categoryId: lastBill.categoryId,
          recurrenceGroupId: setting.id,
        });
        nextDue = computeNextDueDate(nextDue, setting.frequency);
      }

      if (toCreate.length > 0) {
        await createBillsBatch(db, toCreate);
        logger.info(
          { count: toCreate.length, recurrenceGroupId: setting.id },
          "Created bill occurrences",
        );
      }
    }
  }

  @DBOS.scheduled({ crontab: "0 6 * * *" })
  @DBOS.workflow()
  static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
    await BillOccurrencesWorkflow.generateAll();
  }
}
```

**Step 2: Typecheck**
```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "workflows/bill"
```

**Step 3: Commit**
```bash
git add apps/server/src/workflows/bill-occurrences.ts
git commit -m "feat(server): add BillOccurrencesWorkflow as DBOS scheduled workflow"
```

---

### Task 4: Create BudgetAlertsWorkflow

**Files:**
- Create: `apps/server/src/workflows/budget-alerts.ts`

**Step 1: Create the file**

```typescript
// apps/server/src/workflows/budget-alerts.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import {
  getGoalsForAlertCheck,
  markAlertSent,
} from "@core/database/repositories/budget-goals-repository";
import { teamMember, user, team } from "@core/database/schema";
import { env } from "@core/environment/web";
import { createEmitFn } from "@packages/events/emit";
import { emitFinanceBudgetAlertTriggered } from "@packages/events/finance";
import { getLogger } from "@core/logging/root";
import { getResendClient, sendBudgetAlertEmail } from "@core/transactional/client";
import { eq } from "drizzle-orm";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:budget-alerts" });

const fmt = (v: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

export interface BudgetAlertInput {
  teamId: string;
  month: number;
  year: number;
}

export class BudgetAlertsWorkflow {
  @DBOS.step()
  static async processAlerts(input: BudgetAlertInput): Promise<void> {
    const { month, year } = input;
    const goals = await getGoalsForAlertCheck(db, month, year);

    if (goals.length === 0) {
      logger.info({ month, year }, "No budget goals to alert");
      return;
    }

    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      logger.error("RESEND_API_KEY not set — skipping budget alert emails");
      return;
    }

    const resend = getResendClient(resendApiKey);
    const emit = createEmitFn(db);

    for (const goal of goals) {
      try {
        const monthName = new Date(goal.year, goal.month - 1, 1).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        const categoryName = goal.categoryName ?? "Geral";

        const members = await db
          .select({ email: user.email, name: user.name })
          .from(teamMember)
          .innerJoin(user, eq(user.id, teamMember.userId))
          .where(eq(teamMember.teamId, goal.teamId));

        const [teamRow] = await db
          .select({ organizationId: team.organizationId })
          .from(team)
          .where(eq(team.id, goal.teamId));

        for (const member of members) {
          await sendBudgetAlertEmail(resend, {
            email: member.email,
            categoryName,
            spentAmount: fmt(goal.spentAmount),
            limitAmount: fmt(Number(goal.limitAmount)),
            percentUsed: goal.percentUsed,
            alertThreshold: goal.alertThreshold ?? 0,
            month: monthName,
          }).catch((err: unknown) => {
            logger.error({ err, email: member.email }, "Failed to send budget alert email");
          });
        }

        await markAlertSent(db, goal.id, goal.teamId);

        if (teamRow) {
          await emitFinanceBudgetAlertTriggered(
            emit,
            { organizationId: teamRow.organizationId, teamId: goal.teamId },
            {
              budgetGoalId: goal.id,
              categoryId: goal.categoryId ?? undefined,
              percentUsed: goal.percentUsed,
              teamId: goal.teamId,
            },
          );
        }

        logger.info({ goalId: goal.id, categoryName }, "Budget alert sent");
      } catch (err) {
        logger.error({ err, goalId: goal.id }, "Failed to process budget alert");
      }
    }
  }

  @DBOS.workflow()
  static async run(input: BudgetAlertInput): Promise<void> {
    await BudgetAlertsWorkflow.processAlerts(input);
  }
}
```

**Step 2: Typecheck**
```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "workflows/budget"
```

**Step 3: Commit**
```bash
git add apps/server/src/workflows/budget-alerts.ts
git commit -m "feat(server): add BudgetAlertsWorkflow as DBOS workflow"
```

---

### Task 5: Wire DBOS into apps/server/src/index.ts

**Files:**
- Modify: `apps/server/src/index.ts`

**Step 1: Add DBOS launch before app.listen and shutdown in the signal handler**

The current `index.ts` is synchronous at the top level. Wrap it in an async `main()` to support `await DBOS.launch()`.

```typescript
// apps/server/src/index.ts
import { DBOS } from "@dbos-inc/dbos-sdk";
import cors from "@elysiajs/cors";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { env } from "@core/environment/web";
import {
  startHealthHeartbeat,
  stopHealthHeartbeat,
} from "@core/logging/health";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { initOtel, shutdownOtel } from "@core/logging/otel";
import { initLogger } from "@core/logging/root";
import { shutdownPosthog } from "@core/posthog/server";
import { Elysia } from "elysia";
import { auth, db, minioClient, posthog } from "./singletons";
import sdkRouter from "./orpc/router";

// Register workflow classes so DBOS picks up decorators
import "./workflows/refresh-insights";
import "./workflows/bill-occurrences";
import "./workflows/budget-alerts";

initOtel({
  serviceName: "montte-server",
  posthogKey: env.POSTHOG_KEY,
  posthogHost: env.POSTHOG_HOST,
});
startHealthHeartbeat({ serviceName: "montte-server", posthog });

const logger = initLogger({ name: "montte-server", level: "info" });

const orpcHandler = new RPCHandler(sdkRouter, {
  plugins: [
    new BatchHandlerPlugin(),
    new FetchLoggingPlugin({
      logger,
      generateId: () => crypto.randomUUID(),
      logRequestResponse: true,
      logRequestAbort: true,
    }),
  ],
});

async function handleOrpcRequest({ request }: { request: Request }) {
  const context = { db, posthog, request };
  const { response } = await orpcHandler.handle(request, {
    prefix: "/sdk/orpc",
    context,
  });
  return response ?? new Response("Not Found", { status: 404 });
}

async function main() {
  // Start DBOS — registers scheduled workflows and begins processing
  await DBOS.launch();
  logger.info("DBOS runtime started");

  const app = new Elysia({ serve: { idleTimeout: 0 } })
    .derive(() => ({ auth, db, minioBucket: env.MINIO_BUCKET, minioClient, posthog }))
    .use(
      cors({
        allowedHeaders: ["Content-Type", "sdk-api-key", "X-API-Key", "X-Locale", "Authorization"],
        credentials: true,
        methods: ["GET", "POST", "DELETE", "OPTIONS"],
        origin: true,
      }),
    )
    .post("/sdk/orpc", handleOrpcRequest)
    .get("/health", () => ({ status: "healthy", timestamp: new Date().toISOString() }))
    .listen(process.env.PORT ?? 9877);

  logger.info({ port: app.server?.port }, "Server started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received signal, shutting down");
    await DBOS.shutdown();
    await shutdownPosthog(posthog);
    stopHealthHeartbeat();
    await shutdownOtel();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal error", err);
  process.exit(1);
});

export type App = Elysia;
```

> **Note:** `export type App = typeof app` was the original export — `app` is now inside `main()` so it's no longer accessible at module level. Change to `export type App = Elysia` or check if this type is imported anywhere. Run `grep -r "from.*apps/server" apps/ packages/` to verify.

**Step 2: Check App type usage**
```bash
grep -r "App\b" /home/yorizel/Documents/montte-nx/apps/server/src/ /home/yorizel/Documents/montte-nx/libraries/ 2>/dev/null
```
Adapt if needed.

**Step 3: Typecheck**
```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

**Step 4: Commit**
```bash
git add apps/server/src/index.ts
git commit -m "feat(server): wire DBOS.launch() into server startup and shutdown"
```

---

### Task 6: Delete apps/worker

**Step 1: Verify nothing imports from apps/worker**
```bash
grep -r "from.*apps/worker\|require.*apps/worker" /home/yorizel/Documents/montte-nx/apps /home/yorizel/Documents/montte-nx/packages 2>/dev/null
```
Expected: no matches.

**Step 2: Check nx.json / project.json for worker references**
```bash
grep -r "worker" /home/yorizel/Documents/montte-nx/nx.json /home/yorizel/Documents/montte-nx/apps/worker/project.json 2>/dev/null
```

**Step 3: Delete the app**
```bash
rm -rf /home/yorizel/Documents/montte-nx/apps/worker
```

**Step 4: Remove from workspace if referenced**
```bash
grep -r "\"worker\"" /home/yorizel/Documents/montte-nx/package.json /home/yorizel/Documents/montte-nx/bun.workspace 2>/dev/null
```
Bun workspaces use glob patterns (`apps/*`) so likely nothing to change. Verify.

**Step 5: Update bun dev:worker script in root package.json**
```bash
grep "dev:worker\|worker" /home/yorizel/Documents/montte-nx/package.json
```
Remove or repurpose the `dev:worker` script — it no longer applies.

**Step 6: Typecheck + tests**
```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
bun run test 2>&1 | tail -20
```

**Step 7: Commit**
```bash
git add -A
git commit -m "chore: delete apps/worker — jobs migrated to apps/server via DBOS"
```

---

### Task 7: Smoke test

**Step 1: Start server in dev mode**
```bash
cd /home/yorizel/Documents/montte-nx && bun dev 2>&1 | head -30
```
Expected: DBOS logs scheduled workflows registered, Elysia server starts on port 9877.

**Step 2: Verify DBOS tables created**
```bash
bun run db:studio:local
```
Look for `dbos_*` tables in Postgres.

**Step 3: Health check**
```bash
curl http://localhost:9877/health
```
Expected: `{"status":"healthy","timestamp":"..."}`.

**Step 4: Final commit if anything left**
```bash
git status && git add -A && git commit -m "chore(server): finalize DBOS + worker merge"
```
