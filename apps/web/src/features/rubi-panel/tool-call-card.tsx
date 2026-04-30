import {
   Check,
   ChevronRight,
   Code2,
   Compass,
   Lightbulb,
   Loader2,
   Sparkles,
   Wrench,
   X,
} from "lucide-react";
import { useState } from "react";
import { AdvisorRenderer } from "./tool-renderers/advisor";
import { LazyDiscoveryRenderer } from "./tool-renderers/lazy";
import {
   BenefitsListRenderer,
   BulkCreatedServicesRenderer,
   BulkSetActiveRenderer,
   CouponsListRenderer,
   CreatedRenderer,
   MetersListRenderer,
   ServiceDetailRenderer,
   ServicesListRenderer,
   SetupServiceRenderer,
} from "./tool-renderers/services";
import { SkillDiscoverRenderer } from "./tool-renderers/skill";

interface ToolCallCardProps {
   toolCall: {
      id: string;
      name: string;
      args: string;
      state?: "streaming" | "complete" | "result";
      result?: string;
   };
}

interface ToolPresentation {
   label: string;
   icon: typeof Wrench;
   tone: "neutral" | "info" | "magic";
}

function presentTool(name: string | undefined): ToolPresentation {
   if (!name) return { label: "ferramenta", icon: Wrench, tone: "neutral" };
   if (name === "advisor_consult")
      return { label: "Consultando advisor", icon: Lightbulb, tone: "magic" };
   if (name === "skill_discover")
      return { label: "Carregando playbook", icon: Sparkles, tone: "info" };
   if (name === "__lazy__tool__discovery__")
      return {
         label: "Descobrindo ferramentas",
         icon: Compass,
         tone: "info",
      };
   const label = name
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase());
   return { label: label || "ferramenta", icon: Wrench, tone: "neutral" };
}

interface ParsedResult {
   ok?: boolean;
   error?: string;
   raw: unknown;
}

function parseResult(raw: string | undefined): ParsedResult | null {
   if (!raw) return null;
   try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
         ok:
            typeof parsed.ok === "boolean" ? (parsed.ok as boolean) : undefined,
         error: typeof parsed.error === "string" ? parsed.error : undefined,
         raw: parsed,
      };
   } catch {
      return { raw };
   }
}

function parsedArgs(raw: string): unknown {
   if (!raw) return null;
   try {
      return JSON.parse(raw);
   } catch {
      return raw;
   }
}

function isObj(v: unknown): v is Record<string, unknown> {
   return typeof v === "object" && v !== null;
}

function dispatchRender(
   name: string,
   data: unknown,
   args: unknown,
): React.ReactNode | null {
   if (!isObj(data)) return null;
   const argsObj = isObj(args) ? args : null;

   if (name === "advisor_consult")
      return <AdvisorRenderer data={data} args={argsObj} />;
   if (name === "skill_discover")
      return <SkillDiscoverRenderer data={data} args={argsObj} />;
   if (name === "__lazy__tool__discovery__")
      return <LazyDiscoveryRenderer data={data} />;

   if (data.ok === false) return null;

   switch (name) {
      case "services_list":
         return (
            <ServicesListRenderer
               data={data as Parameters<typeof ServicesListRenderer>[0]["data"]}
            />
         );
      case "services_get":
         return (
            <ServiceDetailRenderer
               data={
                  data as Parameters<typeof ServiceDetailRenderer>[0]["data"]
               }
            />
         );
      case "meters_list":
         return (
            <MetersListRenderer
               data={data as Parameters<typeof MetersListRenderer>[0]["data"]}
            />
         );
      case "benefits_list":
         return (
            <BenefitsListRenderer
               data={data as Parameters<typeof BenefitsListRenderer>[0]["data"]}
            />
         );
      case "coupons_list":
         return (
            <CouponsListRenderer
               data={data as Parameters<typeof CouponsListRenderer>[0]["data"]}
            />
         );
      case "services_setup":
         return (
            <SetupServiceRenderer
               data={data as Parameters<typeof SetupServiceRenderer>[0]["data"]}
            />
         );
      case "services_create":
         if (isObj(data.service))
            return (
               <CreatedRenderer
                  label="Serviço criado"
                  name={String(data.service.name)}
               />
            );
         return null;
      case "services_update":
         if (isObj(data.service))
            return (
               <CreatedRenderer
                  label="Serviço atualizado"
                  name={String(data.service.name)}
               />
            );
         return null;
      case "services_set_active":
         return (
            <BulkSetActiveRenderer
               data={
                  data as Parameters<typeof BulkSetActiveRenderer>[0]["data"]
               }
            />
         );
      case "services_bulk_create":
         return (
            <BulkCreatedServicesRenderer
               data={
                  data as Parameters<
                     typeof BulkCreatedServicesRenderer
                  >[0]["data"]
               }
            />
         );
      case "services_create_price":
         if (isObj(data.price))
            return (
               <CreatedRenderer
                  label="Preço criado"
                  name={String(data.price.name)}
                  meta={`R$ ${data.price.basePrice}${data.price.interval ? ` / ${data.price.interval}` : ""}`}
               />
            );
         return null;
      case "prices_update":
         if (isObj(data.price))
            return (
               <CreatedRenderer
                  label="Preço atualizado"
                  name={String(data.price.name)}
               />
            );
         return null;
      case "prices_delete":
         return <CreatedRenderer label="Preço removido" name="" />;
      case "services_attach_benefit":
         return <CreatedRenderer label="Benefício anexado" name="" />;
      case "meters_create":
         if (isObj(data.meter))
            return (
               <CreatedRenderer
                  label="Medidor criado"
                  name={String(data.meter.name)}
                  meta={`evento: ${data.meter.eventName}`}
               />
            );
         return null;
      case "meters_update":
         if (isObj(data.meter))
            return (
               <CreatedRenderer
                  label="Medidor atualizado"
                  name={String(data.meter.name)}
               />
            );
         return null;
      case "benefits_create":
         if (isObj(data.benefit))
            return (
               <CreatedRenderer
                  label="Benefício criado"
                  name={String(data.benefit.name)}
                  meta={String(data.benefit.type)}
               />
            );
         return null;
      case "coupons_create":
         if (isObj(data.coupon))
            return (
               <CreatedRenderer
                  label="Cupom criado"
                  name={String(data.coupon.code)}
                  meta={`${data.coupon.scope} · ${data.coupon.type} ${data.coupon.amount}`}
               />
            );
         return null;
      default:
         return null;
   }
}

