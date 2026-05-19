import {
   motion,
   useMotionValue,
   useReducedMotion,
   useTransform,
   animate,
} from "motion/react";

const EASE = [0.32, 0.72, 0, 1] as const;

export function HeroCarousel() {
   return (
      <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
         <div className="flex flex-col items-center gap-5 sm:items-start">
            <p className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">
               Billing e operação no mesmo ciclo
            </p>
            <h1 className="max-w-4xl text-left text-3xl font-semibold leading-none text-foreground text-balance sm:text-4xl md:text-5xl lg:text-6xl">
               A operação recorrente para negócios que cobram e operam em
               escala.
            </h1>
            <p className="max-w-2xl text-left text-sm leading-relaxed text-muted-foreground sm:text-base">
               Conecte assinatura, uso, cliente e faturamento em uma operação
               única, sem ERP improvisado e sem planilha no processo crítico.
            </p>

            <div className="flex flex-wrap justify-start gap-2">
               <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                  customers.state
               </span>
               <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                  uso medido
               </span>
               <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                  cobrança recorrente
               </span>
               <span className="rounded-full border border-border/70 bg-secondary/50 px-2 py-1 text-xs text-muted-foreground">
                  caixa e risco
               </span>
            </div>
         </div>

         <RecurringOperationsMock />
      </div>
   );
}

function RecurringOperationsMock() {
   return (
      <AppFrame
         path="/acme/recurrence/operations"
         chips={["SaaS BR", "Maio 2026", "customers.state"]}
      >
         <section className="space-y-3 p-3">
            <header className="flex items-start justify-between gap-3">
               <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Estado operacional
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                     Acme · Growth · uso medido
                  </p>
               </div>
               <StatusPill tone="ok">Ativo</StatusPill>
            </header>

            <div className="grid gap-3 lg:grid-cols-2">
               <div className="rounded-md border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Billing
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                     R$ 2.412,90 do mês
                  </p>
                  <p className="text-xs text-muted-foreground">
                     Fatura: aberta · vencimento em 2 dias
                  </p>
                  <KPIHeader
                     label="Uso mensurado"
                     value="18.420"
                     delta="AI events · acima da cota em 14%"
                     trend={[4, 6, 8, 10, 12, 15, 18, 19, 18, 20]}
                     positive
                  />
               </div>

               <div className="rounded-md border border-border/60 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                     Finanças
                  </p>
                  <div className="mt-1 grid gap-1">
                     <div className="flex justify-between text-sm text-foreground">
                        <span>Receita reconhecida</span>
                        <span>R$ 1.284,00</span>
                     </div>
                     <div className="flex justify-between text-sm text-foreground">
                        <span>Pendência aberta</span>
                        <StatusPill tone="warn">Revisão</StatusPill>
                     </div>
                     <div className="flex justify-between text-sm text-foreground">
                        <span>Próxima ação</span>
                        <StatusPill tone="muted">Cobrança manual</StatusPill>
                     </div>
                  </div>
               </div>
            </div>

            <div className="rounded-md border border-border/60 p-3">
               <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Próximos passos no painel
               </p>
               <div className="mt-2 space-y-2 text-sm text-foreground">
                  <div className="flex items-center justify-between gap-4 border-t border-border/30 py-1">
                     <span className="text-muted-foreground">Acme</span>
                     <span>Cliente com uso acima do contrato</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/30 py-1">
                     <span className="text-muted-foreground">Northwind</span>
                     <span>Cobrança automática pendente</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-border/30 py-1">
                     <span className="text-muted-foreground">Infra</span>
                     <span>Alocar custo no Centro de Custo</span>
                  </div>
               </div>
            </div>
         </section>
      </AppFrame>
   );
}

function AppFrame({
   path,
   chips,
   children,
}: {
   path: string;
   chips: string[];
   children: React.ReactNode;
}) {
   return (
      <figure className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-background/70">
         <header className="flex items-center gap-4 border-b border-border/60 bg-secondary/30 px-4 py-2">
            <div className="flex items-center gap-2">
               <span className="size-2 rounded-full bg-destructive/60" />
               <span className="size-2 rounded-full bg-chart-3/60" />
               <span className="size-2 rounded-full bg-primary/60" />
            </div>
            <code className="flex-1 truncate rounded-md bg-background/60 px-2 py-1 text-xs text-muted-foreground">
               app.montte.co{path}
            </code>
            <div className="hidden items-center gap-2 sm:flex">
               {chips.map((c) => (
                  <span
                     key={c}
                     className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-xs text-muted-foreground"
                  >
                     {c}
                  </span>
               ))}
            </div>
         </header>
         {children}
      </figure>
   );
}

function CounterValue({ to, prefix = "R$ " }: { to: number; prefix?: string }) {
   const mv = useMotionValue(0);
   const shouldReduceMotion = useReducedMotion();
   const rounded = useTransform(
      mv,
      (v) =>
         `${prefix}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   );

   if (shouldReduceMotion) {
      mv.set(to);
      return <motion.span>{rounded}</motion.span>;
   }

   animate(mv, to, { duration: 1.2, ease: EASE });
   return <motion.span>{rounded}</motion.span>;
}

function Sparkline({
   points,
   positive = true,
}: {
   points: number[];
   positive?: boolean;
}) {
   const shouldReduceMotion = useReducedMotion();
   const max = Math.max(...points);
   const min = Math.min(...points);
   const range = max - min || 1;
   const w = 120;
   const h = 32;
   const d = points
      .map((v, i) => {
         const x = (i / (points.length - 1)) * w;
         const y = h - ((v - min) / range) * h;
         return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
   const stroke = positive ? "var(--primary)" : "var(--destructive)";

   return (
      <svg width={w} height={h} className="overflow-visible">
         <motion.path
            d={d}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{
               duration: shouldReduceMotion ? 0 : 1,
               ease: EASE,
               delay: shouldReduceMotion ? 0 : 0.2,
            }}
         />
      </svg>
   );
}

function KPIHeader({
   label,
   value,
   delta,
   trend,
   positive = true,
}: {
   label: string;
   value: number | string;
   delta: string;
   trend: number[];
   positive?: boolean;
}) {
   return (
      <header className="flex items-end justify-between gap-4 px-4 py-4">
         <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
               {label}
            </span>
            <span className="text-3xl font-bold text-foreground tabular-nums">
               {typeof value === "number" ? <CounterValue to={value} /> : value}
            </span>
            <span
               className={`flex items-center gap-1 text-xs font-semibold ${positive ? "text-primary" : "text-destructive"}`}
            >
               <ArrowTrend up={positive} />
               {delta}
            </span>
         </div>
         <Sparkline points={trend} positive={positive} />
      </header>
   );
}

function ArrowTrend({ up }: { up: boolean }) {
   return (
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
         <path
            d={up ? "M2 8 L6 4 L10 8" : "M2 4 L6 8 L10 4"}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
         />
      </svg>
   );
}

function StatusPill({
   tone,
   children,
}: {
   tone: "ok" | "warn" | "muted" | "danger";
   children: React.ReactNode;
}) {
   const map = {
      ok: "bg-primary/15 text-primary",
      warn: "bg-chart-3/15 text-chart-3",
      muted: "bg-muted/40 text-muted-foreground",
      danger: "bg-destructive/15 text-destructive",
   };

   return (
      <span
         className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[tone]}`}
      >
         <span className="size-1.5 rounded-full bg-current" />
         {children}
      </span>
   );
}
