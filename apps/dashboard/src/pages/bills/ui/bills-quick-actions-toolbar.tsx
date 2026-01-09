import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { FilePlus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useBillList } from "@/features/bill/lib/bill-list-context";
import { ManageBillForm } from "@/features/bill/ui/manage-bill-form";
import { useSheet } from "@/hooks/use-sheet";

type BillsQuickActionsToolbarProps = {
   type?: "payable" | "receivable";
};

export function BillsQuickActionsToolbar({
   type,
}: BillsQuickActionsToolbarProps) {
   const { openSheet } = useSheet();
   const { setCurrentFilterType } = useBillList();

   useEffect(() => {
      setCurrentFilterType(type);
   }, [type, setCurrentFilterType]);

   const badgeText = useMemo(() => {
      if (type === "payable") {
         return "Contas a Pagar";
      }
      return "Contas a Receber";
   }, [type]);

   return (
      <Item variant="outline">
         <ItemContent>
            <ItemTitle className="flex items-center gap-2">
               Barra de ações
               {type && <Badge variant="secondary">{badgeText}</Badge>}
            </ItemTitle>
            <ItemDescription>
               A barra de ações fornece acesso rápido às ações mais comuns.
            </ItemDescription>
         </ItemContent>
         <ItemActions>
            <Tooltip>
               <TooltipTrigger asChild>
                  <Button
                     aria-label="Nova Conta"
                     onClick={() =>
                        openSheet({
                           children: <ManageBillForm />,
                        })
                     }
                     size="icon"
                     variant="outline"
                  >
                     <FilePlus className="h-4 w-4" />
                  </Button>
               </TooltipTrigger>
               <TooltipContent>
                  <p>
                     Nova Conta
                  </p>
               </TooltipContent>
            </Tooltip>
         </ItemActions>
      </Item>
   );
}
