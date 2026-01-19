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
import { cn } from "@packages/ui/lib/utils";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Building2,
   Calendar,
   CheckCircle2,
   ChevronDown,
   Copy,
   Edit,
   Eye,
   Mail,
   Phone,
   Trash2,
   User,
   Users,
   XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import type { Counterparty } from "@/pages/counterparties/ui/counterparties-page";
import { ManageCounterpartyForm } from "../features/manage-counterparty-form";
import { useDeleteCounterparty } from "../features/use-delete-counterparty";

function getTypeIcon(type: string) {
   switch (type) {
      case "client":
         return <User className="size-4" />;
      case "supplier":
         return <Building2 className="size-4" />;
      case "both":
         return <Users className="size-4" />;
      default:
         return <User className="size-4" />;
   }
}

function getTypeColor(type: string): string {
   switch (type) {
      case "client":
         return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "supplier":
         return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "both":
         return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
         return "";
   }
}

function getTypeLabel(type: string): string {
   switch (type) {
      case "client":
         return "Cliente";
      case "supplier":
         return "Fornecedor";
      case "both":
         return "Ambos";
      default:
         return type;
   }
}

function copyToClipboard(text: string) {
   navigator.clipboard.writeText(text);
   toast.success("Copiado para a área de transferência");
}

function CounterpartyActionsCell({
   counterparty,
}: {
   counterparty: Counterparty;
}) {
   const { activeOrganization } = useActiveOrganization();
   const { deleteCounterparty } = useDeleteCounterparty({ counterparty });
   const { openSheet } = useSheet();
   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        counterpartyId: counterparty.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/counterparties/$counterpartyId"
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
                           <ManageCounterpartyForm
                              counterparty={counterparty}
                           />
                        ),
                     })
                  }
                  size="icon"
                  variant="outline"
               >
                  <Edit className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Editar cadastro</TooltipContent>
         </Tooltip>
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={deleteCounterparty}
                  size="icon"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir cadastro</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createCounterpartyColumns(
   _slug: string,
): ColumnDef<Counterparty>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const counterparty = row.original;
            return (
               <div className="flex items-center gap-3">
                  <div
                     className={cn(
                        "size-8 rounded-sm flex items-center justify-center border",
                        getTypeColor(counterparty.type),
                     )}
                  >
                     {getTypeIcon(counterparty.type)}
                  </div>
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2">
                        <span className="font-medium">{counterparty.name}</span>
                        {!counterparty.isActive && (
                           <Badge
                              className="text-[10px] px-1.5 py-0"
                              variant="secondary"
                           >
                              Inativo
                           </Badge>
                        )}
                     </div>
                     {counterparty.tradeName && (
                        <span className="text-xs text-muted-foreground">
                           {counterparty.tradeName}
                        </span>
                     )}
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Nome",
      },
      {
         accessorKey: "document",
         cell: ({ row }) => {
            const counterparty = row.original;
            if (!counterparty.document) {
               return <span className="text-muted-foreground text-sm">-</span>;
            }
            return (
               <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm">
                     {counterparty.document}
                  </span>
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Button
                           className="size-6"
                           onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(counterparty.document ?? "");
                           }}
                           size="icon"
                           variant="ghost"
                        >
                           <Copy className="size-3" />
                        </Button>
                     </TooltipTrigger>
                     <TooltipContent>Copiar documento</TooltipContent>
                  </Tooltip>
               </div>
            );
         },
         header: "Documento",
      },
      {
         accessorKey: "type",
         cell: ({ row }) => {
            const counterparty = row.original;
            return (
               <Badge
                  className={cn(
                     "gap-1 border",
                     getTypeColor(counterparty.type),
                  )}
                  variant="outline"
               >
                  {getTypeIcon(counterparty.type)}
                  {getTypeLabel(counterparty.type)}
               </Badge>
            );
         },
         enableSorting: true,
         header: "Tipo",
      },
      {
         accessorKey: "isActive",
         cell: ({ row }) => {
            const counterparty = row.original;
            return counterparty.isActive ? (
               <Badge
                  className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  variant="outline"
               >
                  <CheckCircle2 className="size-3" />
                  Ativo
               </Badge>
            ) : (
               <Badge
                  className="gap-1 bg-muted text-muted-foreground"
                  variant="outline"
               >
                  <XCircle className="size-3" />
                  Inativo
               </Badge>
            );
         },
         header: "Status",
      },
      {
         accessorKey: "createdAt",
         cell: ({ row }) => {
            const counterparty = row.original;
            return (
               <span className="text-muted-foreground text-sm">
                  {formatDate(new Date(counterparty.createdAt), "DD/MM/YYYY")}
               </span>
            );
         },
         enableSorting: true,
         header: "Criado em",
      },
      {
         cell: ({ row }) => (
            <CounterpartyActionsCell counterparty={row.original} />
         ),
         header: "",
         id: "actions",
      },
   ];
}

interface CounterpartyExpandedContentProps {
   row: Row<Counterparty>;
}

