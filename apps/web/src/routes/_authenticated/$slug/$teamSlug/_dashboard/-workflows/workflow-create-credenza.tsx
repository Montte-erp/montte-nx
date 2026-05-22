import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { toast } from "@packages/ui/hooks/use-toast";
import { cn } from "@packages/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { closeCredenza } from "@/hooks/use-credenza";
import {
   BadgeDollarSign,
   CalendarRange,
   ChartColumn,
   LineChart,
   Search,
   Tags,
   Workflow,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
   buildWorkflowCron,
   parseWorkflowScheduleFromCron,
   SchedulePicker,
   type WorkflowScheduleDraft,
} from "./schedule-picker";

const TEMPLATE_ICONS: Record<string, typeof Workflow> = {
   "dre-monthly": ChartColumn,
   "cash-flow-weekly": LineChart,
   "cost-centers-monthly": BadgeDollarSign,
   "aging-weekly": CalendarRange,
   "categories-monthly": Tags,
};

type WorkflowTemplate = Outputs["workflows"]["templates"]["list"][number];

export function WorkflowCreateCredenza({
   templates,
}: {
   templates: WorkflowTemplate[];
}) {
   const firstTemplate = templates[0] ?? null;
   const [search, setSearch] = useState("");
   const [selectedTemplateId, setSelectedTemplateId] = useState(
      firstTemplate?.id ?? "",
   );
   const [workflowName, setWorkflowName] = useState(firstTemplate?.name ?? "");
   const [schedule, setSchedule] = useState<WorkflowScheduleDraft>(() =>
      parseWorkflowScheduleFromCron(firstTemplate?.defaultCron ?? "0 9 1 * *"),
   );
   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();

   const createMutation = useMutation(
      orpc.workflows.createFromTemplate.mutationOptions({
         onSuccess: async (workflow) => {
            toast.success("Workflow criado.");
            closeCredenza();
            await navigate({
               to: "/$slug/$teamSlug/workflows/$workflowId",
               params: { slug, teamSlug, workflowId: workflow.id },
            });
         },
         onError: (error) => toast.error(error.message),
      }),
   );

   const selectedTemplate = useMemo(
      () =>
         templates.find((template) => template.id === selectedTemplateId) ??
         firstTemplate,
      [firstTemplate, selectedTemplateId, templates],
   );

   const filteredTemplates = useMemo(() => {
      const query = search.trim().toLowerCase();
      if (!query) return templates;
      return templates.filter((template) =>
         [template.name, template.description].some((value) =>
            value.toLowerCase().includes(query),
         ),
      );
   }, [search, templates]);

   function handleSelectTemplate(template: WorkflowTemplate) {
      setSelectedTemplateId(template.id);
      setWorkflowName(template.name);
      setSchedule(parseWorkflowScheduleFromCron(template.defaultCron));
   }

   function handleCreate() {
      if (!selectedTemplate) return;
      createMutation.mutate({
         templateId: selectedTemplate.id,
         name: workflowName.trim() || selectedTemplate.name,
         schedule: {
            cron: buildWorkflowCron(schedule),
            timezone: "America/Sao_Paulo",
         },
      });
   }

   return (
      <div className="flex max-h-[min(82vh,820px)] min-h-0 flex-col overflow-hidden">
         <CredenzaHeader className="border-b px-4 pt-4 pb-3">
            <div className="flex flex-col gap-1">
               <CredenzaTitle>Criar workflow</CredenzaTitle>
               <CredenzaDescription>
                  Escolha um template pronto, ajuste o nome e defina a agenda.
               </CredenzaDescription>
            </div>
         </CredenzaHeader>

         <CredenzaBody className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="relative shrink-0">
               <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
               <Input
                  className="pl-9"
                  placeholder="Buscar templates"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
               />
            </div>

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
               <ScrollArea className="min-h-0 pr-2">
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                     {filteredTemplates.map((template) => {
                        const Icon = TEMPLATE_ICONS[template.id] ?? Workflow;
                        const isSelected = template.id === selectedTemplate?.id;
                        return (
                           <button
                              aria-pressed={isSelected}
                              className={cn(
                                 "group min-h-[210px] overflow-hidden rounded-lg border bg-card text-left transition-colors hover:border-foreground/25 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60",
                                 isSelected && "border-primary bg-primary/5",
                              )}
                              disabled={createMutation.isPending}
                              key={template.id}
                              onClick={() => handleSelectTemplate(template)}
                              type="button"
                           >
                              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-primary/15 via-muted to-muted/40">
                                 <div className="bg-background/70 text-foreground flex size-14 items-center justify-center rounded-xl border shadow-sm transition-transform group-hover:scale-105">
                                    <Icon className="size-7" />
                                 </div>
                              </div>
                              <div className="flex flex-col gap-3 p-3">
                                 <div className="flex flex-col gap-1">
                                    <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] uppercase">
                                       {template.name}
                                    </span>
                                    <span className="text-muted-foreground line-clamp-2 text-sm">
                                       {template.description}
                                    </span>
                                 </div>
                                 <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">
                                       {template.cadence === "weekly"
                                          ? "Semanal"
                                          : "Mensal"}
                                    </Badge>
                                 </div>
                              </div>
                           </button>
                        );
                     })}
                  </div>
               </ScrollArea>

               <div className="flex min-h-0 flex-col gap-4 rounded-lg border bg-card p-4">
                  <div className="grid gap-1">
                     <h3 className="text-sm font-semibold">
                        Configurar ativação
                     </h3>
                     <p className="text-muted-foreground text-sm">
                        Defina como este workflow será criado no espaço atual.
                     </p>
                  </div>

                  {selectedTemplate ? (
                     <>
                        <div className="grid gap-2">
                           <label
                              className="text-sm font-medium"
                              htmlFor="workflow-name"
                           >
                              Nome
                           </label>
                           <Input
                              disabled={createMutation.isPending}
                              id="workflow-name"
                              value={workflowName}
                              onChange={(event) =>
                                 setWorkflowName(event.target.value)
                              }
                              placeholder={selectedTemplate.name}
                           />
                        </div>
                        <SchedulePicker
                           disabled={createMutation.isPending}
                           value={schedule}
                           onChange={setSchedule}
                        />
                        <Button
                           disabled={createMutation.isPending}
                           onClick={handleCreate}
                           type="button"
                        >
                           Criar workflow
                        </Button>
                     </>
                  ) : (
                     <p className="text-muted-foreground text-sm">
                        Selecione um template para configurar a ativação.
                     </p>
                  )}
               </div>
            </div>
         </CredenzaBody>
      </div>
   );
}
