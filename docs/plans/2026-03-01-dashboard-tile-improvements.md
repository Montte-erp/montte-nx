# Dashboard Tile Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix money formatting on dashboard tiles and charts, fix "Saldo Líquido" to compute net balance (income − expenses), and add an "Configurar" option that opens the insight builder in a credenza without leaving the dashboard.

**Architecture:** Three independent improvements — (1) add a `"net"` aggregation type to the analytics engine so income−expenses can be expressed as a single KPI, (2) thread a `formatAsCurrency` flag from `InsightConfig` through every chart component so `@f-o-t/money` formats are used consistently, (3) extract the insight-editing logic into a self-contained `InsightEditCredenza` component and wire it into `DashboardTile`'s dropdown.

**Tech Stack:** `@f-o-t/money` (`format`, `of`), Recharts (`YAxis tickFormatter`, `ChartTooltipContent formatter`), `useCredenza` global hook, `useInsightConfig` state hook, oRPC `insights.update` mutation.

---

## Task 1: Add `"net"` aggregation to analytics types

**Files:**

- Modify: `packages/analytics/src/types.ts`

**Step 1: Add `"net"` to the aggregation enum**

In `measureSchema`, change:

```typescript
aggregation: z.enum(["sum", "count", "avg"]),
```

to:

```typescript
aggregation: z.enum(["sum", "count", "avg", "net"]),
```

**Step 2: Verify TypeScript still compiles**

```bash
bun run typecheck
```

Expected: errors in `compute-kpi.ts` and `compute-time-series.ts` because they don't handle `"net"` yet — that's fine, fix next.

**Step 3: Commit**

```bash
git add packages/analytics/src/types.ts
git commit -m "feat(analytics): add 'net' aggregation type (income - expenses)"
```

---

## Task 2: Implement `"net"` in KPI compute

**Files:**

- Modify: `packages/analytics/src/compute-kpi.ts`

**Step 1: Add the net case in `computeValue`**

After the `avg` branch (line ~86), add before the closing `return`:

```typescript
if (aggregation === "net") {
   const result = await db
      .select({
         value: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`,
      })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}
