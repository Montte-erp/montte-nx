import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import {
   ChartContainer,
   type ChartConfig,
   ChartLegend,
   ChartLegendContent,
   ChartTooltip,
   ChartTooltipContent,
} from "@packages/ui/components/chart";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Activity, BarChart3 } from "lucide-react";
import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { orpc } from "@/integrations/orpc/client";
import {
   SUBSCRIPTION_STATUS_LABEL,
   type SubscriberRow,
} from "./service-subscribers-columns";

const PALETTE = [
   "var(--chart-1)",
   "var(--chart-2)",
   "var(--chart-3)",
   "var(--chart-4)",
   "var(--chart-5)",
];

function rowMrr(row: SubscriberRow): number {
   const unit = Number(row.negotiatedPrice ?? row.basePrice);
   const total = unit * row.quantity;
   if (row.interval === "monthly") return total;
   if (row.interval === "annual") return total / 12;
   if (row.interval === "semestral") return total / 6;
   if (row.interval === "weekly") return total * (52 / 12);
   return 0;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
   return (
      <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
         <span className="text-xs text-muted-foreground">{label}</span>
         <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
         </span>
      </div>
   );
}

export function ServiceOverviewTab({ serviceId }: { serviceId: string }) {
   const { data: rows } = useSuspenseQuery(
      orpc.services.getSubscribers.queryOptions({ input: { serviceId } }),
   );

   const stats = useMemo(() => {
      const activeRows = rows.filter((r) => r.status === "active");
      const mrr = activeRows.reduce((acc, r) => acc + rowMrr(r), 0);
      return {
         mrr,
         active: activeRows.length,
         trial: rows.filter((r) => r.status === "trialing").length,
         cancelled: rows.filter((r) => r.status === "cancelled").length,
      };
   }, [rows]);

   const distribution = useMemo(() => {
      const map = new Map<string, { name: string; count: number }>();
      for (const r of rows) {
         if (r.status !== "active" && r.status !== "trialing") continue;
         const cur = map.get(r.priceId) ?? { name: r.priceName, count: 0 };
         cur.count += 1;
         map.set(r.priceId, cur);
      }
      return Array.from(map.entries()).map(([priceId, v], i) => ({
         priceId,
         name: v.name,
         count: v.count,
         fill: PALETTE[i % PALETTE.length],
      }));
   }, [rows]);

   const recent = useMemo(() => rows.slice(0, 8), [rows]);

   const chartConfig = useMemo<ChartConfig>(() => {
      return distribution.reduce<ChartConfig>((acc, d) => {
         acc[d.priceId] = { label: d.name, color: d.fill };
         return acc;
      }, {});
   }, [distribution]);

   if (rows.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <BarChart3 className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Sem dados ainda</EmptyTitle>
               <EmptyDescription>
                  Métricas aparecem assim que o serviço tiver assinantes.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
               label="MRR"
               value={format(of(stats.mrr.toFixed(2), "BRL"), "pt-BR")}
            />
            <StatCard label="Ativas" value={stats.active} />
            <StatCard label="Trial" value={stats.trial} />
            <StatCard label="Canceladas" value={stats.cancelled} />
         </div>

         <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
               <span className="text-sm font-medium">
                  Distribuição por preço
               </span>
               {distribution.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                     Sem assinaturas ativas.
                  </p>
               ) : (
                  <ChartContainer
                     className="mx-auto aspect-square max-h-64"
                     config={chartConfig}
                  >
                     <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                           data={distribution}
                           dataKey="count"
                           innerRadius={60}
                           nameKey="name"
                           outerRadius={90}
                        >
                           {distribution.map((d) => (
                              <Cell key={d.priceId} fill={d.fill} />
                           ))}
                        </Pie>
                        <ChartLegend content={<ChartLegendContent />} />
                     </PieChart>
                  </ChartContainer>
               )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
               <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                     Últimas atividades
                  </span>
               </div>
               <ul className="flex flex-col gap-2">
                  {recent.map((r) => (
                     <li
                        key={r.itemId}
                        className="flex items-center justify-between gap-2 text-xs"
                     >
                        <div className="flex flex-col gap-0.5">
                           <span className="font-medium">{r.contactName}</span>
                           <span className="text-muted-foreground">
                              {r.priceName} · iniciada{" "}
                              {dayjs(r.startDate).format("DD/MM/YYYY")}
                           </span>
                        </div>
                        <Badge variant="outline">
                           {SUBSCRIPTION_STATUS_LABEL[r.status]}
                        </Badge>
                     </li>
                  ))}
               </ul>
            </div>
         </div>
      </div>
   );
}
