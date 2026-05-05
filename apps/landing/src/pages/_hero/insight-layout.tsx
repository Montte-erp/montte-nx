import {
   ArrowUpRight,
   Banknote,
   BarChart3,
   FileSpreadsheet,
   Gauge,
   Lightbulb,
   LineChart,
   PieChart,
   Repeat,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function Link({
   label,
   icon: Icon,
   tone,
}: {
   label: string;
   icon: Icon;
   tone: string;
}) {
   return (
      <li className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
         <Icon aria-hidden="true" className={`size-4 ${tone}`} />
         <a
            className="underline underline-offset-2 hover:text-foreground"
            href="#produto"
         >
            {label}
         </a>
      </li>
   );
}

function StatBlock({
   value,
   label,
   tone,
   icon: Icon,
   delta,
}: {
   value: string;
   label: string;
   tone: string;
   icon: Icon;
   delta: string;
}) {
   return (
      <div className="flex flex-col items-center gap-4 px-4 py-4 text-center">
         <Icon aria-hidden="true" className={`size-8 ${tone}`} />
         <div className={`text-5xl font-black tracking-[-0.04em] ${tone}`}>
            {value}
         </div>
         <p className="text-sm font-bold text-foreground">{label}</p>
         <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <ArrowUpRight aria-hidden="true" className="size-3" />
            {delta}
         </span>
      </div>
   );
}

export function InsightLayout() {
   return (
      <div className="flex flex-col gap-4">
         <div className="grid gap-4 divide-y divide-border lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-y-0">
            <StatBlock
               value="R$ 184k"
               label="Receita recorrente"
               tone="text-chart-2"
               icon={Repeat}
               delta="+12,4% vs. mês anterior"
            />
            <StatBlock
               value="R$ 56k"
               label="Fluxo de caixa projetado"
               tone="text-primary"
               icon={LineChart}
               delta="+4,1% nas próximas 4 semanas"
            />
            <StatBlock
               value="2,3%"
               label="Inadimplência"
               tone="text-chart-3"
               icon={Gauge}
               delta="-0,8 pp depois da Montte AI"
            />
         </div>
         <ul className="flex flex-wrap items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-background/40 p-4">
            <Link label="Dashboards" icon={PieChart} tone="text-chart-2" />
            <Link
               label="Insights da Montte AI"
               icon={Lightbulb}
               tone="text-primary"
            />
            <Link
               label="Indicadores por cliente"
               icon={BarChart3}
               tone="text-chart-3"
            />
            <Link
               label="Conciliação bancária"
               icon={Banknote}
               tone="text-chart-6"
            />
            <Link
               label="Relatórios exportáveis"
               icon={FileSpreadsheet}
               tone="text-foreground"
            />
         </ul>
      </div>
   );
}
