import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CheckCheck, Eye, Info, Minus, Split, X } from "lucide-react";
import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { AmountAnnouncement } from "./amount-announcement";
import type { Category, Transaction } from "./transaction-list";

type CategorySplit = {
   categoryId: string;
   value: number;
   splitType: "amount";
};

export function getCategoryDetails(
   transaction: Transaction,
   categories: Category[],
) {
   const transactionCategoryIds =
      transaction.transactionCategories?.map((tc) => tc.category.id) || [];
   const primaryCategoryId = transactionCategoryIds[0];
   const categoryDetails = categories.find(
      (cat) => cat.id === primaryCategoryId,
   );
   return {
      color: categoryDetails?.color || "#6b7280",
      icon: categoryDetails?.icon || "Wallet",
      name: categoryDetails?.name || "Sem categoria",
   };
}

function TransactionActionsCell({
   transaction,
   slug,
}: {
   transaction: Transaction;
   slug: string;
}) {
   return (
      <div className="flex justify-end">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button asChild size="icon" variant="outline">
                  <Link
                     params={{
                        slug,
                        transactionId: transaction.id,
                     }}
                     to="/$slug/transactions/$transactionId"
                  >
                     <Eye className="size-4" />
                  </Link>
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
      </div>
   );
}

export type TransactionWithScore = Transaction & { score?: number };

function getSimilarityConfig(score: number) {
   if (score >= 80) {
      return {
         color: "#10b981",
         icon: CheckCheck,
         label: "Muito similar",
      };
   }
   if (score >= 60) {
      return {
         color: "#3b82f6",
         icon: Check,
         label: "Similar",
      };
   }
   if (score >= 40) {
      return {
         color: "#eab308",
         icon: Minus,
         label: "Pouco similar",
      };
   }
   return {
      color: "#6b7280",
      icon: X,
      label: "Não similar",
   };
}

export function createSimilarTransactionColumns(
   categories: Category[],
   slug: string,
): ColumnDef<TransactionWithScore>[] {
   return [
      {
         accessorKey: "score",
         cell: ({ row }) => {
            const score = row.original.score ?? 0;
            const config = getSimilarityConfig(score);
            const Icon = config.icon;

            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${config.color}20`,
                        color: config.color,
                     }}
                  >
                     <Icon className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle>
                     {score}% - {config.label}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: false,
         header: "Similaridade",
         size: 180,
      },
      {
         accessorKey: "description",
         cell: ({ row }) => {
            const transaction = row.original;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span className="font-medium flex items-center gap-1 max-w-[180px]">
                        <span className="truncate">
                           {transaction.description}
                        </span>
                        <Info className="size-3 text-muted-foreground shrink-0" />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>{transaction.description}</TooltipContent>
               </Tooltip>
            );
         },
         enableSorting: false,
         header: "Descricao",
         maxSize: 180,
      },
      {
         cell: ({ row }) => {
            const transaction = row.original;
            const category = getCategoryDetails(transaction, categories);

            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                     }}
                  >
                     <IconDisplay
                        iconName={category.icon as IconName}
                        size={14}
                     />
                  </AnnouncementTag>
                  <AnnouncementTitle className="max-w-[100px] truncate">
                     {category.name}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: false,
         header: "Categoria",
         id: "category",
      },
      {
         accessorKey: "date",
         cell: ({ row }) => {
            return formatDate(new Date(row.getValue("date")), "DD MMM YYYY");
         },
         enableSorting: false,
         header: "Data",
      },
      {
         accessorKey: "amount",
         cell: ({ row }) => {
            const transaction = row.original;
            const amount = Number.parseFloat(transaction.amount);
            const isPositive =
               transaction.type === "income" ||
               (transaction.type === "transfer" && amount > 0);

            return (
               <AmountAnnouncement amount={amount} isPositive={isPositive} />
            );
         },
         enableSorting: false,
         header: "Valor",
      },
      {
         cell: ({ row }) => (
            <TransactionActionsCell slug={slug} transaction={row.original} />
         ),
         header: "",
         id: "actions",
      },
   ];
}

export function createTransactionColumns(
   categories: Category[],
   slug: string,
): ColumnDef<Transaction>[] {
   return [
      {
         accessorKey: "description",
         cell: ({ row }) => {
            const transaction = row.original;
            const categorySplits = transaction.categorySplits as
               | CategorySplit[]
               | null;
            const hasSplit = categorySplits && categorySplits.length > 0;

            const getSplitTooltipContent = () => {
               if (!hasSplit) return null;
               return categorySplits.map((split) => {
                  const cat = categories.find((c) => c.id === split.categoryId);
                  if (!cat) return null;
                  return (
                     <div
                        className="flex items-center justify-between gap-4"
                        key={split.categoryId}
                     >
                        <div className="flex items-center gap-2">
                           <div
                              className="size-3 rounded-sm"
                              style={{ backgroundColor: cat.color }}
                           />
                           <span>{cat.name}</span>
                        </div>
                        <span className="font-medium">
                           {formatDecimalCurrency(split.value / 100)}
                        </span>
                     </div>
                  );
               });
            };

            return (
               <div className="flex items-center gap-1.5">
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <span className="font-medium flex items-center gap-1 max-w-[200px]">
                           <span className="truncate">
                              {transaction.description}
                           </span>
                           <Info className="size-3 text-muted-foreground shrink-0" />
                        </span>
                     </TooltipTrigger>
                     <TooltipContent>{transaction.description}</TooltipContent>
                  </Tooltip>
                  {hasSplit && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <Split className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="space-y-1.5 p-3">
                           {getSplitTooltipContent()}
                        </TooltipContent>
                     </Tooltip>
                  )}
               </div>
            );
         },
         enableSorting: false,
         header: "Descricao",

         maxSize: 200,
      },
      {
         cell: ({ row }) => {
            const transaction = row.original;
            const category = getCategoryDetails(transaction, categories);

            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${category.color}20`,
                        color: category.color,
                     }}
                  >
                     <IconDisplay
                        iconName={category.icon as IconName}
                        size={14}
                     />
                  </AnnouncementTag>
                  <AnnouncementTitle className="max-w-[120px] truncate">
                     {category.name}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: false,
         header: "Categoria",
         id: "category",
      },
      {
         accessorKey: "date",
         cell: ({ row }) => {
            return formatDate(new Date(row.getValue("date")), "DD MMM YYYY");
         },
         enableSorting: false,

         header: "Data",
      },
      {
         accessorKey: "amount",
         cell: ({ row }) => {
            const transaction = row.original;
            const amount = Number.parseFloat(transaction.amount);
            const isPositive =
               transaction.type === "income" ||
               (transaction.type === "transfer" && amount > 0);

            return (
               <AmountAnnouncement amount={amount} isPositive={isPositive} />
            );
         },
         enableSorting: true,
         header: "Valor",
      },
      {
         cell: ({ row }) => (
            <TransactionActionsCell slug={slug} transaction={row.original} />
         ),
         header: "",
         id: "actions",
      },
   ];
}
