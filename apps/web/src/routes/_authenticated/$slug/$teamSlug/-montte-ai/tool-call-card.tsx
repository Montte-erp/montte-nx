import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   ChevronRight,
   Compass,
   Lightbulb,
   Loader2,
   Sparkles,
   Wrench,
} from "lucide-react";
import { useState } from "react";
import {
   AdvisorRenderer,
   BenefitsListRenderer,
   BulkCreatedServicesRenderer,
   BulkSetActiveRenderer,
   CouponsListRenderer,
   CreatedRenderer,
   LazyDiscoveryRenderer,
   MetersListRenderer,
   ServiceDetailRenderer,
   ServicesListRenderer,
   SetupServiceRenderer,
   SkillDiscoverRenderer,
} from "./tool-renderers";

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

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
   const [open, setOpen] = useState(false);
   const isRunning = toolCall.state === "streaming";
   const isDone = toolCall.state === "result";
   const parsed = isDone ? parseResult(toolCall.result) : null;
   const failed = parsed?.ok === false || Boolean(parsed?.error);
   const presentation = presentTool(toolCall.name);
   const Icon = presentation.icon;
   const args = parsedArgs(toolCall.args);
   const isSkillDiscover = toolCall.name === "skill_discover";
   const skillName =
      isSkillDiscover &&
      isObj(parsed?.raw) &&
      typeof parsed.raw.name === "string"
         ? parsed.raw.name
         : isSkillDiscover && isObj(args) && typeof args.skillId === "string"
           ? args.skillId
           : null;
   const label =
      isSkillDiscover && isDone && !failed
         ? `Playbook${skillName ? ` de ${skillName}` : ""} carregado`
         : presentation.label;
   const rendered =
      parsed && !parsed.error && !isSkillDiscover
         ? dispatchRender(toolCall.name, parsed.raw, args)
         : null;
   const expandable = isSkillDiscover
      ? false
      : Boolean(rendered) || Boolean(parsed?.error) || isDone;

   return (
      <Collapsible
         className="group/tool text-sm"
         disabled={!expandable}
         onOpenChange={setOpen}
         open={open}
      >
         <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2 text-muted-foreground hover:text-foreground disabled:cursor-default disabled:hover:text-muted-foreground">
            <span
               className={`flex min-w-0 items-center gap-2 ${failed ? "text-destructive" : ""}`}
            >
               {isRunning ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
               ) : (
                  <Icon
                     className={`size-4 shrink-0 ${
                        failed
                           ? "text-destructive"
                           : isDone
                             ? "text-emerald-600 dark:text-emerald-400"
                             : ""
                     }`}
                  />
               )}
               <span className="truncate text-left">{label}</span>
            </span>
            {expandable ? (
               <ChevronRight className="size-4 shrink-0 transition-transform group-data-[state=open]/tool:rotate-90" />
            ) : null}
         </CollapsibleTrigger>
         <CollapsibleContent className="flex flex-col gap-2 py-2">
            {rendered ?? null}
            {parsed?.error ? (
               <div className="text-destructive">{parsed.error}</div>
            ) : null}
            <Section label="args">
               <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug">
                  {JSON.stringify(args, null, 2)}
               </pre>
            </Section>
            {parsed && parsed.raw !== null ? (
               <Section label="result">
                  <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug">
                     {JSON.stringify(parsed.raw, null, 2)}
                  </pre>
               </Section>
            ) : null}
         </CollapsibleContent>
      </Collapsible>
   );
}

function Section({
   label,
   children,
}: {
   label: string;
   children: React.ReactNode;
}) {
   return (
      <div className="flex flex-col gap-1">
         <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
         </span>
         {children}
      </div>
   );
}
