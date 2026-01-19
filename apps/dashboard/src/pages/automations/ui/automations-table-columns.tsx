import type { RouterOutput } from "@packages/api/client";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import { Switch } from "@packages/ui/components/switch";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { getTriggerLabel } from "@packages/workflows/triggers/definitions";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Activity,
   Calendar,
   CalendarClock,
   CalendarDays,
   CalendarRange,
   Clock,
   Copy,
   ExternalLink,
   Play,
   Trash2,
   Zap,
} from "lucide-react";
import { ResponsiveEntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
import { useAutomationActions } from "@/features/automations/hooks/use-automation-actions";
import { useActiveOrganization } from "@/hooks/use-active-organization";

type Automation = RouterOutput["automations"]["getAllPaginated"]["rules"][0];

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

// Keep AutomationActionsCell since it has special actions (test run, duplicate) that differ from standard EntityActions
function AutomationActionsCell({ automation }: { automation: Automation }) {
   const { activeOrganization } = useActiveOrganization();
   const { handleDelete, handleDuplicate, handleTestRun, isTesting } =
      useAutomationActions(automation);

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  disabled={!automation.enabled || isTesting}
                  onClick={() => handleTestRun(false)}
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
   const { handleToggle, isToggling } = useAutomationActions(automation);

   return (
      <Switch
         checked={automation.enabled}
         disabled={isToggling}
         onCheckedChange={handleToggle}
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
                        {getTriggerLabel(automation.triggerType)}
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
   const isMobile = useIsMobile();
   const { handleDelete, handleTrigger, isTesting } =
      useAutomationActions(automation);

   const TriggerIcon = triggerTypeIcons[automation.triggerType] || Zap;
   const consequencesCount = automation.consequences?.length || 0;
   const conditionsCount = automation.conditions?.conditions?.length || 0;

   const mobileContent = (
      <div className="space-y-3">
         <div className="flex items-center gap-2">
            <TriggerIcon className="size-4 text-muted-foreground" />
            <div>
               <p className="text-xs text-muted-foreground">Gatilho</p>
               <p className="text-sm font-medium">
                  {getTriggerLabel(automation.triggerType)}
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
   );

   const desktopContent = (
      <div className="flex items-center gap-6">
         <div className="flex items-center gap-2">
            <TriggerIcon className="size-4 text-muted-foreground" />
            <div>
               <p className="text-xs text-muted-foreground">Gatilho</p>
               <p className="text-sm font-medium">
                  {getTriggerLabel(automation.triggerType)}
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
                  <p className="text-sm truncate">{automation.description}</p>
               </div>
            </>
         )}
      </div>
   );

   // Custom actions for automations (Execute, Details, Delete)
   const mobileActions = (
      <div className="space-y-2">
         {automation.enabled && (
            <Button
               className="w-full justify-start"
               disabled={isTesting}
               onClick={(e) => {
                  e.stopPropagation();
                  handleTrigger();
               }}
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
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={(e) => {
               e.stopPropagation();
               handleDelete();
            }}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );

   const desktopActions = (
      <div className="flex items-center gap-2">
         {automation.enabled && (
            <Button
               disabled={isTesting}
               onClick={(e) => {
                  e.stopPropagation();
                  handleTrigger();
               }}
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
         <Button
            onClick={(e) => {
               e.stopPropagation();
               handleDelete();
            }}
            size="sm"
            variant="destructive"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>
      </div>
   );

   return (
      <ResponsiveEntityExpandedContent
         desktopActions={desktopActions}
         desktopContent={desktopContent}
         isMobile={isMobile}
         mobileActions={mobileActions}
         mobileContent={mobileContent}
      />
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
      <EntityMobileCard
         content={
            <>
               <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                     {consequencesCount}{" "}
                     {consequencesCount === 1 ? "ação" : "ações"}
                  </span>
                  <AutomationStatusToggle automation={automation} />
               </div>
               <div className="flex gap-2 mt-3">
                  <Badge variant={automation.enabled ? "default" : "secondary"}>
                     {automation.enabled ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge className="font-mono" variant="outline">
                     Prioridade: {automation.priority}
                  </Badge>
               </div>
            </>
         }
         icon={
            <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
               <TriggerIcon className="size-5" />
            </div>
         }
         isExpanded={isExpanded}
         subtitle={getTriggerLabel(automation.triggerType)}
         title={automation.name}
         toggleExpanded={toggleExpanded}
      />
   );
}
