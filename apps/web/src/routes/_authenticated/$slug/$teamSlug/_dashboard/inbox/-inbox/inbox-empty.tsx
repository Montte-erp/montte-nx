import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Inbox as InboxIcon } from "lucide-react";

export function InboxEmpty() {
   return (
      <Empty>
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Tudo em dia</EmptyTitle>
            <EmptyDescription>
               Nenhum sinal pendente — você está em dia com vencimentos,
               categorização e eventos do sistema.
            </EmptyDescription>
         </EmptyHeader>
         <EmptyContent />
      </Empty>
   );
}