```

Full updated `computeValue` body should look like:

```typescript
async function computeValue(
   db: DatabaseInstance,
   teamId: string,
   aggregation: "sum" | "count" | "avg" | "net",
   filters: TransactionFilters,
   start: Date,
   end: Date,
): Promise<number> {
   const conditions = buildConditions(teamId, filters, start, end);

   if (aggregation === "count") {
      const result = await db
         .select({ value: sql<number>`count(*)::int` })
         .from(transactions)
         .where(and(...conditions));
      return result[0]?.value ?? 0;
   }

   if (aggregation === "sum") {
      const result = await db
         .select({
            value: sql<number>`coalesce(sum(${transactions.amount}), 0)::float`,
         })
         .from(transactions)
         .where(and(...conditions));
      return Number(result[0]?.value ?? 0);
   }

   if (aggregation === "net") {
      const result = await db
         .select({
            value: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`,
         })
         .from(transactions)
         .where(and(...conditions));
      return Number(result[0]?.value ?? 0);
   }

   // avg
   const result = await db
      .select({
         value: sql<number>`coalesce(avg(${transactions.amount}), 0)::float`,
      })
      .from(transactions)
      .where(and(...conditions));
   return Number(result[0]?.value ?? 0);
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS (no errors in compute-kpi.ts).

**Step 3: Commit**

```bash
git add packages/analytics/src/compute-kpi.ts
git commit -m "feat(analytics): implement 'net' aggregation in KPI compute (income - expenses)"
```

---

## Task 3: Implement `"net"` in time series compute

**Files:**

- Modify: `packages/analytics/src/compute-time-series.ts`

**Step 1: Add the net case in `computeSeries`**

In `computeSeries`, the `valueExpr` block currently has `sum` and `avg`. Add `net` (replace the existing if/else with):

```typescript
let valueExpr = sql<number>`count(*)::int`;
if (config.measure.aggregation === "count") {
   valueExpr = sql<number>`count(*)::int`;
} else if (config.measure.aggregation === "sum") {
   valueExpr = sql<number>`coalesce(sum(${transactions.amount}), 0)::float`;
} else if (config.measure.aggregation === "net") {
   valueExpr = sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount}::float when ${transactions.type} = 'expense' then -(${transactions.amount}::float) else 0 end), 0)`;
} else {
   valueExpr = sql<number>`coalesce(avg(${transactions.amount}), 0)::float`;
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add packages/analytics/src/compute-time-series.ts
git commit -m "feat(analytics): implement 'net' aggregation in time series compute"
```

---

## Task 4: Fix "Saldo Líquido" default insight config

**Files:**

- Modify: `packages/database/src/default-insights.ts`

**Step 1: Update the third default insight**

Change the "Saldo líquido" entry from `aggregation: "count"` (counting transactions) to `aggregation: "net"` (income − expenses). Update description too:

```typescript
{
   name: "Saldo líquido",
   description: "Receitas menos despesas no mês atual vs mês anterior",
   type: "kpi",
   config: {
      type: "kpi",
      measure: { aggregation: "net" },
      filters: {
         dateRange: { type: "relative", value: "this_month" },
      },
      compare: true,
   },
   defaultSize: "sm",
},
```

**Step 2: Update `KpiQueryBuilder` to expose the new option**

In `apps/web/src/features/analytics/ui/kpi-query-builder.tsx`, add `"net"` to `AGGREGATION_OPTIONS`:

```typescript
const AGGREGATION_OPTIONS = [
   { value: "sum", label: "Soma dos valores" },
   { value: "count", label: "Contagem de transações" },
   { value: "avg", label: "Média dos valores" },
   { value: "net", label: "Saldo líquido (receitas − despesas)" },
] as const;
```

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add packages/database/src/default-insights.ts apps/web/src/features/analytics/ui/kpi-query-builder.tsx
git commit -m "fix(analytics): saldo liquido uses net aggregation (income - expenses)"
```

---

## Task 5: Add `formatAsCurrency` to `TrendsNumberCard`

**Files:**

- Modify: `apps/web/src/features/analytics/charts/trends-number-card.tsx`

**Step 1: Add the prop and format with `@f-o-t/money`**

Add `import { format, of } from "@f-o-t/money";` at the top.

Add `formatAsCurrency?: boolean` to `TrendsNumberCardProps`.

Replace the `formattedValue` computation:

```typescript
const formattedValue =
   formatAsCurrency && typeof value === "number"
      ? format(of(value.toFixed(2), "BRL"), "pt-BR")
      : typeof value === "number"
        ? value.toLocaleString("pt-BR")
        : value;
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/web/src/features/analytics/charts/trends-number-card.tsx
git commit -m "feat(analytics): add formatAsCurrency prop to TrendsNumberCard using @f-o-t/money"
```

---

## Task 6: Add value formatter props to `TrendsBarChart` and `TrendsLineChart`

**Files:**

- Modify: `apps/web/src/features/analytics/charts/trends-bar-chart.tsx`
- Modify: `apps/web/src/features/analytics/charts/trends-line-chart.tsx`

### TrendsBarChart

**Step 1: Add `valueFormatter` prop**

Add `import { format, of } from "@f-o-t/money";` at top (only if needed; it's actually used in the caller — just wire the prop).

Add to the interface:

```typescript
valueFormatter?: (value: number) => string;
```

Add to destructured props in the function signature.

**Step 2: Wire into YAxis and ChartTooltipContent**

In `<YAxis>`, replace:

```tsx
<YAxis
   axisLine={false}
   className="text-xs"
   tickLine={false}
   tickMargin={8}
   width={40}
/>
```

with:

```tsx
<YAxis
   axisLine={false}
   className="text-xs"
   tickFormatter={valueFormatter}
   tickLine={false}
   tickMargin={8}
   width={valueFormatter ? 80 : 40}
/>
```

In `<ChartTooltip>`, replace:

```tsx
<ChartTooltip content={<ChartTooltipContent />} />
```

with:

```tsx
<ChartTooltip
   content={
      <ChartTooltipContent
         formatter={
            valueFormatter
               ? (value) => valueFormatter(Number(value))
               : undefined
         }
      />
   }
/>
```

### TrendsLineChart

Apply the exact same changes as `TrendsBarChart`:

- Add `valueFormatter?: (value: number) => string` to interface and destructured props
- Wire `tickFormatter` + `width` on `<YAxis yAxisId="left">` (same pattern)
- Wire `formatter` on `<ChartTooltipContent />`

**Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/web/src/features/analytics/charts/trends-bar-chart.tsx apps/web/src/features/analytics/charts/trends-line-chart.tsx
git commit -m "feat(analytics): add valueFormatter prop to bar/line charts for Y-axis and tooltip"
```

---

## Task 7: Wire currency formatting through `InsightPreview`

**Files:**

- Modify: `apps/web/src/features/analytics/ui/insight-preview.tsx`

**Step 1: Add `@f-o-t/money` import and currency helpers**

Add at top:

```typescript
import { format, of } from "@f-o-t/money";
```

Add a helper (module-level, not inside component):

```typescript
function formatBRL(value: number): string {
   return format(of(value.toFixed(2), "BRL"), "pt-BR");
}

function isCurrencyAggregation(config: InsightConfig): boolean {
   return config.measure.aggregation !== "count";
}
```

**Step 2: Pass `formatAsCurrency` to `KpiPreview` → `TrendsNumberCard`**

Update `KpiPreview` signature to accept the flag and forward it:

```typescript
function KpiPreview({ data, formatAsCurrency }: { data: KpiResult; formatAsCurrency: boolean }) {
   ...
   return <TrendsNumberCard formatAsCurrency={formatAsCurrency} label="Total" trend={trend} value={data.value} />;
}
```

**Step 3: Pass `valueFormatter` to `TimeSeriesPreview`**

Update `TimeSeriesPreview` signature:

```typescript
function TimeSeriesPreview({
   config,
   data,
   valueFormatter,
}: {
   config: TimeSeriesConfig;
   data: TimeSeriesResult;
   valueFormatter?: (value: number) => string;
});
```

Pass `valueFormatter` to both `<TrendsBarChart>` and `<TrendsLineChart>` inside.

**Step 4: Pass `valueFormatter` to `BreakdownPreview`**

Same pattern — add `valueFormatter` prop, pass it to `<TrendsBarChart>`.

**Step 5: Compute and thread in `InsightPreview`**

```typescript
export function InsightPreview({ config }: InsightPreviewProps) {
   const { data } = useSuspenseQuery(
      orpc.analytics.query.queryOptions({ input: { config } }),
   );

   const formatAsCurrency = isCurrencyAggregation(config);
   const valueFormatter = formatAsCurrency ? formatBRL : undefined;

   return (
      <div className="h-full">
         <div className="space-y-3">
            {config.type === "kpi" && (
               <KpiPreview data={data as KpiResult} formatAsCurrency={formatAsCurrency} />
            )}
            {config.type === "time_series" && (
               <TimeSeriesPreview
                  config={config}
                  data={data as TimeSeriesResult}
                  valueFormatter={valueFormatter}
               />
            )}
            {config.type === "breakdown" && (
               <BreakdownPreview data={data as BreakdownResult} valueFormatter={valueFormatter} />
            )}
         </div>
      </div>
   );
}
```

**Step 6: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/web/src/features/analytics/ui/insight-preview.tsx
git commit -m "feat(analytics): wire BRL currency formatting through InsightPreview using @f-o-t/money"
```

---

## Task 8: Create `InsightEditCredenza` component

**Files:**

- Create: `apps/web/src/features/analytics/ui/insight-edit-credenza.tsx`

**Step 1: Create the file with full implementation**

```typescript
import type {
   BreakdownConfig,
   InsightConfig,
   KpiConfig,
   TimeSeriesConfig,
} from "@packages/analytics/types";
import { insightConfigSchema } from "@packages/analytics/types";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Hash, Loader2, TrendingUp } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import type { InsightType } from "@/features/analytics/hooks/use-insight-config";
import { useInsightConfig } from "@/features/analytics/hooks/use-insight-config";
import { BreakdownQueryBuilder } from "./breakdown-query-builder";
import {
   InsightErrorState,
   InsightLoadingState,
   InsightPreview,
} from "./insight-preview";
import { KpiQueryBuilder } from "./kpi-query-builder";
import { TimeSeriesQueryBuilder } from "./time-series-query-builder";
import { closeCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const TYPE_TABS: { value: InsightType; label: string; icon: React.ElementType }[] = [
   { value: "kpi", label: "KPI", icon: Hash },
   { value: "time_series", label: "Série Temporal", icon: TrendingUp },
   { value: "breakdown", label: "Distribuição", icon: BarChart3 },
];

interface InsightEditCredenzaProps {
   insightId: string;
}

export function InsightEditCredenza({ insightId }: InsightEditCredenzaProps) {
   const queryClient = useQueryClient();

   const { data: insight, isLoading } = useQuery(
      orpc.insights.getById.queryOptions({ input: { id: insightId } }),
   );

   const { type, config, setType, updateConfigImmediate } = useInsightConfig();
   const [name, setName] = useState("");
   const [initialized, setInitialized] = useState(false);

   useEffect(() => {
      if (insight && !initialized) {
         setName(insight.name);
         const parsed = insightConfigSchema.safeParse(insight.config);
         if (parsed.success) {
            setType(parsed.data.type as InsightType);
            queueMicrotask(() => {
               updateConfigImmediate(parsed.data);
            });
         }
         setInitialized(true);
      }
   }, [insight, initialized, setType, updateConfigImmediate]);

   const updateMutation = useMutation(
      orpc.insights.update.mutationOptions({
         onSuccess: () => {
            toast.success("Insight atualizado");
            queryClient.invalidateQueries({
               queryKey: orpc.insights.getById.queryOptions({
                  input: { id: insightId },
               }).queryKey,
            });
            closeCredenza();
         },
         onError: () => toast.error("Erro ao atualizar insight"),
      }),
   );

   const handleSave = useCallback(() => {
      if (!name.trim()) {
         toast.error("O nome do insight é obrigatório");
         return;
      }
      updateMutation.mutate({
         id: insightId,
         name: name.trim(),
         config: config as InsightConfig,
      });
   }, [insightId, name, config, updateMutation]);

   if (isLoading) {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>Configurar insight</CredenzaTitle>
            </CredenzaHeader>
            <CredenzaBody>
               <InsightLoadingState />
            </CredenzaBody>
         </>
      );
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Configurar insight</CredenzaTitle>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="space-y-1.5">
               <Label htmlFor="insight-name">Nome</Label>
               <Input
                  id="insight-name"
                  onChange={(e) => setName(e.target.value)}
                  value={name}
               />
            </div>

            <div className="flex items-center border-t border-b py-1 -mx-6 px-6">
               {TYPE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                     <Button
                        className={cn(
                           "px-3 py-2 h-auto rounded-none border-b-2 text-sm font-medium gap-1.5",
                           type === tab.value
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                        key={tab.value}
                        onClick={() => setType(tab.value)}
                        variant="ghost"
                     >
                        <Icon className="size-3.5" />
                        {tab.label}
                     </Button>
                  );
               })}
            </div>

            {type === "kpi" && (
               <KpiQueryBuilder
                  config={config as KpiConfig}
                  onUpdate={updateConfigImmediate}
               />
            )}
            {type === "time_series" && (
               <TimeSeriesQueryBuilder
                  config={config as TimeSeriesConfig}
                  onUpdate={updateConfigImmediate}
               />
            )}
            {type === "breakdown" && (
               <BreakdownQueryBuilder
                  config={config as BreakdownConfig}
                  onUpdate={updateConfigImmediate}
               />
            )}

            <ErrorBoundary
               fallbackRender={({ error }) => (
                  <InsightErrorState error={error as Error} />
               )}
            >
               <Suspense fallback={<InsightLoadingState />}>
                  <InsightPreview config={config} />
               </Suspense>
            </ErrorBoundary>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={closeCredenza} variant="outline">
               Cancelar
            </Button>
            <Button
               disabled={updateMutation.isPending}
               onClick={handleSave}
            >
               {updateMutation.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
               )}
               Salvar
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

**Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
git add apps/web/src/features/analytics/ui/insight-edit-credenza.tsx
git commit -m "feat(analytics): add InsightEditCredenza component for in-dashboard insight config"
```

---

## Task 9: Wire "Configurar" into `DashboardTile` dropdown

**Files:**

- Modify: `apps/web/src/features/analytics/ui/dashboard-tile.tsx`

**Step 1: Add imports**

Add to the import block:

```typescript
import { Settings2 } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";
import { InsightEditCredenza } from "./insight-edit-credenza";
```

**Step 2: Destructure `openCredenza` in `DashboardTile`**

Inside the `DashboardTile` function body, add:

```typescript
const { openCredenza } = useCredenza();
```

**Step 3: Add "Configurar" menu item**

Inside `<DropdownMenuContent align="end">`, add the new item directly after the existing "Editar" `DropdownMenuItem` block (keep "Editar" as-is, add "Configurar" below it):

```tsx
{
   insightId && (
      <DropdownMenuItem
         onClick={() =>
            openCredenza({
               children: <InsightEditCredenza insightId={insightId} />,
               className: "sm:max-w-2xl",
            })
         }
      >
         <Settings2 className="mr-2 size-4" />
         Configurar
      </DropdownMenuItem>
   );
}
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/features/analytics/ui/dashboard-tile.tsx
git commit -m "feat(analytics): add Configurar option to dashboard tile dropdown — opens InsightEditCredenza"
```

---

## Verification

After all tasks, run:

```bash
bun run typecheck && bun run check
```

Then start the dev server and verify:

1. KPI tiles with `sum`/`avg`/`net` aggregation show `R$ X.XXX,XX`
2. KPI tiles with `count` aggregation show plain numbers
3. Chart Y-axis labels and tooltip values show `R$ X.XXX,XX` for monetary insights
4. "Saldo Líquido" KPI shows `Receita − Despesas` (a signed BRL value)
5. The `...` menu on any dashboard tile with an `insightId` shows a "Configurar" option
6. Clicking "Configurar" opens a credenza with the insight config pre-populated
7. Saving in the credenza updates the insight and closes the credenza
