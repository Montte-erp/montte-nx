import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { MessageSquare, Plus, Search } from "lucide-react";

export function SidebarChatPanel() {
   return (
      <div className="flex flex-col gap-2 px-2 py-2">
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
               <Input
                  className="h-7 pl-7 text-sm"
                  placeholder="Histórico de chats"
                  readOnly
               />
            </div>
            <Button className="size-7 shrink-0" size="icon" variant="outline">
               <Plus className="size-3.5" />
            </Button>
         </div>
         <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center">
            <MessageSquare className="size-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
               Nenhum chat encontrado
            </p>
         </div>
      </div>
   );
}
