import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
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
import {
   getRecurrenceLabel,
   type RecurrencePattern,
} from "@packages/utils/recurrence";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import {
   Building,
   Calendar,
   CalendarDays,
   ChevronDown,
   Eye,
   FileText,
   User,
} from "lucide-react";
import { AmountAnnouncement } from "@/features/transaction/ui/amount-announcement";
import { CategoryAnnouncement } from "@/features/transaction/ui/category-announcement";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import type { Category } from "@/pages/categories/ui/categories-page";
import { getBillStatus } from "../lib/bill-status";
import { BillActions } from "./bill-actions";
import { StatusAnnouncement } from "./status-announcement";
import { TypeAnnouncement } from "./type-announcement";

type Bill = BillWithRelations;

function BillActionsCell({ bill }: { bill: Bill }) {
   const { activeOrganization } = useActiveOrganization();

   return (
      <div className="flex justify-end">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        billId: bill.id,
                        slug: activeOrganization.slug,
                     }}
                     to="/$slug/bills/$billId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver Detalhes</TooltipContent>
         </Tooltip>
      </div>
   );
}

export function createBillColumns(categories: Category[]): ColumnDef<Bill>[] {
   return [
      {
         accessorKey: "description",
         cell: ({ row }) => {
            const bill = row.original;

            return (
               <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                     <span className="font-medium">{bill.description}</span>
                     {bill.isRecurring && bill.recurrencePattern && (
                        <Badge
                           className="text-[10px] h-5 px-1"
                           variant="outline"
                        >
                           <CalendarDays className="size-3 mr-1" />
                           {getRecurrenceLabel(
                              bill.recurrencePattern as RecurrencePattern,
                           )}
                        </Badge>
                     )}
                  </div>
               </div>
            );
         },
         enableSorting: true,
         header: "Descrição",
      },
      {
         id: "category",
         cell: ({ row }) => {
            const bill = row.original;
            const categoryDetails = categories.find(
               (cat) => cat.id === bill.categoryId,
            );

            return (
               <CategoryAnnouncement
                  category={{
                     color: categoryDetails?.color || "#6b7280",
                     icon: categoryDetails?.icon || "Wallet",
                     name: categoryDetails?.name || "Sem categoria",
                  }}
               />
            );
         },
         enableSorting: false,
         header: "Categoria",
      },
      {
         accessorKey: "dueDate",
         cell: ({ row }) => {
            const date = new Date(row.getValue("dueDate"));
            return formatDate(date, "DD/MM/YYYY");
         },
         enableSorting: true,
         header: "Vencimento",
      },
      {
         accessorKey: "status",
         cell: ({ row }) => {
            const bill = row.original;
            const status = getBillStatus(bill);

            return <StatusAnnouncement status={status} />;
         },
         header: "Status",
      },

      {
         accessorKey: "amount",
         cell: ({ row }) => {
            const bill = row.original;
            const amount = Number.parseFloat(bill.amount);
            const isPositive = bill.type === "income";

            return (
               <AmountAnnouncement amount={amount} isPositive={isPositive} />
            );
         },
         enableSorting: true,
         header: "Valor",
      },
      {
         cell: ({ row }) => {
            return <BillActionsCell bill={row.original} />;
         },
         header: "",
         id: "actions",
      },
   ];
}

interface BillMobileCardProps {
   row: Row<Bill>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   categories: Category[];
}

