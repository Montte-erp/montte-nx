import { Badge } from "@packages/ui/components/badge";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { toast } from "@packages/ui/hooks/use-toast";
import { cn } from "@packages/ui/lib/utils";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { Result } from "better-result";
import { closeCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import type { Outputs } from "@/integrations/orpc/client";
import {
   createWorkflowFromTemplateAction,
   type WorkflowsCollection,
} from "@/integrations/tanstack-db/workflows";

type WorkflowTemplate = Outputs["workflows"]["templates"]["list"][number];

type DomainFilterId = "all" | "reports";

const DOMAIN_FILTER_OPTIONS: { id: DomainFilterId; label: string }[] = [
   { id: "all", label: "Todos os domínios" },
   { id: "reports", label: "Relatórios" },
];

const ILLUSTRATIONS_BASE_PATH = "/workflow-templates";

function cadenceLabel(cadence: WorkflowTemplate["cadence"]) {
   return cadence === "weekly" ? "Semanal" : "Mensal";
}

function getErrorMessage(error: unknown, fallback: string) {
   return error instanceof Error ? error.message : fallback;
}

export function WorkflowCreateCredenza({
   collection,
   templates,
}: {
   collection: WorkflowsCollection;
   templates: WorkflowTemplate[];
}) {
   const [searchInput, setSearchInput] = useState("");
   const [search, setSearch] = useState("");
   const [domainFilter, setDomainFilter] = useState<DomainFilterId>("all");
   const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(
      null,
   );

   const commitSearch = useDebouncedCallback(
      (next: string) => setSearch(next),
      { wait: 200 },
   );

   function handleSearchChange(next: string) {
      setSearchInput(next);
      commitSearch(next);
   }

   function handleDomainFilterChange(value: string) {
      if (value !== "all" && value !== "reports") {
         return;
      }
      setDomainFilter(value);
   }

   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();

   const filteredTemplates = useMemo(() => {
      const query = search.trim().toLowerCase();
      return templates.filter((template) => {
         if (template.category === "blank") return false;
         if (domainFilter !== "all" && template.category !== domainFilter)
            return false;
         if (!query) return true;
         return [template.name, template.description].some((value) =>
            value.toLowerCase().includes(query),
         );
      });
   }, [domainFilter, search, templates]);

   const showEmptyCard = domainFilter === "all" && !search.trim();
   const isPending = pendingTemplateId !== null;

   async function createFromTemplate(template: WorkflowTemplate | null) {
      if (isPending) return;
      setPendingTemplateId(template?.id ?? "blank");
      const create = createWorkflowFromTemplateAction(collection);
      const transaction = create(
         template
            ? {
                 templateId: template.id,
                 name: template.name,
                 schedule: {
                    cron: template.defaultCron,
                    timezone: "America/Sao_Paulo",
                 },
              }
            : { templateId: "blank" },
      );
      const result = await Result.tryPromise({
         try: () => transaction.isPersisted.promise,
         catch: (error) => error,
      });
      if (Result.isError(result)) {
         setPendingTemplateId(null);
         toast.error(getErrorMessage(result.error, "Erro ao criar workflow."));
         return;
      }
      toast.success("Workflow criado.");
      closeCredenza();
      await navigate({
         to: "/$slug/$teamSlug/workflows/$workflowId",
         params: { slug, teamSlug, workflowId: result.value.id },
      });
   }

   function handleSelect(template: WorkflowTemplate) {
      void createFromTemplate(template);
   }

   function handleSelectBlank() {
      void createFromTemplate(null);
   }

   return (
      <>
         <CredenzaHeader className="shrink-0 border-b px-4 py-4">
            <div className="flex flex-col gap-1">
               <CredenzaTitle>Criar workflow</CredenzaTitle>
               <CredenzaDescription>
                  Escolha um template ou comece do zero.
               </CredenzaDescription>
            </div>
         </CredenzaHeader>

         <CredenzaBody className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden overflow-y-hidden px-4 pt-2 pb-4">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
               <SearchInput
                  className="min-w-0 flex-1"
                  placeholder="Filtrar templates"
                  value={searchInput}
                  onChange={(event) => handleSearchChange(event.target.value)}
               />
               <Select
                  value={domainFilter}
                  onValueChange={handleDomainFilterChange}
               >
                  <SelectTrigger className="w-[200px]">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     {DOMAIN_FILTER_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                           {option.label}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            <ScrollArea className="min-h-0 flex-1">
               <div className="grid grid-cols-1 gap-4 pb-4 pr-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {showEmptyCard ? (
                     <EmptyWorkflowCard
                        disabled={isPending}
                        isLoading={pendingTemplateId === "blank"}
                        onSelect={handleSelectBlank}
                     />
                  ) : null}
                  {filteredTemplates.map((template) => (
                     <TemplateCard
                        key={template.id}
                        template={template}
                        disabled={isPending}
                        isLoading={pendingTemplateId === template.id}
                        onSelect={handleSelect}
                     />
                  ))}
               </div>
               {filteredTemplates.length === 0 && !showEmptyCard ? (
                  <div className="text-muted-foreground py-4 text-center text-sm">
                     Nenhum template encontrado.
                  </div>
               ) : null}
            </ScrollArea>
         </CredenzaBody>
      </>
   );
}

