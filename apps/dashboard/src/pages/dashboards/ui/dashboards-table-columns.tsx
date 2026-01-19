import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { Separator } from "@packages/ui/components/separator";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ChevronDown, Copy, Eye, Gauge, Pin, Trash2 } from "lucide-react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useDeleteDashboard } from "../features/use-delete-dashboard";
import { useDuplicateDashboard } from "../features/use-duplicate-dashboard";
import type { Dashboard } from "./dashboards-list-page";

function DashboardActionsCell({ dashboard }: { dashboard: Dashboard }) {
   const { activeOrganization } = useActiveOrganization();

   const deleteDashboardMutation = useDeleteDashboard({});
   const duplicateDashboardMutation = useDuplicateDashboard({});

   const handleDelete = () => {
      deleteDashboardMutation.mutate({ id: dashboard.id });
   };

   const handleDuplicate = () => {
      duplicateDashboardMutation.mutate({ id: dashboard.id });
   };

   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        dashboardId: dashboard.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/dashboards/$dashboardId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver dashboard</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  disabled={duplicateDashboardMutation.isPending}
                  onClick={handleDuplicate}
                  size="icon"
                  variant="outline"
               >
                  <Copy className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicar dashboard</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  disabled={deleteDashboardMutation.isPending}
                  onClick={handleDelete}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir dashboard</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createDashboardColumns(_slug: string): ColumnDef<Dashboard>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const dashboard = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-sm flex items-center justify-center bg-primary/10">
                     <Gauge className="size-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="font-medium">{dashboard.name}</span>
                     {dashboard.isPinned && (
                        <Pin className="size-3 text-muted-foreground" />
                     )}
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         cell: ({ row }) => <DashboardActionsCell dashboard={row.original} />,
         header: "",
         id: "actions",
      },
   ];
}

interface DashboardExpandedContentProps {
   row: Row<Dashboard>;
}

export function DashboardExpandedContent({
   row,
}: DashboardExpandedContentProps) {
   const dashboard = row.original;
   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();
   const deleteDashboardMutation = useDeleteDashboard({});
   const duplicateDashboardMutation = useDuplicateDashboard({});

   const handleDelete = () => {
      deleteDashboardMutation.mutate({ id: dashboard.id });
   };

   const handleDuplicate = () => {
      duplicateDashboardMutation.mutate({ id: dashboard.id });
   };

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm">
                     {dashboard.description || "Sem descrição"}
                  </p>
               </div>
               <Separator />
               <div className="flex items-center gap-4">
                  <div>
                     <p className="text-xs text-muted-foreground">Criado em</p>
                     <p className="text-sm">
                        {new Date(dashboard.createdAt).toLocaleDateString(
                           "pt-BR",
                        )}
                     </p>
                  </div>
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Atualizado em
                     </p>
                     <p className="text-sm">
                        {new Date(dashboard.updatedAt).toLocaleDateString(
                           "pt-BR",
                        )}
                     </p>
                  </div>
               </div>
            </div>

            <Separator />

            <div className="space-y-2">
               <Button
                  asChild
                  className="w-full justify-start"
                  size="sm"
                  variant="outline"
               >
                  <Link
                     params={{
                        dashboardId: dashboard.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/dashboards/$dashboardId"
                  >
                     <Eye className="size-4" />
                     Ver dashboard
                  </Link>
               </Button>
               <Button
                  className="w-full justify-start"
                  disabled={duplicateDashboardMutation.isPending}
                  onClick={handleDuplicate}
                  size="sm"
                  variant="outline"
               >
                  <Copy className="size-4" />
                  Duplicar dashboard
               </Button>
               <Button
                  className="w-full justify-start text-destructive hover:text-destructive"
                  disabled={deleteDashboardMutation.isPending}
                  onClick={handleDelete}
                  size="sm"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  Excluir dashboard
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div>
               <p className="text-xs text-muted-foreground">Descrição</p>
               <p className="text-sm max-w-md truncate">
                  {dashboard.description || "Sem descrição"}
               </p>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div>
               <p className="text-xs text-muted-foreground">Criado em</p>
               <p className="text-sm">
                  {new Date(dashboard.createdAt).toLocaleDateString("pt-BR")}
               </p>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div>
               <p className="text-xs text-muted-foreground">Atualizado em</p>
               <p className="text-sm">
                  {new Date(dashboard.updatedAt).toLocaleDateString("pt-BR")}
               </p>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     dashboardId: dashboard.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/dashboards/$dashboardId"
               >
                  <Eye className="size-4" />
                  Ver dashboard
               </Link>
            </Button>
            <Button
               disabled={duplicateDashboardMutation.isPending}
               onClick={handleDuplicate}
               size="sm"
               variant="outline"
            >
               <Copy className="size-4" />
               Duplicar
            </Button>
            <Button
               disabled={deleteDashboardMutation.isPending}
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

interface DashboardMobileCardProps {
   row: Row<Dashboard>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function DashboardMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: DashboardMobileCardProps) {
   const dashboard = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-sm flex items-center justify-center bg-primary/10">
                  <Gauge className="size-5 text-primary" />
               </div>
               <div className="flex-1">
                  <div className="flex items-center gap-2">
                     <CardTitle className="text-base">{dashboard.name}</CardTitle>
                     {dashboard.isPinned && (
                        <Pin className="size-3 text-muted-foreground" />
                     )}
                  </div>
                  {dashboard.description && (
                     <p className="text-sm text-muted-foreground line-clamp-1">
                        {dashboard.description}
                     </p>
                  )}
               </div>
            </div>
         </CardHeader>
         <CardContent />
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
                  {isExpanded ? "Menos info" : "Mais info"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