export function BillMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   categories,
}: BillMobileCardProps) {
   const bill = row.original;
   const category = categories.find((c) => c.id === bill.categoryId);
   const status = getBillStatus(bill);

   return (
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
         <CardHeader>
            <CardDescription>
               <CategoryAnnouncement
                  category={{
                     color: category?.color || "#6b7280",
                     icon: category?.icon || "Wallet",
                     name: category?.name || "Sem categoria",
                  }}
               />
            </CardDescription>
            <CardTitle className="truncate">{bill.description}</CardTitle>
            <CardDescription>
               Vencimento: {formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
            </CardDescription>
         </CardHeader>
         <CardContent className="flex flex-wrap gap-2">
            <StatusAnnouncement status={status} />
            <AmountAnnouncement
               amount={Number(bill.amount)}
               isPositive={bill.type === "income"}
            />
            {bill.isRecurring && bill.recurrencePattern && (
               <Badge variant="outline">
                  <CalendarDays className="size-3 mr-1" />
                  {getRecurrenceLabel(
                     bill.recurrencePattern as RecurrencePattern,
                  )}
               </Badge>
            )}
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

interface BillExpandedContentProps {
   row: Row<Bill>;
   categories: Category[];
}

export function BillExpandedContent({
   row,
   categories,
}: BillExpandedContentProps) {
   const bill = row.original;
   const category = categories.find((c) => c.id === bill.categoryId);
   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();

   const InfoItem = ({
      icon: Icon,
      label,
      value,
   }: {
      icon: React.ElementType;
      label: string;
      value: React.ReactNode;
   }) => (
      <div className="flex items-center gap-2">
         <Icon className="size-4 text-muted-foreground" />
         <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
         </div>
      </div>
   );

   if (isMobile) {
      return (
         <div className="p-4 space-y-4">
            <div className="space-y-3">
               <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <AmountAnnouncement
                     amount={Number(bill.amount)}
                     isPositive={bill.type === "income"}
                  />
               </div>
               <Separator />
               <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <TypeAnnouncement type={bill.type as "expense" | "income"} />
               </div>
               <Separator />
               <InfoItem
                  icon={Calendar}
                  label="Vencimento"
                  value={formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
               />
               {bill.issueDate && (
                  <>
                     <Separator />
                     <InfoItem
                        icon={FileText}
                        label="Data de Emissão"
                        value={formatDate(
                           new Date(bill.issueDate),
                           "DD/MM/YYYY",
                        )}
                     />
                  </>
               )}
               <Separator />
               <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <CategoryAnnouncement
                     category={{
                        color: category?.color || "#6b7280",
                        icon: category?.icon || "Wallet",
                        name: category?.name || "Sem categoria",
                     }}
                  />
               </div>
               {bill.isRecurring && bill.recurrencePattern && (
                  <>
                     <Separator />
                     <InfoItem
                        icon={CalendarDays}
                        label="Recorrência"
                        value={getRecurrenceLabel(
                           bill.recurrencePattern as RecurrencePattern,
                        )}
                     />
                  </>
               )}
               {bill.bankAccount && (
                  <>
                     <Separator />
                     <InfoItem
                        icon={Building}
                        label="Conta Bancária (Opcional)"
                        value={bill.bankAccount.name}
                     />
                  </>
               )}
               {bill.counterparty && (
                  <>
                     <Separator />
                     <InfoItem
                        icon={User}
                        label="Fornecedor/Cliente"
                        value={bill.counterparty?.name}
                     />
                  </>
               )}
               {bill.notes && (
                  <>
                     <Separator />
                     <InfoItem
                        icon={FileText}
                        label="Observações"
                        value={
                           <span className="truncate max-w-[200px]">
                              {bill.notes}
                           </span>
                        }
                     />
                  </>
               )}
            </div>

            {/* Actions Section - Below metadata with separator */}
            <div className="pt-2 border-t">
               <BillActions
                  bill={bill}
                  showViewDetails
                  slug={activeOrganization.slug}
                  variant="compact"
               />
            </div>
         </div>
      );
   }

   return (
      <div className="p-4 space-y-4">
         {/* Metadata Section */}
         <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col gap-1">
               <p className="text-xs text-muted-foreground">Valor</p>
               <AmountAnnouncement
                  amount={Number(bill.amount)}
                  isPositive={bill.type === "income"}
               />
            </div>
            <Separator className="h-8" orientation="vertical" />
            <div className="flex flex-col gap-1">
               <p className="text-xs text-muted-foreground">Tipo</p>
               <TypeAnnouncement type={bill.type as "expense" | "income"} />
            </div>
            <Separator className="h-8" orientation="vertical" />
            <InfoItem
               icon={Calendar}
               label="Vencimento"
               value={formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
            />
            {bill.issueDate && (
               <>
                  <Separator className="h-8" orientation="vertical" />
                  <InfoItem
                     icon={FileText}
                     label="Data de Emissão"
                     value={formatDate(new Date(bill.issueDate), "DD/MM/YYYY")}
                  />
               </>
            )}
            <Separator className="h-8" orientation="vertical" />
            <div className="flex flex-col gap-1">
               <p className="text-xs text-muted-foreground">Categoria</p>
               <CategoryAnnouncement
                  category={{
                     color: category?.color || "#6b7280",
                     icon: category?.icon || "Wallet",
                     name: category?.name || "Sem categoria",
                  }}
               />
            </div>
            {bill.isRecurring && bill.recurrencePattern && (
               <>
                  <Separator className="h-8" orientation="vertical" />
                  <InfoItem
                     icon={CalendarDays}
                     label="Recorrência"
                     value={getRecurrenceLabel(
                        bill.recurrencePattern as RecurrencePattern,
                     )}
                  />
               </>
            )}
            {bill.bankAccount && (
               <>
                  <Separator className="h-8" orientation="vertical" />
                  <InfoItem
                     icon={Building}
                     label="Conta Bancária (Opcional)"
                     value={bill.bankAccount.name}
                  />
               </>
            )}
            {bill.counterparty && (
               <>
                  <Separator className="h-8" orientation="vertical" />
                  <InfoItem
                     icon={User}
                     label="Fornecedor/Cliente"
                     value={bill.counterparty?.name}
                  />
               </>
            )}
         </div>

         {/* Actions Section - Below metadata with separator */}
         <div className="pt-2 border-t">
            <BillActions
               bill={bill}
               showViewDetails
               slug={activeOrganization.slug}
               variant="compact"
            />
         </div>
      </div>
   );
}
