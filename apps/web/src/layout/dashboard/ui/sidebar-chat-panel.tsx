import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
} from "@packages/ui/components/empty";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { MessageSquare, Plus, Search } from "lucide-react";

export function SidebarChatPanel() {
   return (
      <div className="flex flex-col gap-2 px-2 py-2">
         <div className="flex items-center gap-2">
            <InputGroup className="flex-1">
               <InputGroupAddon>
                  <Search aria-hidden="true" />
               </InputGroupAddon>
               <InputGroupInput
                  aria-readonly="true"
                  placeholder="Histórico de chats"
                  readOnly
               />
            </InputGroup>
            <Button
               aria-label="Novo chat"
               className="shrink-0"
               size="icon"
               variant="outline"
            >
               <Plus />
            </Button>
         </div>
         <Empty className="border py-8">
            <EmptyMedia>
               <MessageSquare className="text-muted-foreground/50" />
            </EmptyMedia>
            <EmptyHeader>
               <EmptyDescription>Nenhum chat encontrado</EmptyDescription>
            </EmptyHeader>
         </Empty>
      </div>
   );
}
