import { Button } from "@packages/ui/components/button";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
   Activity,
   Calendar,
   CalendarClock,
   CalendarDays,
   CalendarRange,
   Infinity as InfinityIcon,
   Loader2,
   Plus,
   Zap,
} from "lucide-react";
import { toast } from "sonner";
import { UpgradeRequired } from "@/features/billing/ui/upgrade-required";
import { DefaultHeader } from "@/default/default-header";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { useTRPC } from "@/integrations/clients";
import {
   AutomationsListProvider,
   type TriggerTypeFilter,
   useAutomationsList,
} from "@/features/automations/hooks/use-automations-list-context";
import { AutomationsListSection } from "./automations-list-section";

function generateRandomName(): string {
   const adjectives = [
      "Rápida",
      "Inteligente",
      "Automática",
      "Eficiente",
      "Prática",
      "Nova",
      "Simples",
      "Dinâmica",
   ];
   const nouns = ["Regra", "Automação", "Rotina", "Tarefa", "Ação", "Processo"];
   const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
   const noun = nouns[Math.floor(Math.random() * nouns.length)];
   const num = Math.floor(Math.random() * 1000);
   return `${adj} ${noun} ${num}`;
}

function AutomationsPageContent() {
   const { activeOrganization } = useActiveOrganization();
   const { triggerType, setTriggerType } = useAutomationsList();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const trpc = useTRPC();

   const createMutation = useMutation(
      trpc.automations.create.mutationOptions({
         onError: (error) => {
            toast.error(`Erro ao criar automação: ${error.message}`);
         },
         onSuccess: (data) => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            if (data?.id) {
               navigate({
                  params: {
                     automationId: data.id,
                     slug: activeOrganization.slug,
                  },
                  to: "/$slug/automations/$automationId",
               });
            }
         },
      }),
   );

   const handleCreateAutomation = () => {
      createMutation.mutate({
         consequences: [
            {
               payload: {},
               type: "set_category",
            },
         ],
         conditions: {
            id: crypto.randomUUID(),
            operator: "AND",
            conditions: [],
         },
         flowData: {
            edges: [
               {
                  id: `edge-trigger-action`,
                  source: "trigger-default",
                  target: "action-default",
               },
            ],
            nodes: [
               {
                  data: {
                     config: {},
                     label: "Gatilho",
                     triggerType: "transaction.created",
                  },
                  id: "trigger-default",
                  position: { x: 250, y: 0 },
                  type: "trigger",
               },
               {
                  data: {
                     actionType: "set_category",
                     config: {},
                     label: "Definir Categoria",
                  },
                  id: "action-default",
                  position: { x: 250, y: 150 },
                  type: "action",
               },
            ],
         },
         enabled: true,
         name: generateRandomName(),
         priority: 0,
         stopOnMatch: false,
         triggerType: "transaction.created",
      });
   };

   const triggerChips = [
      {
         icon: InfinityIcon,
         label: "Todos",
         value: "" as const,
      },
      {
         icon: Zap,
         label: "Transação Criada",
         value: "transaction.created" as const,
      },
      {
         icon: Activity,
         label: "Transação Atualizada",
         value: "transaction.updated" as const,
      },
      {
         icon: Calendar,
         label: "Diário",
         value: "schedule.daily" as const,
      },
      {
         icon: CalendarDays,
         label: "Semanal",
         value: "schedule.weekly" as const,
      },
      {
         icon: CalendarRange,
         label: "Quinzenal",
         value: "schedule.biweekly" as const,
      },
      {
         icon: CalendarClock,
         label: "Personalizado",
         value: "schedule.custom" as const,
      },
   ];

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  disabled={createMutation.isPending}
                  onClick={handleCreateAutomation}
               >
                  {createMutation.isPending ? (
                     <Loader2 className="size-4 animate-spin" />
                  ) : (
                     <Plus className="size-4" />
                  )}
                  Nova Automação
               </Button>
            }
            description="Crie regras para automatizar ações baseadas em transações e eventos externos."
            title="Automações"
         />

         <ToggleGroup
            className="flex-wrap justify-start"
            onValueChange={(value) =>
               setTriggerType((value || null) as TriggerTypeFilter | null)
            }
            size="sm"
            spacing={2}
            type="single"
            value={triggerType || ""}
            variant="outline"
         >
            {triggerChips.map((chip) => {
               const Icon = chip.icon;
               return (
                  <ToggleGroupItem
                     aria-label={`Toggle ${chip.value || "all"}`}
                     className={cn(
                        "gap-1.5 data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=on]:*:[svg]:stroke-primary",
                        "text-xs px-2 h-7",
                     )}
                     key={chip.value || "all"}
                     value={chip.value}
                  >
                     <Icon className="size-3" />
                     {chip.label}
                  </ToggleGroupItem>
               );
            })}
         </ToggleGroup>

         <AutomationsListSection />
      </main>
   );
}

export function AutomationsPage() {
   const { canAccessAutomations } = usePlanFeatures();

   return (
      <UpgradeRequired
         featureName="Automações"
         hasAccess={canAccessAutomations}
         requiredPlan="erp"
      >
         <AutomationsListProvider>
            <AutomationsPageContent />
         </AutomationsListProvider>
      </UpgradeRequired>
   );
}
