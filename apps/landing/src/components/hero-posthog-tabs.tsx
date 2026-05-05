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
   Building2,
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
   Tags,
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

function HubLayout() {
   return (
      <div className="grid items-end gap-4 pt-4 lg:grid-cols-[200px_minmax(0,1fr)_220px]">
         <ul className="flex list-none flex-col gap-4 p-0">
            <Link label="Contatos" icon={Users} tone="text-primary" />
            <Link label="Financeiro" icon={Wallet} tone="text-chart-2" />
            <Link label="Serviços" icon={Workflow} tone="text-chart-3" />
            <Link label="Cobranças" icon={Receipt} tone="text-chart-5" />
            <Link
               label="OFX, CSV e XLSX"
               icon={FileSpreadsheet}
               tone="text-chart-6"
            />
            <Link
               label="Busca unificada"
               icon={Search}
               tone="text-foreground"
            />
         </ul>

         <div className="flex flex-col items-center justify-end gap-4 pb-4">
            <img className="size-10" src="/favicon.svg" alt="" />
            <strong className="text-2xl font-black tracking-[-0.04em]">
               Olá, operador!
            </strong>
            <div className="flex h-12 w-full max-w-[480px] items-center gap-2 rounded-xl border-2 border-border bg-background px-4 text-muted-foreground shadow-sm">
               <Search aria-hidden="true" className="size-4" />
               <span>Pergunte à Rubi sobre o seu negócio</span>
            </div>
            <div className="flex w-full max-w-[445px] items-center gap-2 rounded-b-lg border border-t-0 border-border bg-muted/60 px-4 py-2 text-xs text-muted-foreground">
               <kbd className="inline-flex size-4 items-center justify-center rounded border border-border bg-background font-bold text-foreground shadow-xs">
                  /
               </kbd>
               Comandos rápidos
            </div>
            <div className="flex gap-2">
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

         <ul className="flex list-none flex-col items-end gap-4 p-0 text-right">
            <Link
               label="CNPJ e CPF"
               icon={Building2}
               tone="text-primary"
               align="right"
               badge
            />
            <Link
               label="Histórico do cliente"
               icon={ArrowLeftRight}
               tone="text-chart-2"
               align="right"
            />
            <Link
               label="Centros de custo"
               icon={Tags}
               tone="text-chart-3"
               align="right"
            />
            <Link
               label="Contas e cartões"
               icon={CreditCard}
               tone="text-chart-5"
               align="right"
               badge
            />
            <Link
               label="Permissões"
               icon={Shield}
               tone="text-chart-6"
               align="right"
            />
            <Link
               label="Times e organizações"
               icon={Building2}
               tone="text-foreground"
               align="right"
               badge
            />
         </ul>
      </div>
   );
}

function MetricCard({
   icon: Icon,
   tone,
   bar,
   label,
   value,
   delta,
   bars,
}: {
   icon: Icon;
   tone: string;
   bar: string;
   label: string;
   value: string;
   delta: string;
   bars: number[];
}) {
   return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
               <Icon aria-hidden="true" className={`size-4 ${tone}`} />
               {label}
            </div>
            <span
               className={`inline-flex items-center gap-2 text-xs font-bold ${tone}`}
            >
               <ArrowUpRight aria-hidden="true" className="size-3" />
               {delta}
            </span>
         </div>
         <div className="text-2xl font-black tracking-[-0.03em] text-foreground">
            {value}
         </div>
         <div className="flex h-12 items-end gap-2">
            {bars.map((h, i) => (
               <span
                  key={`${label}-${i}`}
                  className={`flex-1 rounded-sm ${bar}`}
                  style={{ height: `${h}%` }}
               />
            ))}
         </div>
      </div>
   );
}

function InsightLayout() {
   return (
      <div className="grid gap-4 pt-4 lg:grid-cols-3">
         <MetricCard
            icon={Repeat}
            tone="text-chart-2"
            bar="bg-chart-2/60"
            label="Receita recorrente"
            value="R$ 184.230"
            delta="+12,4%"
            bars={[40, 55, 50, 65, 70, 78, 90]}
         />
         <MetricCard
            icon={LineChart}
            tone="text-primary"
            bar="bg-primary/60"
            label="Fluxo de caixa"
            value="R$ 56.890"
            delta="+4,1%"
            bars={[30, 45, 38, 55, 48, 62, 70]}
         />
         <MetricCard
            icon={Gauge}
            tone="text-chart-3"
            bar="bg-chart-3/60"
            label="Inadimplência"
            value="2,3%"
            delta="-0,8%"
            bars={[55, 50, 45, 42, 38, 32, 28]}
         />
         <ul className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-2 lg:col-span-3">
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
      <Tabs defaultValue={tabs[0].id} className="gap-0 pt-4">
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
               <div className="relative flex flex-col gap-4">
                  <button
                     className="absolute top-0 right-0 inline-flex size-8 items-center justify-center gap-2 rounded border border-border bg-background/80"
                     type="button"
                     aria-label="Pausar animação"
                  >
                     <span className="h-3 w-1 rounded bg-muted-foreground" />
                     <span className="h-3 w-1 rounded bg-muted-foreground" />
                  </button>

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
