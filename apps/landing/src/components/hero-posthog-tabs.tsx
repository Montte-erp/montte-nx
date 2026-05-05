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
   FolderTree,
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

function ActionLine({
   icon: Icon,
   tone,
   text,
   status,
}: {
   icon: Icon;
   tone: string;
   text: string;
   status: string;
}) {
   return (
      <li className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-background/60 px-4 py-2 text-sm">
         <span className="flex items-center gap-2 text-foreground">
            <Icon aria-hidden="true" className={`size-4 ${tone}`} />
            {text}
         </span>
         <span className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="size-3 text-primary" />
            {status}
         </span>
      </li>
   );
}

function AgentLayout() {
   return (
      <div className="grid gap-4 pt-4 lg:grid-cols-[1fr_1.2fr]">
         <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
               <Bot aria-hidden="true" className="size-4 text-chart-6" />
               Rubi · agente nativo
            </div>
            <div className="rounded-md bg-muted/40 px-4 py-2 text-sm text-foreground">
               <span className="font-bold">Você:</span> classifique outubro e
               sinalize duplicatas
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-chart-6/40 bg-chart-6/5 px-4 py-2 text-sm text-foreground">
               <span className="flex items-center gap-2 font-bold text-chart-6">
                  <Sparkles aria-hidden="true" className="size-3" /> Rubi
               </span>
               <span>
                  142 transações classificadas · 3 duplicatas detectadas · 1
                  inconsistência aguarda revisão.
               </span>
            </div>
            <div className="flex gap-2">
               <Button size="sm" variant="outline" type="button">
                  <Command aria-hidden="true" />
                  Comandos
               </Button>
               <Button size="sm" variant="outline" type="button">
                  <ListChecks aria-hidden="true" />
                  Revisar
               </Button>
            </div>
         </div>

         <ul className="flex list-none flex-col gap-2 p-0">
            <ActionLine
               icon={Wand2}
               tone="text-primary"
               text="Categorização automática · 142 transações"
               status="Concluído"
            />
            <ActionLine
               icon={Search}
               tone="text-chart-2"
               text="Detecção de duplicatas · 3 encontradas"
               status="Revisar"
            />
            <ActionLine
               icon={ArrowLeftRight}
               tone="text-chart-3"
               text="Reconciliação assistida · OFX Itaú"
               status="Em andamento"
            />
            <ActionLine
               icon={Workflow}
               tone="text-chart-5"
               text="Workflow durável · cobrança trimestral"
               status="Agendado"
            />
            <ActionLine
               icon={Shield}
               tone="text-foreground"
               text="Sandbox seguro · execução isolada"
               status="Ativo"
            />
         </ul>
      </div>
   );
}

function BillingColumn({
   title,
   items,
}: {
   title: string;
   items: { label: string; icon: Icon; tone: string }[];
}) {
   return (
      <div className="flex flex-col gap-4">
         <h3 className="border-b border-border pb-2 text-sm font-bold text-muted-foreground">
            {title}
         </h3>
         <ul className="flex list-none flex-col gap-4 p-0">
            {items.map(({ label, icon: Icon, tone }) => (
               <li
                  className="flex items-center gap-2 text-sm font-bold text-foreground"
                  key={label}
               >
                  <Icon aria-hidden="true" className={`size-4 ${tone}`} />
                  <a
                     className="underline underline-offset-2 hover:text-muted-foreground"
                     href="#produto"
                  >
                     {label}
                  </a>
               </li>
            ))}
         </ul>
      </div>
   );
}

function BillingLayout() {
   return (
      <div className="grid gap-4 pt-4 lg:grid-cols-3">
         <BillingColumn
            title="Modelos de preço"
            items={[
               {
                  label: "Assinaturas recorrentes",
                  icon: Repeat,
                  tone: "text-chart-5",
               },
               { label: "Cobrança por uso", icon: Gauge, tone: "text-primary" },
               {
                  label: "Pacotes e add-ons",
                  icon: Sparkles,
                  tone: "text-chart-3",
               },
               {
                  label: "Cupons e descontos",
                  icon: Ticket,
                  tone: "text-chart-2",
               },
               {
                  label: "Catálogo de serviços",
                  icon: FolderTree,
                  tone: "text-foreground",
               },
            ]}
         />
         <BillingColumn
            title="Recebimento"
            items={[
               { label: "Asaas", icon: CreditCard, tone: "text-chart-5" },
               { label: "Stripe", icon: CreditCard, tone: "text-chart-2" },
               {
                  label: "Mercado Pago",
                  icon: CreditCard,
                  tone: "text-chart-3",
               },
               { label: "Pix e boleto", icon: Receipt, tone: "text-primary" },
               {
                  label: "Portal do cliente",
                  icon: Users,
                  tone: "text-foreground",
               },
            ]}
         />
         <BillingColumn
            title="Operação"
            items={[
               {
                  label: "Régua de cobrança",
                  icon: ListChecks,
                  tone: "text-chart-5",
               },
               { label: "Inadimplência", icon: Zap, tone: "text-chart-3" },
               {
                  label: "Notas e recibos",
                  icon: FileSpreadsheet,
                  tone: "text-chart-2",
               },
               { label: "Auditoria", icon: Shield, tone: "text-primary" },
               {
                  label: "Exportação contábil",
                  icon: ArrowDownToLine,
                  tone: "text-foreground",
               },
            ]}
         />
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
            Receba via Asaas, Stripe ou Mercado Pago. A {RubiLink} monitora
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