function TemplateCard({
   template,
   disabled,
   isLoading,
   onSelect,
}: {
   template: WorkflowTemplate;
   disabled: boolean;
   isLoading: boolean;
   onSelect: (template: WorkflowTemplate) => void;
}) {
   const [imageFailed, setImageFailed] = useState(false);

   return (
      <button
         className={cn(
            "group bg-card relative flex flex-col overflow-hidden rounded-lg border text-left transition-all",
            "hover:border-foreground/30 hover:shadow-md",
            "disabled:cursor-not-allowed disabled:opacity-60",
         )}
         disabled={disabled}
         onClick={() => onSelect(template)}
         type="button"
      >
         <div className="relative aspect-[4/3] w-full overflow-hidden">
            {imageFailed ? (
               <div className="from-primary/25 via-muted to-muted/40 flex size-full items-center justify-center bg-gradient-to-br">
                  <div className="bg-background/70 text-foreground flex size-14 items-center justify-center rounded-xl border shadow-sm transition-transform group-hover:scale-105">
                     <Workflow className="size-7" />
                  </div>
               </div>
            ) : (
               <img
                  alt={template.name}
                  className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                  src={`${ILLUSTRATIONS_BASE_PATH}/${template.id}.png`}
               />
            )}
            {isLoading ? (
               <div className="bg-background/70 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="size-6 animate-spin" />
               </div>
            ) : null}
         </div>
         <div className="flex flex-col gap-2 p-4">
            <span className="text-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
               {template.name}
            </span>
            <div className="flex flex-wrap gap-1">
               <Badge variant="secondary">oficial</Badge>
               <Badge variant="secondary">
                  {cadenceLabel(template.cadence)}
               </Badge>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-sm">
               {template.description}
            </p>
         </div>
      </button>
   );
}

function EmptyWorkflowCard({
   disabled,
   isLoading,
   onSelect,
}: {
   disabled: boolean;
   isLoading: boolean;
   onSelect: () => void;
}) {
   return (
      <button
         className={cn(
            "group bg-card relative flex flex-col overflow-hidden rounded-lg border text-left transition-all",
            "hover:border-foreground/30 hover:shadow-md",
            "disabled:cursor-not-allowed disabled:opacity-60",
         )}
         disabled={disabled}
         onClick={onSelect}
         type="button"
      >
         <div className="from-primary/30 via-primary/15 to-primary/5 relative flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br">
            <Plus className="text-foreground/60 size-12" />
            {isLoading ? (
               <div className="bg-background/70 absolute inset-0 flex items-center justify-center backdrop-blur-sm">
                  <Loader2 className="size-6 animate-spin" />
               </div>
            ) : null}
         </div>
         <div className="flex flex-col gap-2 p-4">
            <span className="text-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
               Workflow vazio
            </span>
            <div className="flex flex-wrap gap-1">
               <Badge variant="outline">rascunho</Badge>
            </div>
            <p className="text-muted-foreground line-clamp-2 text-sm">
               Comece do zero, sem template, montando o fluxo na tela do
               workflow.
            </p>
         </div>
      </button>
   );
}
