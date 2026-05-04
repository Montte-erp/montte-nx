import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import {
   BarChart3,
   ChevronRight,
   CreditCard,
   Database,
   FileSpreadsheet,
   Landmark,
   LineChart,
   Link as LinkIcon,
   Users,
   Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NodeItem = { icon: LucideIcon; label: string };

const sources: NodeItem[] = [
   { icon: Landmark, label: "Banco / OFX" },
   { icon: FileSpreadsheet, label: "Planilhas / CSV" },
   { icon: CreditCard, label: "Cartão de Crédito" },
   { icon: LinkIcon, label: "APIs & Webhooks" },
];

const destinations: NodeItem[] = [
   { icon: Wallet, label: "Finanças" },
   { icon: Users, label: "CRM & Contatos" },
   { icon: LineChart, label: "Serviços & Assinaturas" },
   { icon: BarChart3, label: "Analytics & Relatórios" },
];

const drilldowns = [
   "Contas e transações",
   "Cartões de crédito",
   "Categorias e centros de custo",
];

const tabs = [
   { value: "negocio", label: "Entenda seu negócio" },
   { value: "central", label: "Central de dados em um só lugar" },
   { value: "debug", label: "Debug & resolver problemas" },
   { value: "testar", label: "Testar e lançar mudanças" },
] as const;

export function DataHub() {
   return (
      <div className="w-full max-w-7xl justify-self-center rounded-[2rem] border border-border/60 bg-card p-4 shadow-xl">
         <Tabs defaultValue="central">
            <TabsList className="flex h-auto w-full justify-between gap-4 rounded-none border-b border-border/60 bg-transparent p-0">
               {tabs.map((tab) => (
                  <TabsTrigger
                     key={tab.value}
                     value={tab.value}
                     className="relative h-auto flex-1 rounded-none border-0 bg-transparent px-4 py-4 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary"
                  >
                     {tab.label}
                  </TabsTrigger>
               ))}
            </TabsList>

            <TabsContent value="central" className="pt-4">
               <CentralPanel />
            </TabsContent>
            <TabsContent value="negocio" className="pt-4">
               <PlaceholderPanel title="Entenda seu negócio" />
            </TabsContent>
            <TabsContent value="debug" className="pt-4">
               <PlaceholderPanel title="Debug & resolver problemas" />
            </TabsContent>
            <TabsContent value="testar" className="pt-4">
               <PlaceholderPanel title="Testar e lançar mudanças" />
            </TabsContent>
         </Tabs>
      </div>
   );
}

function CentralPanel() {
   return (
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
               <span className="grid size-4 place-items-center rounded-md bg-primary/10 text-primary">
                  <Database className="size-4" />
               </span>
               <h3 className="text-base font-semibold text-foreground">
                  Centralize. Conecte. Decida melhor.
               </h3>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
               Importe extratos, categorize com IA, acompanhe cartões,
               assinaturas e serviços. Tudo integrado, tudo seu.
            </p>
            <ul className="flex flex-col">
               {drilldowns.map((item) => (
                  <li key={item}>
                     <button
                        type="button"
                        className="group flex w-full items-center justify-between gap-4 border-t border-border/60 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                     >
                        <span>{item}</span>
                        <span className="flex items-center gap-2 text-muted-foreground group-hover:text-primary">
                           <ChevronRight className="size-4" />
                           <ChevronRight className="size-4 text-primary" />
                        </span>
                     </button>
                  </li>
               ))}
            </ul>
         </div>

         <DataDiagram />
      </div>
   );
}

function DataDiagram() {
   return (
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4">
         <svg
            className="pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 600 320"
            preserveAspectRatio="none"
            aria-hidden="true"
         >
            <defs>
               <linearGradient id="hub-line" x1="0" y1="0" x2="1" y2="0">
                  <stop
                     offset="0%"
                     stopColor="var(--primary)"
                     stopOpacity="0.1"
                  />
                  <stop
                     offset="50%"
                     stopColor="var(--primary)"
                     stopOpacity="0.6"
                  />
                  <stop
                     offset="100%"
                     stopColor="var(--primary)"
                     stopOpacity="0.1"
                  />
               </linearGradient>
            </defs>
            {[40, 120, 200, 280].map((y) => (
               <path
                  key={`l-${y}`}
                  d={`M 180 ${y} C 240 ${y}, 260 160, 300 160`}
                  fill="none"
                  stroke="url(#hub-line)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
               />
            ))}
            {[40, 120, 200, 280].map((y) => (
               <path
                  key={`r-${y}`}
                  d={`M 300 160 C 340 160, 360 ${y}, 420 ${y}`}
                  fill="none"
                  stroke="url(#hub-line)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
               />
            ))}
         </svg>

         <ul className="relative z-10 flex flex-col gap-2">
            {sources.map((node) => (
               <NodePill key={node.label} {...node} side="left" />
            ))}
         </ul>

         <div className="relative z-10 grid place-items-center">
            <CenterCube />
         </div>

         <ul className="relative z-10 flex flex-col gap-2">
            {destinations.map((node) => (
               <NodePill key={node.label} {...node} side="right" />
            ))}
         </ul>
      </div>
   );
}

function NodePill({
   icon: Icon,
   label,
   side,
}: NodeItem & { side: "left" | "right" }) {
   return (
      <li
         className={`relative flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm ${
            side === "left" ? "" : "justify-end text-right"
         }`}
      >
         {side === "left" ? (
            <>
               <Icon className="size-4 text-muted-foreground" />
               <span>{label}</span>
               <span className="ml-auto size-2 rounded-full bg-primary/70" />
            </>
         ) : (
            <>
               <span className="mr-auto size-2 rounded-full bg-primary/70" />
               <Icon className="size-4 text-primary" />
               <span>{label}</span>
            </>
         )}
      </li>
   );
}

function CenterCube() {
   return (
      <div className="relative grid size-32 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 via-card to-primary/10 shadow-lg">
         <div className="grid size-20 place-items-center rounded-xl bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary)_60%,white)] text-primary-foreground shadow-md">
            <span className="text-2xl font-bold">M</span>
         </div>
         <span className="absolute -right-2 -top-2 size-4 rounded-full border-4 border-card bg-primary" />
      </div>
   );
}

function PlaceholderPanel({ title }: { title: string }) {
   return (
      <div className="grid min-h-60 place-items-center rounded-2xl bg-secondary/40 p-4 text-sm text-muted-foreground">
         {title} — em breve.
      </div>
   );
}
