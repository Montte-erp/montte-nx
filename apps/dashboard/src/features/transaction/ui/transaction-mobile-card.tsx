import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Checkbox } from "@packages/ui/components/checkbox";
import { CollapsibleTrigger } from "@packages/ui/components/collapsible";
import { formatDate } from "@packages/utils/date";
import type { Row } from "@tanstack/react-table";
import { ChevronDown, Split } from "lucide-react";
import { AmountAnnouncement } from "./amount-announcement";
import { CategoryAnnouncement } from "./category-announcement";
import type { Category, Transaction } from "./transaction-list";
import { getCategoryDetails } from "./transaction-table-columns";

type TransactionMobileCardProps = {
   row: Row<Transaction>;
   isExpanded: boolean;
   toggleExpanded: () => void;
   categories: Category[];
   canExpand?: boolean;
};

export function TransactionMobileCard({
   row,
   isExpanded,
   toggleExpanded,
   categories,
   canExpand = true,
}: TransactionMobileCardProps) {
   const transaction = row.original;
   const category = getCategoryDetails(transaction, categories);
   const amount = Number.parseFloat(transaction.amount);
   const isPositive =
      transaction.type === "income" ||
      (transaction.type === "transfer" && amount > 0);
   const categorySplits = transaction.categorySplits;
   const hasSplit = categorySplits && categorySplits.length > 0;

   return (
      <Card className={isExpanded ? "rounded-b-none py-4" : "py-4"}>
         <CardHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
               <CardTitle className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{transaction.description}</span>
                  {hasSplit && (
                     <Split className="size-3.5 text-muted-foreground shrink-0" />
                  )}
               </CardTitle>
               <CardDescription>
                  {formatDate(new Date(transaction.date), "DD MMM YYYY")}
               </CardDescription>
            </div>
            <CardAction>
               <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
               />
            </CardAction>
         </CardHeader>
         <CardContent className="flex flex-wrap items-center gap-2">
            <CategoryAnnouncement category={category} />
            <AmountAnnouncement amount={amount} isPositive={isPositive} />
         </CardContent>
         {canExpand && (
            <CardFooter>
               <CollapsibleTrigger asChild onClick={toggleExpanded}>
                  <Button className="w-full" variant="outline">
                     <ChevronDown
                        className={`size-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                     />
                     Mais
                  </Button>
               </CollapsibleTrigger>
            </CardFooter>
         )}
      </Card>
   );
}
