import { Badge } from "@packages/ui/components/badge";
import { Separator } from "@packages/ui/components/separator";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { formatDate } from "@packages/utils/date";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { Calendar, Clock, Percent, Star, TrendingUp } from "lucide-react";
import { EntityActions, ViewDetailsButton } from "@/components/entity-actions";
import { ResponsiveEntityExpandedContent } from "@/components/entity-expanded-content";
import { EntityMobileCard } from "@/components/entity-mobile-card";
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
         cell: ({ row }) => {
            const template = row.original;
            const { activeOrganization } = useActiveOrganization();
            return (
               <ViewDetailsButton
                  detailsLink={{
                     params: {
                        interestTemplateId: template.id,
                        slug: activeOrganization.slug,
                     },
                     to: "/$slug/interest-templates/$interestTemplateId",
                  }}
               />
            );
         },
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

   const detailsLink = {
      params: {
         interestTemplateId: template.id,
         slug: activeOrganization.slug,
      },
      to: "/$slug/interest-templates/$interestTemplateId" as const,
   };

   const handleEdit = () => {
      openSheet({
         children: <ManageInterestTemplateForm template={template} />,
      });
   };

   const mobileContent = (
      <div className="space-y-3">
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
         <Separator />
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
                  {formatDate(new Date(template.createdAt), "DD MMM YYYY")}
               </p>
            </div>
         </div>
      </div>
   );

   const desktopContent = (
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
   );

   return (
      <ResponsiveEntityExpandedContent
         desktopActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{
                  delete: "Excluir template",
                  edit: "Editar template",
               }}
               onDelete={deleteInterestTemplate}
               onEdit={handleEdit}
               variant="full"
            />
         }
         desktopContent={desktopContent}
         isMobile={isMobile}
         mobileActions={
            <EntityActions
               detailsLink={detailsLink}
               labels={{
                  delete: "Excluir template",
                  edit: "Editar template",
               }}
               onDelete={deleteInterestTemplate}
               onEdit={handleEdit}
               variant="mobile"
            />
         }
         mobileContent={mobileContent}
      />
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
      <EntityMobileCard
         content={
            template.isDefault ? (
               <Badge variant="secondary">Template Padrão</Badge>
            ) : undefined
         }
         icon={
            <div className="size-10 rounded-sm flex items-center justify-center bg-muted">
               <Percent className="size-4" />
            </div>
         }
         isExpanded={isExpanded}
         subtitle={
            template.monetaryCorrectionIndex !== "none"
               ? template.monetaryCorrectionIndex.toUpperCase()
               : formatDate(new Date(template.createdAt), "DD MMM YYYY")
         }
         title={
            <span className="flex items-center gap-2">
               {template.name}
               {template.isDefault && (
                  <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
               )}
            </span>
         }
         toggleExpanded={toggleExpanded}
      />
   );
}
