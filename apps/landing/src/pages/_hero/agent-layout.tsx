import { Button } from "@packages/ui/components/button";
import {
   ArrowLeftRight,
   Bot,
   CheckCircle2,
   Command,
   ListChecks,
   Search,
   Shield,
   Sparkles,
   Wand2,
   Workflow,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

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

export function AgentLayout() {
   return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/60 p-4">
         <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
               <span className="flex size-8 items-center justify-center rounded-md bg-chart-6/15">
                  <Bot aria-hidden="true" className="size-4 text-chart-6" />
               </span>
               Montte AI · agente nativo
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
               Montte AI, classifique outubro, encontre duplicatas e dispare
               cobrança dos atrasados.
            </div>
         </div>

         <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-chart-6/40 bg-chart-6/5 px-4 py-2 text-sm text-foreground">
            <span className="flex items-center gap-2 font-bold text-chart-6">
               <Sparkles aria-hidden="true" className="size-3" /> Montte AI
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
