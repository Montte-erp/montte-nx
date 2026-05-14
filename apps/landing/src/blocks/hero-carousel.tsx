import {
   AnimatePresence,
   motion,
   useMotionValue,
   useTransform,
   animate,
} from "motion/react";
import { useEffect, useState } from "react";

const TOPICS = [
   { key: "financas", label: "Finanças" },
   { key: "contatos", label: "Contatos" },
   { key: "cobrancas", label: "Cobranças" },
] as const;

type TopicKey = (typeof TOPICS)[number]["key"];

const CYCLE_MS = 6000;
const EASE = [0.32, 0.72, 0, 1] as const;

export function HeroCarousel() {
   const [index, setIndex] = useState(0);

   useEffect(() => {
      const id = window.setTimeout(
         () => setIndex((v) => (v + 1) % TOPICS.length),
         CYCLE_MS,
      );
      return () => window.clearTimeout(id);
   }, [index]);

   const current = TOPICS[index];
   const SLOT_PCT = 50;
   const STRIP_PCT = TOPICS.length * SLOT_PCT;
   const txParent = 50 - (index + 0.5) * SLOT_PCT;
   const stripX = `${(txParent * 100) / STRIP_PCT}%`;

   return (
      <div className="flex w-full flex-col items-center gap-8">
         <div
            className="w-full py-2"
            style={{ overflowX: "clip", overflowY: "visible" }}
            aria-hidden="true"
         >
            <motion.div
               className="flex items-center"
               animate={{ x: stripX }}
               transition={{ duration: 0.7, ease: EASE }}
               style={{ width: `${STRIP_PCT}%` }}
            >
               {TOPICS.map((t, i) => {
                  const isCenter = i === index;
                  return (
                     <motion.div
                        key={t.key}
                        className="flex shrink-0 items-center justify-center"
                        style={{ width: `${100 / TOPICS.length}%` }}
                        animate={{
                           scale: isCenter ? 1 : 0.55,
                           opacity: isCenter ? 1 : 0.35,
                        }}
                        transition={{ duration: 0.7, ease: EASE }}
                     >
                        <span
                           className={`text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl ${isCenter ? "text-foreground" : "text-muted-foreground"}`}
                        >
                           {t.label}
                        </span>
                     </motion.div>
                  );
               })}
            </motion.div>
         </div>

         <h1 className="sr-only">
            Montte — plataforma para SaaS:{" "}
            {TOPICS.map((t) => t.label).join(", ")}.
         </h1>

         <div className="relative w-full max-w-3xl overflow-hidden">
            <AnimatePresence mode="wait">
               <motion.div
                  key={current.key}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.5, ease: EASE }}
               >
                  <TopicMock topic={current.key} />
               </motion.div>
            </AnimatePresence>
         </div>
      </div>
   );
}