export function CounterpartyExpandedContent({
   row,
}: CounterpartyExpandedContentProps) {
   const counterparty = row.original;
   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();
   const { deleteCounterparty } = useDeleteCounterparty({ counterparty });
   const { openSheet } = useSheet();
   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               {counterparty.email && (
                  <>
                     <div className="flex items-center gap-2">
                        <Mail className="size-4 text-muted-foreground" />
                        <div>
                           <p className="text-xs text-muted-foreground">
                              E-mail
                           </p>
                           <p className="text-sm font-medium">
                              {counterparty.email}
                           </p>
                        </div>
                     </div>
                     <Separator />
                  </>
               )}
               {counterparty.phone && (
                  <>
                     <div className="flex items-center gap-2">
                        <Phone className="size-4 text-muted-foreground" />
                        <div>
                           <p className="text-xs text-muted-foreground">
                              Telefone
                           </p>
                           <p className="text-sm font-medium">
                              {counterparty.phone}
                           </p>
                        </div>
                     </div>
                     <Separator />
                  </>
               )}
               {counterparty.document && (
                  <>
                     <div className="flex items-center gap-2">
                        <User className="size-4 text-muted-foreground" />
                        <div>
                           <p className="text-xs text-muted-foreground">
                              Documento
                           </p>
                           <p className="text-sm font-medium">
                              {counterparty.document}
                           </p>
                        </div>
                     </div>
                     <Separator />
                  </>
               )}
               <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <div>
                     <p className="text-xs text-muted-foreground">Criado em</p>
                     <p className="text-sm font-medium">
                        {formatDate(
                           new Date(counterparty.createdAt),
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
                        counterpartyId: counterparty.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/counterparties/$counterpartyId"
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
                           <ManageCounterpartyForm
                              counterparty={counterparty}
                           />
                        ),
                     });
                  }}
                  size="sm"
                  variant="outline"
               >
                  <Edit className="size-4" />
                  Editar cadastro
               </Button>
               <Button
                  className="w-full justify-start"
                  onClick={(e) => {
                     e.stopPropagation();
                     deleteCounterparty();
                  }}
                  size="sm"
                  variant="destructive"
               >
                  <Trash2 className="size-4" />
                  Excluir cadastro
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 flex items-center justify-between gap-6">
         <div className="flex items-center gap-6">
            {counterparty.email && (
               <>
                  <div className="flex items-center gap-2">
                     <Mail className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">E-mail</p>
                        <p className="text-sm font-medium">
                           {counterparty.email}
                        </p>
                     </div>
                  </div>
                  <Separator className="h-8" orientation="vertical" />
               </>
            )}
            {counterparty.phone && (
               <>
                  <div className="flex items-center gap-2">
                     <Phone className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Telefone
                        </p>
                        <p className="text-sm font-medium">
                           {counterparty.phone}
                        </p>
                     </div>
                  </div>
                  <Separator className="h-8" orientation="vertical" />
               </>
            )}
            {counterparty.document && (
               <>
                  <div className="flex items-center gap-2">
                     <User className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Documento
                        </p>
                        <p className="text-sm font-medium">
                           {counterparty.document}
                        </p>
                     </div>
                  </div>
                  <Separator className="h-8" orientation="vertical" />
               </>
            )}
            <div className="flex items-center gap-2">
               <Calendar className="size-4 text-muted-foreground" />
               <div>
                  <p className="text-xs text-muted-foreground">Criado em</p>
                  <p className="text-sm font-medium">
                     {formatDate(
                        new Date(counterparty.createdAt),
                        "DD MMM YYYY",
                     )}
                  </p>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
               <Link
                  params={{
                     counterpartyId: counterparty.id,
                     slug: activeOrganization.slug,
                  }}
                  to="/$slug/counterparties/$counterpartyId"
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
                        <ManageCounterpartyForm counterparty={counterparty} />
                     ),
                  });
               }}
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar cadastro
            </Button>
            <Button
               onClick={(e) => {
                  e.stopPropagation();
                  deleteCounterparty();
               }}
               size="sm"
               variant="destructive"
            >
               <Trash2 className="size-4" />
               Excluir cadastro
            </Button>
         </div>
      </div>
   );
}

interface CounterpartyMobileCardProps {
   row: Row<Counterparty>;
   isExpanded: boolean;
   toggleExpanded: () => void;
}

export function CounterpartyMobileCard({
   row,
   isExpanded,
   toggleExpanded,
}: CounterpartyMobileCardProps) {
   const counterparty = row.original;

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <div className="flex items-center gap-3">
               <div
                  className={cn(
                     "size-10 rounded-sm flex items-center justify-center border",
                     getTypeColor(counterparty.type),
                  )}
               >
                  {getTypeIcon(counterparty.type)}
               </div>
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                     <CardTitle className="text-base truncate">
                        {counterparty.name}
                     </CardTitle>
                     {!counterparty.isActive && (
                        <Badge
                           className="shrink-0 text-[10px] px-1.5 py-0"
                           variant="secondary"
                        >
                           Inativo
                        </Badge>
                     )}
                  </div>
                  <CardDescription className="truncate">
                     {counterparty.document ||
                        counterparty.email ||
                        formatDate(
                           new Date(counterparty.createdAt),
                           "DD MMM YYYY",
                        )}
                  </CardDescription>
               </div>
               <Badge
                  className={cn(
                     "shrink-0 gap-1 border",
                     getTypeColor(counterparty.type),
                  )}
                  variant="outline"
               >
                  {getTypeIcon(counterparty.type)}
                  {getTypeLabel(counterparty.type)}
               </Badge>
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
                  {isExpanded ? "Menos detalhes" : "Mais detalhes"}
                  <ChevronDown
                     className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                  />
               </Button>
            </CollapsibleTrigger>
         </CardFooter>
      </Card>
   );
}
