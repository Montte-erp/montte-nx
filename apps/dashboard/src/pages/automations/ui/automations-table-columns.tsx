import type { RouterOutput } from "@packages/api/client";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { Separator } from "@packages/ui/components/separator";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Activity,
   Calendar,
   CalendarClock,
   CalendarDays,
   CalendarRange,
   ChevronDown,
   Clock,
   Copy,
   ExternalLink,
   Play,
   Trash2,
   Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

type Automation = RouterOutput["automations"]["getAllPaginated"]["rules"][0];

const triggerTypeLabels: Record<string, string> = {
   "transaction.created": "Transação Criada",
   "transaction.updated": "Transação Atualizada",
   "schedule.daily": "Agendamento Diário",
   "schedule.weekly": "Agendamento Semanal",
   "schedule.biweekly": "Agendamento Quinzenal",
   "schedule.custom": "Agendamento Personalizado",
};

const triggerTypeIcons: Record<string, typeof Zap> = {
   "transaction.created": Zap,
   "transaction.updated": Activity,
   "schedule.daily": Calendar,
   "schedule.weekly": CalendarDays,
   "schedule.biweekly": CalendarRange,
   "schedule.custom": CalendarClock,
};

function formatDate(date: Date | string | null): string {
   if (!date) return "-";
   return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "2-digit",
      year: "numeric",
   }).format(new Date(date));
}

function AutomationActionsCell({ automation }: { automation: Automation }) {
   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const deleteMutation = useMutation(
      trpc.automations.delete.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            toast.success("Automação excluída com sucesso");
         },
      }),
   );

   const duplicateMutation = useMutation(
      trpc.automations.duplicate.mutationOptions({
         onError: () => {
            toast.error("Erro ao duplicar automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            toast.success("Automação duplicada com sucesso");
         },
      }),
   );

   const testRunMutation = useMutation(
      trpc.automations.triggerManually.mutationOptions({
         onError: (error) => {
            toast.error(`Erro ao testar automação: ${error.message}`);
         },
         onSuccess: (data) => {
            toast.success(`Automação executada! Job ID: ${data.jobId}`);
         },
      }),
   );

   const handleDelete = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         description:
            "Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: automation.id });
         },
         title: "Excluir automação",
         variant: "destructive",
      });
   };

   const handleDuplicate = () => {
      duplicateMutation.mutate({
         id: automation.id,
         newName: `${automation.name} (cópia)`,
      });
   };

   const handleTestRun = () => {
      if (!automation.enabled) {
         toast.error("Automação desativada. Ative-a primeiro para testar.");
         return;
      }
      testRunMutation.mutate({
         dryRun: false,
         ruleId: automation.id,
      });
   };

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  disabled={!automation.enabled || testRunMutation.isPending}
                  onClick={handleTestRun}
                  size="icon"
                  variant="outline"
               >
                  <Play className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Testar (Dry Run)</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button onClick={handleDuplicate} size="icon" variant="outline">
                  <Copy className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicar</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        automationId: automation.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/automations/$automationId"
                  >
                     <ExternalLink className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Detalhes</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
         </Tooltip>
      </div>
   );
}

function AutomationStatusToggle({ automation }: { automation: Automation }) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const toggleMutation = useMutation(
      trpc.automations.toggle.mutationOptions({
         onError: () => {
            toast.error("Erro ao alterar status da automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
         },
      }),
   );

   return (
      <Switch
         checked={automation.enabled}
         disabled={toggleMutation.isPending}
         onCheckedChange={(checked) => {
            toggleMutation.mutate({
               id: automation.id,
               enabled: checked,
            });
         }}
      />
   );
}