function TopicMock({ topic }: { topic: TopicKey }) {
   if (topic === "financas") return <FinanceMock />;
   if (topic === "contatos") return <ContactsMock />;
   return <BillingMock />;
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
      <figure className="overflow-hidden rounded-2xl border border-border/40 bg-card/85 shadow-2xl shadow-background/70 backdrop-blur">
         <header className="flex items-center gap-4 border-b border-border/40 bg-background/40 px-4 py-2">
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
                     className="rounded-full border border-border/60 bg-background/40 px-2 py-1 text-xs text-muted-foreground"
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
   const rounded = useTransform(
      mv,
      (v) =>
         `${prefix}${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
   );

   useEffect(() => {
      const controls = animate(mv, to, { duration: 1.2, ease: EASE });
      return controls.stop;
   }, [mv, to]);

   return <motion.span>{rounded}</motion.span>;
}

function Sparkline({
   points,
   positive = true,
}: {
   points: number[];
   positive?: boolean;
}) {
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
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
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

function Row({
   children,
   delay,
}: {
   children: React.ReactNode;
   delay: number;
}) {
   return (
      <motion.tr
         initial={{ opacity: 0, x: -8 }}
         animate={{ opacity: 1, x: 0 }}
         transition={{ duration: 0.25, delay: delay * 0.3 }}
         className="border-t border-border/30"
      >
         {children}
      </motion.tr>
   );
}

type FinanceStatus = "Efetivado" | "Pendente" | "Ignorado";

const TRANSACTIONS: Array<{
   name: string;
   cat: string;
   costCenter: string;
   catColor: string;
   date: string;
   status: FinanceStatus;
   value: string;
   positive: boolean;
}> = [
   {
      name: "Acme · PAYG maio",
      cat: "Receita de Serviço",
      costCenter: "Operacional",
      catColor: "#16a34a",
      date: "14 mai",
      status: "Efetivado",
      value: "+ R$ 1.284,00",
      positive: true,
   },
   {
      name: "Northwind · PAYG maio",
      cat: "Receita de Serviço",
      costCenter: "Operacional",
      catColor: "#16a34a",
      date: "14 mai",
      status: "Efetivado",
      value: "+ R$ 312,00",
      positive: true,
   },
   {
      name: "OpenRouter · tokens",
      cat: "Software (SaaS)",
      costCenter: "Custo do Produto",
      catColor: "#dc2626",
      date: "13 mai",
      status: "Efetivado",
      value: "− R$ 487,20",
      positive: false,
   },
   {
      name: "Railway · infra prod",
      cat: "Software (SaaS)",
      costCenter: "Administrativo",
      catColor: "#f97316",
      date: "12 mai",
      status: "Pendente",
      value: "− R$ 412,30",
      positive: false,
   },
   {
      name: "Resend · transacional",
      cat: "Software (SaaS)",
      costCenter: "Administrativo",
      catColor: "#f97316",
      date: "10 mai",
      status: "Ignorado",
      value: "− R$ 95,00",
      positive: false,
   },
];

const FINANCE_STATUS_TONE: Record<FinanceStatus, "ok" | "warn" | "muted"> = {
   Efetivado: "ok",
   Pendente: "warn",
   Ignorado: "muted",
};

function FinanceMock() {
   return (
      <AppFrame
         path="/acme/principal/transactions"
         chips={["Maio 2026", "Conta principal"]}
      >
         <KPIHeader
            label="Receita · maio"
            value={1596}
            delta="+R$ 312 vs. abril · novo cliente onboarded"
            trend={[0, 0, 280, 420, 580, 780, 890, 1100, 1284, 1596]}
            positive
         />
         <table className="w-full table-fixed">
            <thead className="bg-background/30">
               <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-[20%]">Status</th>
                  <th className="px-3 py-2 font-medium w-[10%]">Data</th>
                  <th className="px-3 py-2 font-medium w-[24%]">Nome</th>
                  <th className="px-3 py-2 font-medium w-[16%]">Categoria</th>
                  <th className="px-3 py-2 font-medium w-[16%]">
                     Centro de Custo
                  </th>
                  <th className="px-3 py-2 text-right font-medium w-[14%]">
                     Valor
                  </th>
               </tr>
            </thead>
            <tbody>
               {TRANSACTIONS.map((t, i) => (
                  <Row key={t.name} delay={0.3 + i * 0.08}>
                     <td className="px-3 py-2 whitespace-nowrap">
                        <StatusPill tone={FINANCE_STATUS_TONE[t.status]}>
                           {t.status}
                        </StatusPill>
                     </td>
                     <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {t.date}
                     </td>
                     <td className="px-3 py-2 text-sm font-medium text-foreground truncate">
                        {t.name}
                     </td>
                     <td className="px-3 py-2 text-sm text-muted-foreground truncate">
                        {t.cat}
                     </td>
                     <td className="px-3 py-2">
                        <span
                           className="inline-block whitespace-nowrap rounded-md border px-2 py-1 text-xs"
                           style={{
                              borderColor: `color-mix(in oklch, ${t.catColor} 40%, transparent)`,
                              background: `color-mix(in oklch, ${t.catColor} 12%, transparent)`,
                              color: t.catColor,
                           }}
                        >
                           # {t.costCenter}
                        </span>
                     </td>
                     <td
                        className={`px-3 py-2 text-right text-sm font-semibold tabular-nums whitespace-nowrap ${t.positive ? "text-primary" : "text-destructive"}`}
                     >
                        {t.value}
                     </td>
                  </Row>
               ))}
            </tbody>
         </table>
      </AppFrame>
   );
}

const CONTACTS = [
   {
      name: "Acme",
      type: "PJ",
      city: "Juiz de Fora · MG",
      since: "mar/2026",
      costCenter: "Receita Operacional",
      costCenterColor: "#16a34a",
      mrr: "R$ 1.284",
   },
   {
      name: "Northwind",
      type: "PJ",
      city: "Jacobina · BA",
      since: "mai/2026",
      costCenter: "Receita Operacional",
      costCenterColor: "#16a34a",
      mrr: "R$ 312",
   },
];

function ContactsMock() {
   return (
      <AppFrame
         path="/acme/principal/contacts"
         chips={["2 ativos", "0% churn"]}
      >
         <KPIHeader
            label="Receita por cliente · ARPA"
            value={798}
            delta="+R$ 156 vs. abril"
            trend={[290, 320, 380, 420, 480, 540, 620, 680, 740, 798]}
            positive
         />
         <table className="w-full">
            <thead className="bg-background/30">
               <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Contato</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Cidade</th>
                  <th className="px-4 py-2 font-medium">Centro de Custo</th>
                  <th className="px-4 py-2 font-medium">Ativo desde</th>
                  <th className="px-4 py-2 text-right font-medium">
                     Receita / mês
                  </th>
               </tr>
            </thead>
            <tbody>
               {CONTACTS.map((c, i) => (
                  <Row key={c.name} delay={0.3 + i * 0.08}>
                     <td className="px-4 py-2 text-sm font-medium text-foreground">
                        {c.name}
                     </td>
                     <td className="px-4 py-2 text-sm text-muted-foreground">
                        {c.type}
                     </td>
                     <td className="px-4 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {c.city}
                     </td>
                     <td className="px-4 py-2">
                        <span
                           className="rounded-md border px-2 py-1 text-xs"
                           style={{
                              borderColor: `color-mix(in oklch, ${c.costCenterColor} 40%, transparent)`,
                              background: `color-mix(in oklch, ${c.costCenterColor} 12%, transparent)`,
                              color: c.costCenterColor,
                           }}
                        >
                           # {c.costCenter}
                        </span>
                     </td>
                     <td className="px-4 py-2 text-sm text-muted-foreground">
                        {c.since}
                     </td>
                     <td className="px-4 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
                        {c.mrr}
                     </td>
                  </Row>
               ))}
            </tbody>
         </table>
      </AppFrame>
   );
}

type BillingStatus = "Em uso" | "Faturado" | "Pendente";

const USAGE: Array<{
   customer: string;
   meter: string;
   planColor: string;
   usage: string;
   rate: string;
   trend: number[];
   status: BillingStatus;
   value: string;
}> = [
   {
      customer: "Acme",
      meter: "AI events",
      planColor: "#16a34a",
      usage: "18.420",
      rate: "R$ 0,058",
      trend: [2, 4, 6, 9, 12, 15, 16, 17, 18, 18],
      status: "Em uso",
      value: "R$ 1.068,36",
   },
   {
      customer: "Northwind",
      meter: "AI events",
      planColor: "#16a34a",
      usage: "4.890",
      rate: "R$ 0,058",
      trend: [0, 0, 1, 2, 3, 3, 4, 4, 4, 5],
      status: "Em uso",
      value: "R$ 283,62",
   },
   {
      customer: "Northwind",
      meter: "E-mails",
      planColor: "#a855f7",
      usage: "1.420",
      rate: "R$ 0,02",
      trend: [10, 8, 12, 9, 14, 11, 15, 12, 16, 14],
      status: "Faturado",
      value: "R$ 28,40",
   },
   {
      customer: "Acme",
      meter: "NFS-e",
      planColor: "#3b82f6",
      usage: "108",
      rate: "R$ 2,00",
      trend: [4, 6, 5, 7, 9, 8, 10, 9, 11, 12],
      status: "Em uso",
      value: "R$ 216,00",
   },
   {
      customer: "Acme",
      meter: "Storage GB",
      planColor: "#f97316",
      usage: "42 GB",
      rate: "R$ 0,49 / GB",
      trend: [20, 22, 24, 28, 30, 32, 36, 38, 40, 42],
      status: "Pendente",
      value: "R$ 20,58",
   },
];

const BILLING_STATUS_TONE: Record<BillingStatus, "ok" | "warn" | "muted"> = {
   "Em uso": "ok",
   Faturado: "muted",
   Pendente: "warn",
};

function MiniBar({ points, color }: { points: number[]; color: string }) {
   const max = Math.max(...points) || 1;
   const w = 64;
   const h = 18;
   const gap = 1;
   const bw = (w - gap * (points.length - 1)) / points.length;
   return (
      <svg width={w} height={h} aria-hidden="true">
         {points.map((v, i) => {
            const bh = Math.max(2, (v / max) * h);
            const x = i * (bw + gap);
            const y = h - bh;
            return (
               <motion.rect
                  key={`${i}-${v}`}
                  x={x}
                  width={bw}
                  initial={{ y: h, height: 0, opacity: 0 }}
                  animate={{ y, height: bh, opacity: 1 }}
                  transition={{
                     duration: 0.5,
                     ease: EASE,
                     delay: 0.2 + i * 0.03,
                  }}
                  fill={color}
                  rx={1}
               />
            );
         })}
      </svg>
   );
}

function BillingMock() {
   return (
      <AppFrame
         path="/acme/principal/transactions"
         chips={["Pay-as-you-go", "Ciclo · maio 2026"]}
      >
         <KPIHeader
            label="Cobrança acumulada · maio"
            value={1596.38}
            delta="+R$ 312 vs. abril · 2 clientes ativos"
            trend={[0, 80, 180, 340, 540, 760, 980, 1180, 1380, 1596]}
            positive
         />
         <table className="w-full table-fixed">
            <thead className="bg-background/30">
               <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-[16%]">Cliente</th>
                  <th className="px-3 py-2 font-medium w-[18%]">Meter</th>
                  <th className="px-3 py-2 font-medium w-[14%]">Uso</th>
                  <th className="px-3 py-2 font-medium w-[18%]">Tendência</th>
                  <th className="px-3 py-2 font-medium w-[16%]">Status</th>
                  <th className="px-3 py-2 text-right font-medium w-[18%]">
                     Acumulado
                  </th>
               </tr>
            </thead>
            <tbody>
               {USAGE.map((u, i) => (
                  <Row key={`${u.customer}-${u.meter}`} delay={0.3 + i * 0.08}>
                     <td className="px-3 py-2 text-sm font-medium text-foreground whitespace-nowrap">
                        {u.customer}
                     </td>
                     <td className="px-3 py-2">
                        <span
                           className="inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold"
                           style={{
                              background: `color-mix(in oklch, ${u.planColor} 18%, transparent)`,
                              color: u.planColor,
                           }}
                        >
                           {u.meter}
                        </span>
                     </td>
                     <td className="px-3 py-2 text-sm tabular-nums text-foreground whitespace-nowrap">
                        <span className="block">{u.usage}</span>
                        <span className="block text-[10px] text-muted-foreground">
                           {u.rate}
                        </span>
                     </td>
                     <td className="px-3 py-2">
                        <MiniBar points={u.trend} color={u.planColor} />
                     </td>
                     <td className="px-3 py-2 whitespace-nowrap">
                        <StatusPill tone={BILLING_STATUS_TONE[u.status]}>
                           {u.status}
                        </StatusPill>
                     </td>
                     <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                        {u.value}
                     </td>
                  </Row>
               ))}
            </tbody>
         </table>
      </AppFrame>
   );
}
