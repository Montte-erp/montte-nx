import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuAction,
   SidebarMenuButton,
   SidebarMenuItem,
} from "@packages/ui/components/sidebar";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   Link,
   useMatchRoute,
   useNavigate,
   useParams,
} from "@tanstack/react-router";
import { createStore, useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc, type Outputs } from "@/integrations/orpc/client";

type ThreadRow = Outputs["threads"]["list"]["threads"][number];

interface ThreadGroup {
   id: "today" | "yesterday" | "week" | "older";
   label: string;
   items: ThreadRow[];
}

const selectionStore = createStore<{ ids: Set<string> }>({ ids: new Set() });

const toggleSelected = (id: string) =>
   selectionStore.setState((s) => {
      const next = new Set(s.ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ids: next };
   });

const clearSelection = () =>
   selectionStore.setState(() => ({ ids: new Set() }));

const useIsSelected = (id: string) =>
   useStore(selectionStore, (s) => s.ids.has(id));

const useSelectionCount = () => useStore(selectionStore, (s) => s.ids.size);

const useSelectedIds = () => useStore(selectionStore, (s) => s.ids);

function groupByRecency(threads: readonly ThreadRow[]): ThreadGroup[] {
   const today = dayjs().startOf("day");
   const groups: Record<ThreadGroup["id"], ThreadRow[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
   };

   for (const t of threads) {
      const ref = dayjs(t.lastMessageAt ?? t.createdAt);
      const days = today.diff(ref.startOf("day"), "day");
      if (days <= 0) groups.today.push(t);
      else if (days === 1) groups.yesterday.push(t);
      else if (days <= 7) groups.week.push(t);
      else groups.older.push(t);
   }

   const out: ThreadGroup[] = [
      { id: "today", label: "Hoje", items: groups.today },
      { id: "yesterday", label: "Ontem", items: groups.yesterday },
      { id: "week", label: "Esta semana", items: groups.week },
      { id: "older", label: "Anteriores", items: groups.older },
   ];
   return out.filter((g) => g.items.length > 0);
}

function filterThreads(threads: readonly ThreadRow[], search: string) {
   if (!search) return threads;
   const q = search.toLowerCase();
   return threads.filter((t) => (t.title ?? "").toLowerCase().includes(q));
}

export function ChatSidebar({ search }: { search: string }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const { data } = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 50 } }),
   );
   const groups = groupByRecency(filterThreads(data.threads, search));
   const selectionCount = useSelectionCount();

   return (
      <>
         {selectionCount > 0 ? (
            <BulkSelectionBar />
         ) : (
            <SidebarGroup>
               <SidebarMenu>
                  <SidebarMenuItem>
                     <SidebarMenuButton asChild>
                        <Link
                           params={{ slug, teamSlug }}
                           to="/$slug/$teamSlug/chat"
                        >
                           <Plus className="size-4" />
                           <span>Nova conversa</span>
                        </Link>
                     </SidebarMenuButton>
                  </SidebarMenuItem>
               </SidebarMenu>
            </SidebarGroup>
         )}

         {groups.map((group) => (
            <ThreadGroupSection group={group} key={group.id} />
         ))}

         {groups.length === 0 ? (
            <SidebarGroup>
               <SidebarGroupContent className="px-3 py-2 text-xs text-muted-foreground">
                  {search
                     ? "Nenhuma conversa encontrada."
                     : "Nenhuma conversa ainda."}
               </SidebarGroupContent>
            </SidebarGroup>
         ) : null}
      </>
   );
}

function BulkSelectionBar() {
   const navigate = useNavigate();
   const params = useParams({ strict: false });
   const { slug, teamSlug } = useDashboardSlugs();
   const selectedIds = useSelectedIds();
   const { openAlertDialog } = useAlertDialog();

   const removeBulkMutation = useMutation(
      orpc.threads.removeBulk.mutationOptions({
         onError: () => toast.error("Falha ao excluir conversas."),
      }),
   );

   const handleBulkDelete = () => {
      const ids = Array.from(selectedIds);
      openAlertDialog({
         title: `Excluir ${ids.length} ${ids.length === 1 ? "conversa" : "conversas"}?`,
         description:
            "Esta ação é permanente. As mensagens não poderão ser recuperadas.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            const result = await fromPromise(
               removeBulkMutation.mutateAsync({ threadIds: ids }),
               () => null,
            );
            if (result.isErr()) return;
            const isCurrent =
               "threadId" in params &&
               typeof params.threadId === "string" &&
               selectedIds.has(params.threadId);
            clearSelection();
            if (isCurrent) {
               void navigate({
                  params: { slug, teamSlug },
                  to: "/$slug/$teamSlug/chat",
               });
            }
         },
      });
   };

   return (
      <SidebarGroup>
         <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
            <Button
               aria-label="Limpar seleção"
               className="size-7"
               onClick={clearSelection}
               size="icon"
               variant="ghost"
            >
               <X className="size-4" />
            </Button>
            <span className="flex-1 text-xs">
               {selectedIds.size} selecionada
               {selectedIds.size === 1 ? "" : "s"}
            </span>
            <Button
               className="h-7 gap-1 px-2 text-xs"
               onClick={handleBulkDelete}
               size="sm"
               variant="destructive"
            >
               <Trash2 className="size-3.5" />
               Excluir
            </Button>
         </div>
      </SidebarGroup>
   );
}