const TONE_CLASSES: Record<ToolPresentation["tone"], string> = {
   neutral: "border-muted-foreground/20 bg-muted/30",
   info: "border-blue-500/30 bg-blue-500/5",
   magic: "border-purple-500/30 bg-purple-500/5",
};

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
   const [jsonOpen, setJsonOpen] = useState(false);
   const isRunning = toolCall.state === "streaming";
   const isDone = toolCall.state === "result";
   const parsed = isDone ? parseResult(toolCall.result) : null;
   const failed = parsed?.ok === false || Boolean(parsed?.error);
   const presentation = presentTool(toolCall.name);
   const Icon = presentation.icon;
   const args = parsedArgs(toolCall.args);
   const rendered =
      parsed && !parsed.error
         ? dispatchRender(toolCall.name, parsed.raw, args)
         : null;
   const tone = failed ? "neutral" : presentation.tone;

   return (
      <div
         className={`overflow-hidden rounded-lg border text-xs shadow-sm ${TONE_CLASSES[tone]}`}
      >
         <div className="flex items-center gap-2 px-3 py-2">
            <div
               className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
                  failed
                     ? "bg-destructive/15 text-destructive"
                     : isRunning
                       ? "bg-muted text-muted-foreground"
                       : isDone
                         ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                         : "bg-background text-muted-foreground"
               }`}
            >
               {isRunning ? (
                  <Loader2 className="size-3.5 animate-spin" />
               ) : failed ? (
                  <X className="size-3.5" />
               ) : isDone ? (
                  <Check className="size-3.5" />
               ) : (
                  <Icon className="size-3.5" />
               )}
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
               <span className="font-medium leading-none">
                  {presentation.label}
               </span>
               {!isRunning && !failed && isDone ? (
                  <span className="text-[10px] text-muted-foreground">
                     concluído
                  </span>
               ) : isRunning ? (
                  <span className="text-[10px] text-muted-foreground shimmer">
                     executando…
                  </span>
               ) : failed ? (
                  <span className="text-[10px] text-destructive">falhou</span>
               ) : null}
            </div>
            <button
               type="button"
               onClick={() => setJsonOpen((v) => !v)}
               aria-label="Ver JSON"
               className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted/60"
            >
               <Code2 className="size-3" />
               <ChevronRight
                  className={`size-3 transition-transform ${jsonOpen ? "rotate-90" : ""}`}
               />
            </button>
         </div>

         {rendered ? (
            <div className="border-t bg-background/40 px-3 py-2">
               {rendered}
            </div>
         ) : parsed?.error ? (
            <div className="border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
               {parsed.error}
            </div>
         ) : null}

         {jsonOpen ? (
            <div className="grid gap-2 border-t bg-background/40 px-3 py-2">
               <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                     args
                  </span>
                  <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug">
                     {JSON.stringify(args, null, 2)}
                  </pre>
               </div>
               {parsed && parsed.raw !== null ? (
                  <div className="flex flex-col gap-1">
                     <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        result
                     </span>
                     <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug">
                        {JSON.stringify(parsed.raw, null, 2)}
                     </pre>
                  </div>
               ) : null}
            </div>
         ) : null}
      </div>
   );
}
