import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { cn } from "@packages/ui/lib/utils";
import { ArrowRight, Plus } from "lucide-react";

interface CreateBankAccountItemProps {
   onCreateAccount: () => void;
   solid?: boolean;
}
export function CreateBankAccountItem({
   onCreateAccount,
   solid,
}: CreateBankAccountItemProps) {
   return (
      <Item
         className={cn("cursor-pointer hover:bg-muted/50 transition-colors", {
            "bg-card": solid,
         })}
         onClick={onCreateAccount}
         variant={solid ? "outline" : "default"}
      >
         <ItemMedia variant="icon">
            <Plus className="size-6 " />
         </ItemMedia>
         <ItemContent>
            <ItemTitle>Adicionar conta bancária</ItemTitle>
            <ItemDescription>
               Clique para adicionar uma nova conta bancária.
            </ItemDescription>
         </ItemContent>
         <ItemActions>
            <ArrowRight className="size-6" />
         </ItemActions>
      </Item>
   );
}