function ThreadGroupSection({ group }: { group: ThreadGroup }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const matchRoute = useMatchRoute();

   return (
      <SidebarGroup>
         <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
         <SidebarGroupContent>
            <SidebarMenu>
               {group.items.map((thread) => {
                  const isActive = Boolean(
                     matchRoute({
                        to: "/$slug/$teamSlug/chat/$threadId",
                        params: { slug, teamSlug, threadId: thread.id },
                     }),
                  );
                  return (
                     <ThreadItem
                        isActive={isActive}
                        key={thread.id}
                        thread={thread}
                     />
                  );
               })}
            </SidebarMenu>
         </SidebarGroupContent>
      </SidebarGroup>
   );
}

function ThreadItem({
   thread,
   isActive,
}: {
   thread: ThreadRow;
   isActive: boolean;
}) {
   const { slug, teamSlug } = useDashboardSlugs();
   const isSelected = useIsSelected(thread.id);
   const selectionCount = useSelectionCount();
   const inSelectionMode = selectionCount > 0;

   return (
      <SidebarMenuItem className="group/thread">
         <SidebarMenuButton
            asChild={!inSelectionMode}
            className={isActive ? "bg-primary/10 text-primary" : undefined}
            onClick={
               inSelectionMode ? () => toggleSelected(thread.id) : undefined
            }
         >
            {inSelectionMode ? (
               <>
                  <Checkbox checked={isSelected} className="shrink-0" />
                  <span className="truncate">
                     {thread.title ?? "Conversa sem título"}
                  </span>
               </>
            ) : (
               <Link
                  params={{ slug, teamSlug, threadId: thread.id }}
                  to="/$slug/$teamSlug/chat/$threadId"
               >
                  <Checkbox
                     checked={isSelected}
                     className="opacity-0 transition-opacity group-hover/thread:opacity-100 shrink-0"
                     onCheckedChange={() => toggleSelected(thread.id)}
                     onClick={(e) => e.stopPropagation()}
                  />
                  <span className="truncate">
                     {thread.title ?? "Conversa sem título"}
                  </span>
               </Link>
            )}
         </SidebarMenuButton>
         {!inSelectionMode ? <ThreadActions thread={thread} /> : null}
      </SidebarMenuItem>
   );
}

function ThreadActions({ thread }: { thread: ThreadRow }) {
   const navigate = useNavigate();
   const params = useParams({ strict: false });
   const { slug, teamSlug } = useDashboardSlugs();
   const { openAlertDialog } = useAlertDialog();

   const renameMutation = useMutation(
      orpc.threads.update.mutationOptions({
         onError: () => toast.error("Falha ao renomear conversa."),
      }),
   );

   const removeMutation = useMutation(
      orpc.threads.remove.mutationOptions({
         onError: () => toast.error("Falha ao excluir conversa."),
      }),
   );

   const handleRename = async () => {
      const next = window.prompt("Renomear conversa", thread.title ?? "");
      if (next === null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === thread.title) return;
      await fromPromise(
         renameMutation.mutateAsync({
            threadId: thread.id,
            title: trimmed,
         }),
         () => null,
      );
   };

   const handleRemove = () => {
      openAlertDialog({
         title: "Excluir conversa?",
         description:
            "Esta ação é permanente. As mensagens não poderão ser recuperadas.",
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            const result = await fromPromise(
               removeMutation.mutateAsync({ threadId: thread.id }),
               () => null,
            );
            if (result.isErr()) return;
            const isCurrent =
               "threadId" in params && params.threadId === thread.id;
            if (isCurrent) {
               void navigate({
                  params: { slug, teamSlug },
                  to: "/$slug/$teamSlug/chat",
               });
            }
         },
      });
   };

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <SidebarMenuAction aria-label="Ações da conversa">
               <MoreHorizontal />
            </SidebarMenuAction>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end" side="right">
            <DropdownMenuItem onClick={handleRename}>
               <Pencil className="size-4" />
               Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleSelected(thread.id)}>
               <Checkbox checked={false} className="size-4" />
               Selecionar
            </DropdownMenuItem>
            <DropdownMenuItem
               className="text-destructive focus:text-destructive"
               onClick={handleRemove}
            >
               <Trash2 className="size-4" />
               Excluir
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