export function createAutomationColumns(): ColumnDef<Automation>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const automation = row.original;
            const TriggerIcon = triggerTypeIcons[automation.triggerType] || Zap;
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                     <TriggerIcon className="size-4" />
                  </div>
                  <div className="flex flex-col">
                     <span className="font-medium">{automation.name}</span>
                     <span className="text-xs text-muted-foreground">
                        {triggerTypeLabels[automation.triggerType]}
                     </span>
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "consequences",
         cell: ({ row }) => {
            const automation = row.original;
            const consequencesCount = automation.consequences?.length || 0;
            return (
               <span className="text-sm text-muted-foreground">
                  {consequencesCount}{" "}
                  {consequencesCount === 1 ? "ação" : "ações"}
               </span>
            );
         },
         header: "Ações",
      },
      {
         accessorKey: "priority",
         cell: ({ row }) => {
            const priority = row.getValue("priority") as number;
            return (
               <Badge className="font-mono" variant="outline">
                  {priority}
               </Badge>
            );
         },
         enableSorting: true,
         header: "Prioridade",
      },
      {
         accessorKey: "enabled",
         cell: ({ row }) => (
            <AutomationStatusToggle automation={row.original} />
         ),
         enableSorting: true,
         header: "Status",
      },
      {
         cell: ({ row }) => <AutomationActionsCell automation={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

interface AutomationExpandedContentProps {
   row: Row<Automation>;
}

export function AutomationExpandedContent({
   row,
}: AutomationExpandedContentProps) {
   const automation = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const isMobile = useIsMobile();
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const deleteMutation = useMutation(
      trpc.automations.delete.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            toast.success("Automação excluída com sucesso");
         },
      }),
   );

   const triggerMutation = useMutation(
      trpc.automations.triggerManually.mutationOptions({
         onError: () => {
            toast.error("Erro ao executar automação");
         },
         onSuccess: () => {
            toast.success("Automação adicionada à fila de execução");
         },
      }),
   );

   const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      openAlertDialog({
         actionLabel: "Excluir",
         description:
            "Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: automation.id });
         },
         title: "Excluir automação",
         variant: "destructive",
      });
   };

   const handleTrigger = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!automation.enabled) {
         toast.error("Não é possível executar uma automação inativa");
         return;
      }
      triggerMutation.mutate({ ruleId: automation.id });
   };

   const TriggerIcon = triggerTypeIcons[automation.triggerType] || Zap;
   const consequencesCount = automation.consequences?.length || 0;
   const conditionsCount = automation.conditions?.conditions?.length || 0;

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <TriggerIcon className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Gatilho</p>
                     <p className="text-sm font-medium">
                        {triggerTypeLabels[automation.triggerType]}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Ações</p>
                     <p className="text-sm font-medium">
                        {consequencesCount}{" "}
                        {consequencesCount === 1 ? "ação" : "ações"}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Criado em</p>
                     <p className="text-sm font-medium">
                        {formatDate(automation.createdAt)}
                     </p>
                  </div>
               </div>
               {automation.description && (
                  <>
                     <Separator />
                     <div>
                        <p className="text-xs text-muted-foreground mb-1">
                           Descrição
                        </p>
                        <p className="text-sm">{automation.description}</p>
                     </div>
                  </>
               )}
            </div>

            <Separator />

            <div className="space-y-2">
               {automation.enabled && (
                  <Button
                     className="w-full justify-start"
                     disabled={triggerMutation.isPending}
                     onClick={handleTrigger}
                     size="sm"
                     variant="outline"
                  >
                     <Play className="size-4" />
                     Executar Manualmente
                  </Button>
               )}
               <Button
                  asChild
                  className="w-full justify-start"
                  size="sm"
                  variant="outline"
               >
                  <Link
                     params={{
                        automationId: automation.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/automations/$automationId"
                  >
                     <ExternalLink className="size-4" />
                     Detalhes
                  </Link>
               </Button>
               <Button
                  className="w-full justify-start"
                  onClick={handleDelete}
                  size="sm"
                  variant="destructive"
               >
                  <Trash2 className="size-4" />
                  Excluir
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <TriggerIcon className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Gatilho</p>
                  <p className="text-sm font-medium">
                     {triggerTypeLabels[automation.triggerType]}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Activity className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Configuração</p>
                  <p className="text-sm font-medium">
                     {conditionsCount}{" "}
                     {conditionsCount === 1 ? "condição" : "condições"},{" "}
                     {consequencesCount}{" "}
                     {consequencesCount === 1 ? "ação" : "ações"}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Clock className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm font-medium">
                     {formatDate(automation.createdAt)}
                  </p>
               </div>
            </div>
            {automation.description && (
               <>
                  <Separator className="h-8" orientation="vertical" />
                  <div className="max-w-xs">
                     <p className="text-xs text-muted-foreground">Descrição</p>
                     <p className="text-sm truncate">
                        {automation.description}
                     </p>
                  </div>
               </>
            )}
         </div>

         <div className="flex items-center gap-2">
            {automation.enabled && (
               <Button
                  disabled={triggerMutation.isPending}
                  onClick={handleTrigger}
                  size="sm"
                  variant="outline"
               >
                  <Play className="size-4" />
                  Executar
               </Button>
            )}
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     automationId: automation.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/automations/$automationId"
               >
                  <ExternalLink className="size-4" />
                  Detalhes
               </Link>
            </Button>
            <Button onClick={handleDelete} size="sm" variant="destructive">
               <Trash2 className="size-4" />
               Excluir
            </Button>
         </div>
      </div>
   );
}

interface AutomationMobileCardProps {
   row: Row<Automation>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function AutomationMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: AutomationMobileCardProps) {
   const automation = row.original;
   const TriggerIcon = triggerTypeIcons[automation.triggerType] || Zap;
   const consequencesCount = automation.consequences?.length || 0;

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                  <TriggerIcon className="size-5" />
               </div>
               <div className="flex-1">
                  <CardTitle className="text-base">{automation.name}</CardTitle>
                  <CardDescription>
                     {triggerTypeLabels[automation.triggerType]}
                  </CardDescription>
               </div>
            </div>
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
               <span className="text-sm text-muted-foreground">
                  {consequencesCount}{" "}
                  {consequencesCount === 1 ? "ação" : "ações"}
               </span>
               <AutomationStatusToggle automation={automation} />
            </div>
            <div className="flex gap-2">
               <Badge variant={automation.enabled ? "default" : "secondary"}>
                  {automation.enabled ? "Ativa" : "Inativa"}
               </Badge>
               <Badge className="font-mono" variant="outline">
                  Prioridade: {automation.priority}
               </Badge>
            </div>
         </CardContent>
         <CardFooter>
            <CollapsibleTrigger asChild>
               <Button
                  className="w-full"
                  onClick={(e) => {
                     e.stopPropagation();
                     toggleExpanded();
                  }}
                  variant="outline"
               >
                  {isExpanded ? "Menos informações" : "Mais informações"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
