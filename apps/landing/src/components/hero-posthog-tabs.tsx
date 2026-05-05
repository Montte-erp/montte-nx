import { Button } from "@packages/ui/components/button";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import {
   ArrowDownToLine,
   ArrowLeftRight,
   ArrowUpRight,
   Banknote,
   BarChart3,
   Bot,
   CheckCircle2,
   Command,
   CreditCard,
   FileSpreadsheet,
   Gauge,
   Lightbulb,
   LineChart,
   ListChecks,
   PieChart,
   Receipt,
   Repeat,
   Search,
   Shield,
   Sparkles,
   Ticket,
   Users,
   Wallet,
   Wand2,
   Workflow,
   Zap,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type Tab = {
   id: string;
   label: string;
   activeClass: string;
   title: string;
   left: string;
   right: ReactNode;
   render: () => ReactNode;
};

function Link({
   label,
   icon: Icon,
   tone,
   align = "left",
   badge,
}: {
   label: string;
   icon: Icon;
   tone: string;
   align?: "left" | "right";
   badge?: boolean;
}) {
   return (
      <li className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
         {align === "left" ? (
            <>
               <Icon aria-hidden="true" className={`size-4 ${tone}`} />
               <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="#produto"
               >
                  {label}
               </a>
               {badge ? (
                  <span
                     className="size-2 rounded-full bg-chart-3"
                     aria-hidden="true"
                  />
               ) : null}
            </>
         ) : (
            <>
               <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="#produto"
               >
                  {label}
               </a>
               {badge ? (
                  <span
                     className="size-2 rounded-full bg-chart-3"
                     aria-hidden="true"
                  />
               ) : null}
               <Icon aria-hidden="true" className={`size-4 ${tone}`} />
            </>
         )}
      </li>
   );
}

type HubPosition =
   | "left-top"
   | "left-middle"
   | "left-bottom"
   | "right-top"
   | "right-middle"
   | "right-bottom";

function HubCard({
   icon: Icon,
   tone,
   position,
   isCenter = false,
}: {
   icon: Icon;
   tone?: string;
   position?: HubPosition;
   isCenter?: boolean;
}) {
   const sizeClass = isCenter
      ? "size-16 border-border shadow-xl"
      : "size-12 border-border";
   const iconSize = isCenter ? "size-8" : "size-6";
   return (
      <div
         className={`relative flex rounded-xl border bg-background ${sizeClass}`}
      >
         <div className="z-20 flex flex-1 items-center justify-center">
            <Icon aria-hidden="true" className={`${iconSize} ${tone ?? ""}`} />
         </div>
         {position && !isCenter ? (
            <div
               className={`absolute top-1/2 z-10 h-px bg-gradient-to-r to-muted-foreground/25 ${
                  position === "left-top"
                     ? "left-full w-[130px] origin-left rotate-[25deg]"
                     : position === "left-middle"
                       ? "left-full w-[120px] origin-left"
                       : position === "left-bottom"
                         ? "left-full w-[130px] origin-left rotate-[-25deg]"
                         : position === "right-top"
                           ? "right-full w-[130px] origin-right rotate-[-25deg] bg-gradient-to-l"
                           : position === "right-middle"
                             ? "right-full w-[120px] origin-right bg-gradient-to-l"
                             : "right-full w-[130px] origin-right rotate-[25deg] bg-gradient-to-l"
               }`}
            />
         ) : null}
      </div>
   );
}

function HubLayout() {
   return (
      <div className="flex flex-col items-center gap-4 pt-4">
         <div className="relative flex w-full max-w-sm items-center justify-between">
            <div className="flex flex-col gap-4">
               <HubCard icon={Wallet} tone="text-primary" position="left-top" />
               <HubCard
                  icon={Users}
                  tone="text-chart-2"
                  position="left-middle"
               />
               <HubCard
                  icon={Workflow}
                  tone="text-chart-3"
                  position="left-bottom"
               />
            </div>

            <div
               aria-hidden="true"
               className="absolute inset-1/4 bg-[radial-gradient(var(--dots-color)_1px,transparent_1px)] opacity-50 [--dots-color:white] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"
            />

            <div className="relative z-20 rounded-2xl border border-border bg-muted p-2">
               <div className="flex size-16 items-center justify-center rounded-xl border border-border bg-background shadow-xl">
                  <img className="size-8" src="/favicon.svg" alt="" />
               </div>
            </div>

            <div className="flex flex-col gap-4">
               <HubCard
                  icon={Receipt}
                  tone="text-chart-5"
                  position="right-top"
               />
               <HubCard
                  icon={CreditCard}
                  tone="text-chart-6"
                  position="right-middle"
               />
               <HubCard
                  icon={FileSpreadsheet}
                  tone="text-foreground"
                  position="right-bottom"
               />
            </div>
         </div>

         <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button size="sm" variant="outline" type="button">
               <Lightbulb aria-hidden="true" />
               Aprender
            </Button>
            <Button size="sm" variant="outline" type="button">
               <Wand2 aria-hidden="true" />
               Operar
            </Button>
            <Button size="sm" variant="outline" type="button">
               <Zap aria-hidden="true" />
               Analisar
            </Button>
         </div>
      </div>
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

function InsightLayout() {
   return (
      <div className="flex flex-col gap-4 pt-4">
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
               delta="-0,8 pp depois da Rubi"
            />
         </div>
         <ul className="flex flex-wrap items-center justify-center gap-4 rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-2">
            <Link label="Dashboards" icon={PieChart} tone="text-chart-2" />
            <Link
               label="Insights da Rubi"
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

function ToolStep({
   icon: Icon,
   tone,
   bg,
   label,
   detail,
   status,
}: {
   icon: Icon;
   tone: string;
   bg: string;
   label: string;
   detail: string;
   status: "done" | "running" | "queued";
}) {
   const statusLabel =
      status === "done"
         ? "Concluído"
         : status === "running"
           ? "Executando"
           : "Na fila";
   return (
      <li className="flex items-center gap-4 rounded-md border border-border/60 bg-background/60 px-4 py-2">
         <span
            className={`flex size-8 items-center justify-center rounded-md ${bg}`}
         >
            <Icon aria-hidden="true" className={`size-4 ${tone}`} />
         </span>
         <div className="flex flex-1 flex-col">
            <span className="text-sm font-bold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
         </div>
         <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            {status === "done" ? (
               <CheckCircle2
                  aria-hidden="true"
                  className="size-3 text-primary"
               />
            ) : (
               <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${
                     status === "running"
                        ? "animate-pulse bg-chart-6"
                        : "bg-muted-foreground/40"
                  }`}
               />
            )}
            {statusLabel}
         </span>
      </li>
   );
}

function AgentLayout() {
   return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
         <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
               <span className="flex size-8 items-center justify-center rounded-md bg-chart-6/15">
                  <Bot aria-hidden="true" className="size-4 text-chart-6" />
               </span>
               Rubi · agente nativo
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
               <span
                  aria-hidden="true"
                  className="size-2 animate-pulse rounded-full bg-chart-6"
               />
               5 ferramentas · 1 workflow durável
            </span>
         </div>

         <div className="flex justify-end">
            <div className="max-w-md rounded-2xl rounded-tr-sm border border-border bg-muted/60 px-4 py-2 text-sm text-foreground">
               Rubi, classifique outubro, encontre duplicatas e dispare cobrança
               dos atrasados.
            </div>
         </div>

         <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-chart-6/40 bg-chart-6/5 px-4 py-2 text-sm text-foreground">
            <span className="flex items-center gap-2 font-bold text-chart-6">
               <Sparkles aria-hidden="true" className="size-3" /> Rubi
            </span>
            <span>
               Vou rodar em sequência. Cada passo executa em sandbox isolado e
               espera sua aprovação antes de afetar o ERP.
            </span>
         </div>

         <ul className="flex list-none flex-col gap-2 p-0">
            <ToolStep
               icon={Wand2}
               tone="text-primary"
               bg="bg-primary/15"
               label="categorize.transactions"
               detail="142 transações · regras + IA"
               status="done"
            />
            <ToolStep
               icon={Search}
               tone="text-chart-2"
               bg="bg-chart-2/15"
               label="detect.duplicates"
               detail="3 lançamentos suspeitos"
               status="done"
            />
            <ToolStep
               icon={ArrowLeftRight}
               tone="text-chart-3"
               bg="bg-chart-3/15"
               label="reconcile.ofx"
               detail="OFX Itaú · 28 conciliações"
               status="running"
            />
            <ToolStep
               icon={Workflow}
               tone="text-chart-5"
               bg="bg-chart-5/15"
               label="dunning.cycle"
               detail="cobrança trimestral · 12 contatos"
               status="queued"
            />
         </ul>

         <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
               <Shield aria-hidden="true" className="size-3 text-foreground" />
               Sandbox isolado · revisão humana antes de aplicar
            </span>
            <div className="flex gap-2">
               <Button size="sm" variant="outline" type="button">
                  <Command aria-hidden="true" />
                  Comandos
               </Button>
               <Button size="sm" variant="outline" type="button">
                  <ListChecks aria-hidden="true" />
                  Revisar tudo
               </Button>
            </div>
         </div>
      </div>
   );
}

function MeterBar({
   label,
   value,
   limit,
   unit,
   percent,
   tone,
   bg,
}: {
   label: string;
   value: string;
   limit: string;
   unit: string;
   percent: number;
   tone: string;
   bg: string;
}) {
   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-foreground">{label}</span>
            <span className="text-muted-foreground">
               <span className={tone}>{value}</span> / {limit} {unit}
            </span>
         </div>
         <div className="h-2 overflow-hidden rounded-full bg-muted">
            <span
               className={`block h-full rounded-full ${bg}`}
               style={{ width: `${percent}%` }}
            />
         </div>
      </div>
   );
}

function InvoiceLine({
   label,
   detail,
   value,
}: {
   label: string;
   detail: string;
   value: string;
}) {
   return (
      <li className="flex items-center justify-between gap-4 border-b border-dashed border-border/60 py-2 text-sm">
         <div className="flex flex-col">
            <span className="font-bold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground">{detail}</span>
         </div>
         <span className="font-bold text-foreground">{value}</span>
      </li>
   );
}

function BillingLayout() {
   return (
      <div className="grid gap-4 pt-4 lg:grid-cols-[1.1fr_1fr]">
         <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
               <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Gauge aria-hidden="true" className="size-4 text-primary" />
                  Uso · ciclo de outubro
               </span>
               <span className="text-xs font-bold text-muted-foreground">
                  18 dias restantes
               </span>
            </div>

            <div className="flex flex-col gap-4">
               <MeterBar
                  label="Cobranças emitidas"
                  value="1.842"
                  limit="3.000"
                  unit="op"
                  percent={61}
                  tone="text-primary"
                  bg="bg-primary"
               />
               <MeterBar
                  label="Mensagens da Rubi"
                  value="9.420"
                  limit="15.000"
                  unit="msg"
                  percent={63}
                  tone="text-chart-6"
                  bg="bg-chart-6"
               />
               <MeterBar
                  label="Notas e recibos"
                  value="312"
                  limit="500"
                  unit="docs"
                  percent={62}
                  tone="text-chart-3"
                  bg="bg-chart-3"
               />
               <MeterBar
                  label="Pix e boletos"
                  value="754"
                  limit="2.000"
                  unit="op"
                  percent={38}
                  tone="text-chart-2"
                  bg="bg-chart-2"
               />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs font-bold text-muted-foreground">
               <span className="inline-flex items-center gap-2">
                  <Sparkles
                     aria-hidden="true"
                     className="size-3 text-chart-3"
                  />
                  Add-on contratado · +500 docs
               </span>
               <span className="inline-flex items-center gap-2">
                  <Ticket aria-hidden="true" className="size-3 text-chart-5" />
                  Cupom LANÇAMENTO · -15%
               </span>
            </div>
         </div>

         <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
               <span className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Receipt aria-hidden="true" className="size-4 text-chart-5" />
                  Próxima fatura
               </span>
               <span className="text-xs font-bold text-muted-foreground">
                  31/10
               </span>
            </div>

            <ul className="flex list-none flex-col p-0">
               <InvoiceLine
                  label="Plataforma"
                  detail="assinatura mensal"
                  value="R$ 199,00"
               />
               <InvoiceLine
                  label="Cobranças emitidas"
                  detail="1.842 op · R$ 0,12"
                  value="R$ 221,04"
               />
               <InvoiceLine
                  label="Rubi · mensagens"
                  detail="9.420 msg · R$ 0,008"
                  value="R$ 75,36"
               />
               <InvoiceLine
                  label="Add-on · +500 docs"
                  detail="pacote único"
                  value="R$ 49,00"
               />
               <InvoiceLine
                  label="Cupom LANÇAMENTO"
                  detail="-15% sobre o subtotal"
                  value="−R$ 81,66"
               />
            </ul>

            <div className="flex items-center justify-between rounded-md bg-muted/60 px-4 py-2">
               <span className="text-sm font-bold text-foreground">Total</span>
               <span className="text-2xl font-black tracking-[-0.03em] text-foreground">
                  R$ 462,74
               </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
               <span className="inline-flex items-center gap-2">
                  <CreditCard
                     aria-hidden="true"
                     className="size-3 text-chart-2"
                  />
                  Abacate Pay
               </span>
               <span className="inline-flex items-center gap-2">
                  <ArrowDownToLine
                     aria-hidden="true"
                     className="size-3 text-foreground"
                  />
                  Exportação contábil
               </span>
            </div>
         </div>
      </div>
   );
}

const RubiLink = (
   <a className="font-bold text-foreground underline" href="#rubi">
      Rubi IA
   </a>
);

const tabs: Tab[] = [
   {
      id: "lugar",
      label: "Tudo no mesmo lugar",
      activeClass:
         "data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:!border-transparent",
      title: "Seu ERP inteiro num lugar só",
      left: "Financeiro, contatos, serviços e cobrança no mesmo lugar. Adeus planilha paralela e contexto perdido entre 5 abas.",
      right: (
         <>
            A {RubiLink} conecta os módulos e acha qualquer dado por cliente,
            CNPJ, documento ou operação — em segundos.
         </>
      ),
      render: HubLayout,
   },
   {
      id: "entenda",
      label: "Entenda seu negócio",
      activeClass:
         "data-[state=active]:!bg-chart-2 data-[state=active]:!text-background data-[state=active]:!border-transparent",
      title: "Decida com dados, não com achismo",
      left: "Receita, fluxo de caixa e inadimplência em dashboards prontos. Sem montar relatório, sem fórmula no Excel.",
      right: (
         <>
            Pergunte qualquer métrica à {RubiLink} — a resposta vem com base nos
            seus dados, não em palpite.
         </>
      ),
      render: InsightLayout,
   },
   {
      id: "automatize",
      label: "Automatize com IA",
      activeClass:
         "data-[state=active]:!bg-chart-6 data-[state=active]:!text-background data-[state=active]:!border-transparent",
      title: "Coloque a Rubi no piloto",
      left: "A Rubi é o agente nativo do Montte. Classifica transações, sugere cobranças e executa rotinas — sempre com revisão humana.",
      right: (
         <>
            Conecte os dados, ative os comandos e deixe a {RubiLink} no trabalho
            repetitivo. Você decide o que importa.
         </>
      ),
      render: AgentLayout,
   },
   {
      id: "cobre",
      label: "Cobre por uso",
      activeClass:
         "data-[state=active]:!bg-chart-5 data-[state=active]:!text-background data-[state=active]:!border-transparent",
      title: "Cobre exatamente o que entrega",
      left: "Modele assinatura, uso ou pacote num motor só. Meters, benefícios e cupons cobertos — sem gambiarra fiscal.",
      right: (
         <>
            Receba via Abacate Pay com Pix e cartão. A {RubiLink} monitora
            inadimplência e sugere a próxima ação.
         </>
      ),
      render: BillingLayout,
   },
];

export function HeroPosthogTabs() {
   return (
      <Tabs defaultValue={tabs[0].id} className=" ">
         <TabsList className="grid h-auto w-full grid-cols-2 gap-0 rounded-none bg-transparent p-0 lg:grid-cols-4">
            {tabs.map((tab) => (
               <TabsTrigger
                  className={`relative h-11 min-w-0 rounded-none rounded-t-md bg-transparent px-4 text-sm font-bold text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:shadow-none ${tab.activeClass}`}
                  key={tab.id}
                  value={tab.id}
               >
                  {tab.label}
               </TabsTrigger>
            ))}
         </TabsList>

         {tabs.map((tab) => (
            <TabsContent
               className="rounded-b-md rounded-tr-md border border-border bg-card/60 p-4 text-foreground"
               key={tab.id}
               value={tab.id}
            >
               <div className="flex flex-col gap-4">
                  <h2 className="max-w-3xl text-2xl leading-tight font-black tracking-[-0.045em]">
                     {tab.title}
                  </h2>

                  <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground lg:grid-cols-2">
                     <p>{tab.left}</p>
                     <p>{tab.right}</p>
                  </div>

                  {tab.render()}
               </div>
            </TabsContent>
         ))}
      </Tabs>
   );
}
