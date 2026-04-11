import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { MessageSquarePlusIcon, Trash2Icon } from "lucide-react";
import type { FC, ReactNode } from "react";
import { orpc } from "@/integrations/orpc/client";

export interface ThreadListProps {
   teamId: string;
   activeThreadId: string | undefined;
   onSelect: (threadId: string) => void;
   onDelete: (threadId: string) => Promise<void>;
   onNew: () => void;
   className?: string;
   newThreadTrigger?: ReactNode;
   renderThreadTrigger?: (props: {
      threadId: string;
      title: string | undefined;
      children: ReactNode;
   }) => ReactNode;
}

export const ThreadList: FC<ThreadListProps> = ({
   teamId,
   activeThreadId,
   onSelect,
   onDelete,
   onNew,
   className,
   newThreadTrigger,
   renderThreadTrigger,
}) => {
   const { data } = useSuspenseQuery(
      orpc.chat.listThreads.queryOptions({
         input: { teamId, page: 0, perPage: 50 },
      }),
   );

   return (
      <div
         className={cn(
            "flex h-full flex-col gap-1 overflow-y-auto px-2 py-2",
            className,
         )}
      >
         {newThreadTrigger ?? (
            <Button
               className="flex w-full items-center justify-start gap-2 rounded-lg px-3 py-2 text-sm font-medium"
               onClick={onNew}
               variant="outline"
            >
               Nova conversa
               <MessageSquarePlusIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </Button>
         )}
         <div className="mt-2">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
               Conversas
            </p>
            {data.threads.map((thread) => (
               <ThreadItem
                  activeThreadId={activeThreadId}
                  key={thread.id}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  renderThreadTrigger={renderThreadTrigger}
                  thread={thread}
               />
            ))}
         </div>
      </div>
   );
};

function ThreadItem({
   thread,
   activeThreadId,
   onSelect,
   onDelete,
   renderThreadTrigger,
}: {
   thread: { id: string; title: string; updatedAt: Date };
   activeThreadId: string | undefined;
   onSelect: (id: string) => void;
   onDelete: (id: string) => Promise<void>;
   renderThreadTrigger?: ThreadListProps["renderThreadTrigger"];
}) {
   const isActive = thread.id === activeThreadId;
   const triggerContent = (
      <span className="flex-1 truncate text-foreground/80">
         {thread.title ?? "Nova conversa"}
      </span>
   );

   return (
      <div
         className={cn(
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
            isActive && "bg-accent/80 font-medium",
         )}
      >
         {renderThreadTrigger ? (
            renderThreadTrigger({
               threadId: thread.id,
               title: thread.title,
               children: triggerContent,
            })
         ) : (
            <button
               className="flex min-w-0 flex-1 items-center gap-2 text-left"
               onClick={() => onSelect(thread.id)}
               type="button"
            >
               {triggerContent}
            </button>
         )}
         <button
            className="ml-auto shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            onClick={() => onDelete(thread.id)}
            type="button"
         >
            <Trash2Icon className="size-3.5" />
            <span className="sr-only">Excluir conversa</span>
         </button>
      </div>
   );
}
