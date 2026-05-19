import {
   ThreadListItemPrimitive,
   ThreadListPrimitive,
   useAui,
   useAuiState,
} from "@assistant-ui/react";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   MessageSquare,
   MoreHorizontal,
   Pencil,
   Plus,
   Trash2,
} from "lucide-react";
import { useState } from "react";

interface ThreadListProps {
   onSelectThread?: () => void;
   showActions?: boolean;
   showNew?: boolean;
}

export function ThreadList({
   onSelectThread,
   showActions = true,
   showNew = true,
}: ThreadListProps = {}) {
   const isRunning = useAuiState((s) => s.thread.isRunning);
   const threadCount = useAuiState((s) => s.threads.threadIds.length);
   const loading = useAuiState((s) => s.threads.isLoading);

   return (
      <ThreadListPrimitive.Root className="aui-root flex min-h-0 flex-col gap-2 p-2">
         {showNew ? (
            <ThreadListPrimitive.New asChild>
               <Button
                  className="h-8 w-full justify-start gap-2 px-2 text-xs"
                  disabled={isRunning}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  <Plus className="size-4" />
                  Nova conversa
               </Button>
            </ThreadListPrimitive.New>
         ) : null}
         {loading && threadCount === 0 ? <ThreadListSkeleton /> : null}
         <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            <ThreadListPrimitive.Items>
               {({ threadListItem }) =>
                  threadListItem.remoteId ? (
                     <ThreadListItem
                        onSelect={onSelectThread}
                        showActions={showActions}
                     />
                  ) : null
               }
            </ThreadListPrimitive.Items>
         </div>
      </ThreadListPrimitive.Root>
   );
}

function ThreadListItem({
   onSelect,
   showActions,
}: {
   onSelect?: () => void;
   showActions: boolean;
}) {
   const aui = useAui();
   const title = useAuiState((s) => s.threadListItem.title);
   const [renameOpen, setRenameOpen] = useState(false);
   const [nextTitle, setNextTitle] = useState(title ?? "");

   const rename = async () => {
      const trimmed = nextTitle.trim();
      if (!trimmed) return;
      await aui.threadListItem().rename(trimmed);
      setRenameOpen(false);
   };

   return (
      <ThreadListItemPrimitive.Root className="group/thread flex items-center gap-2 rounded-md data-[active=true]:bg-accent">
         <ThreadListItemPrimitive.Trigger asChild>
            <Button
               className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-left text-xs"
               onClick={onSelect}
               type="button"
               variant="ghost"
            >
               <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
               <span className="min-w-0 flex-1 truncate">
                  <ThreadListItemPrimitive.Title fallback="Conversa sem título" />
               </span>
            </Button>
         </ThreadListItemPrimitive.Trigger>
         {showActions ? (
            <Popover onOpenChange={setRenameOpen} open={renameOpen}>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button
                        aria-label="Ações da conversa"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover/thread:opacity-100 data-[state=open]:opacity-100"
                        size="icon"
                        type="button"
                        variant="ghost"
                     >
                        <MoreHorizontal className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <PopoverTrigger asChild>
                        <DropdownMenuItem
                           onSelect={(event) => {
                              event.preventDefault();
                              setNextTitle(title ?? "");
                              setRenameOpen(true);
                           }}
                        >
                           <Pencil className="size-4" />
                           Renomear
                        </DropdownMenuItem>
                     </PopoverTrigger>
                     <ThreadListItemPrimitive.Delete asChild>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                           <Trash2 className="size-4" />
                           Excluir
                        </DropdownMenuItem>
                     </ThreadListItemPrimitive.Delete>
                  </DropdownMenuContent>
               </DropdownMenu>
               <PopoverContent align="end" className="w-64 p-4">
                  <form
                     className="flex flex-col gap-4"
                     onSubmit={(event) => {
                        event.preventDefault();
                        void rename();
                     }}
                  >
                     <Input
                        autoFocus
                        onChange={(event) => setNextTitle(event.target.value)}
                        placeholder="Título da conversa"
                        value={nextTitle}
                     />
                     <div className="flex justify-end gap-2">
                        <Button
                           onClick={() => setRenameOpen(false)}
                           size="sm"
                           type="button"
                           variant="ghost"
                        >
                           Cancelar
                        </Button>
                        <Button size="sm" type="submit">
                           Salvar
                        </Button>
                     </div>
                  </form>
               </PopoverContent>
            </Popover>
         ) : null}
      </ThreadListItemPrimitive.Root>
   );
}

function ThreadListSkeleton() {
   return (
      <div className="flex flex-col gap-2">
         {Array.from({ length: 3 }, (_, index) => (
            <div
               aria-label="Carregando conversas"
               className="flex h-8 items-center px-2"
               key={`thread-skeleton-${index + 1}`}
               role="status"
            >
               <Skeleton className="h-4 w-full" />
            </div>
         ))}
      </div>
   );
}
