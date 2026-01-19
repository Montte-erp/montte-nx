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
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Calendar,
   ChevronDown,
   Clock,
   Edit,
   Eye,
   Percent,
   Star,
   Trash2,
   TrendingUp,
} from "lucide-react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { ManageInterestTemplateForm } from "../features/manage-interest-template-form";
import { useDeleteInterestTemplate } from "../features/use-delete-interest-template";
import type { InterestTemplate } from "./interest-templates-page";

function getPenaltyTypeLabel(type: string) {
   switch (type) {
      case "percentage":
         return "Percentual";
      case "fixed":
         return "Valor Fixo";
      default:
         return "Nenhuma";
   }
}

function getInterestTypeLabel(type: string) {
   switch (type) {
      case "daily":
         return "Diário";
      case "monthly":
         return "Mensal";
      default:
         return "Nenhum";
   }
}

function InterestTemplateActionsCell({
   template,
}: {
   template: InterestTemplate;
}) {
   const { activeOrganization } = useActiveOrganization();
   const { deleteInterestTemplate } = useDeleteInterestTemplate({ template });
   const { openSheet } = useSheet();
   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        interestTemplateId: template.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/interest-templates/$interestTemplateId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  onClick={() =>
                     openSheet({
                        children: (
                           <ManageInterestTemplateForm template={template} />
                        ),
                     })
                  }
                  size="icon"
                  variant="outline"
               >
                  <Edit className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Editar template</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={deleteInterestTemplate}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir template</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createInterestTemplateColumns(
   _slug: string,
): ColumnDef<InterestTemplate>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const template = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-sm flex items-center justify-center bg-muted">
                     <Percent className="size-4" />
                  </div>
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.isDefault && (
                           <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
                        )}
                     </div>
                     <span className="text-xs text-muted-foreground">
                        {template.monetaryCorrectionIndex !== "none"
                           ? template.monetaryCorrectionIndex.toUpperCase()
                           : "Nenhum"}
                     </span>
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "penaltyType",
         cell: ({ row }) => {
            const template = row.original;
            const hasValue =
               template.penaltyType !== "none" && template.penaltyValue;
            return (
               <span className="text-muted-foreground">
                  {hasValue ? (
                     <>
                        {template.penaltyValue}
                        {template.penaltyType === "percentage" ? "%" : " R$"}
                     </>
                  ) : (
                     "-"
                  )}
               </span>
            );
         },
         enableSorting: false,
         header: "Multa",
      },
      {
         accessorKey: "interestType",
         cell: ({ row }) => {
            const template = row.original;
            const hasValue =
               template.interestType !== "none" && template.interestValue;
            return (
               <span className="text-muted-foreground">
                  {hasValue ? (
                     <>
                        {template.interestValue}%/{" "}
                        {template.interestType === "daily"
                           ? "Diário"
                           : "Mensal"}
                     </>
                  ) : (
                     "-"
                  )}
               </span>
            );
         },
         enableSorting: false,
         header: "Juros",
      },
      {
         accessorKey: "createdAt",
         cell: ({ row }) => {
            const template = row.original;
            return (
               <span className="text-muted-foreground">
                  {formatDate(new Date(template.createdAt), "DD/MM/YYYY")}
               </span>
            );
         },
         enableSorting: true,
         header: "Criado em",
      },
      {
         cell: ({ row }) => (
            <InterestTemplateActionsCell template={row.original} />
         ),
         header: "",
         id: "actions",
      },
   ];
}

interface InterestTemplateExpandedContentProps {
   row: Row<InterestTemplate>;
}

export function InterestTemplateExpandedContent({
   row,
}: InterestTemplateExpandedContentProps) {
   const template = row.original;
   const { activeOrganization } = useActiveOrganization();
   const { deleteInterestTemplate } = useDeleteInterestTemplate({ template });
   const isMobile = useIsMobile();
   const { openSheet } = useSheet();

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex items-center gap-2">
                  <Percent className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Tipo de Multa
                     </p>
                     <p className="text-sm font-medium">
                        {getPenaltyTypeLabel(template.penaltyType)}
                        {template.penaltyValue && ` (${template.penaltyValue})`}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Tipo de Juros
                     </p>
                     <p className="text-sm font-medium">
                        {getInterestTypeLabel(template.interestType)}
                        {template.interestValue &&
                           ` (${template.interestValue}%)`}
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">
                        Período de Carência
                     </p>
                     <p className="text-sm font-medium">
                        {template.gracePeriodDays} dias
                     </p>
                  </div>
               </div>
               <Separator />
               <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Criado em</p>
                     <p className="text-sm font-medium">
                        {formatDate(
                           new Date(template.createdAt),
                           "DD MMM YYYY",
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
                        interestTemplateId: template.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/interest-templates/$interestTemplateId"
                  >
                     <Eye className="size-4" />
                     Ver detalhes
                  </Link>
               </Button>
               <Button
                  className="w-full justify-start"
                  onClick={(e) => {
                     e.stopPropagation();
                     openSheet({
                        children: (
                           <ManageInterestTemplateForm template={template} />
                        ),
                     });
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  Editar template
               </Button>
               <Button
                  className="w-full justify-start"
                  onClick={(e) => {
                     e.stopPropagation();
                     deleteInterestTemplate();
                  }}
                  size="sm"
                  variant="destructive"
               >
                  <Trash2 className="size-4" />
                  Excluir template
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <Percent className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Tipo de Multa</p>
                  <p className="text-sm font-medium">
                     {getPenaltyTypeLabel(template.penaltyType)}
                     {template.penaltyValue && ` (${template.penaltyValue})`}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <TrendingUp className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Tipo de Juros</p>
                  <p className="text-sm font-medium">
                     {getInterestTypeLabel(template.interestType)}
                     {template.interestValue && ` (${template.interestValue}%)`}
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Clock className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">
                     Período de Carência
                  </p>
                  <p className="text-sm font-medium">
                     {template.gracePeriodDays} dias
                  </p>
               </div>
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm font-medium">
                     {formatDate(new Date(template.createdAt), "DD MMM YYYY")}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     interestTemplateId: template.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/interest-templates/$interestTemplateId"
               >
                  <Eye className="size-4" />
                  Ver detalhes
               </Link>
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  openSheet({
                     children: (
                        <ManageInterestTemplateForm template={template} />
                     ),
                  });
               }}
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar template
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  deleteInterestTemplate();
               }}
               size="sm"
               variant="destructive"
            >
               <Trash2 className="size-4" />
               Excluir template
            </Button>
         </div>
      </div>
   );
}

interface InterestTemplateMobileCardProps {
   row: Row<InterestTemplate>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function InterestTemplateMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: InterestTemplateMobileCardProps) {
   const template = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
                  <Percent className="size-4" />
               </div>
               <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                     {template.name}
                     {template.isDefault && (
                        <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
                     )}
                  </CardTitle>
                  <CardDescription>
                     {template.monetaryCorrectionIndex !== "none"
                        ? template.monetaryCorrectionIndex.toUpperCase()
                        : formatDate(
                             new Date(template.createdAt),
                             "DD MMM YYYY",
                          )}
                  </CardDescription>
               </div>
               {template.isDefault && (
                  <Badge variant="secondary">Template Padrão</Badge>
               )}
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
