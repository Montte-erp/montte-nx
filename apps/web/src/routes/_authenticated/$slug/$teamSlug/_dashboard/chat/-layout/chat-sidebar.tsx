import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
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
import { useStore, type Store } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { Store as createStore } from "@tanstack/store";
import dayjs from "dayjs";
import {
   Check,
   CheckSquare2,
   MoreHorizontal,
   Pencil,
   Plus,
   Trash2,
   X,
} from "lucide-react";
import { useState } from "react";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { z } from "zod";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc, type Outputs } from "@/integrations/orpc/client";

type ThreadRow = Outputs["threads"]["list"]["threads"][number];

interface ThreadGroup {
   id: "today" | "yesterday" | "week" | "older";
   label: string;
   items: ThreadRow[];
}

const selectionStore: Store<{ ids: string[] }> = new createStore({ ids: [] });

const toggleSelected = (id: string) =>
   selectionStore.setState((s) => ({
      ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
   }));

const clearSelection = () => selectionStore.setState(() => ({ ids: [] }));

const useIsSelected = (id: string) =>
   useStore(selectionStore, (s) => s.ids.includes(id));

const useSelectionCount = () => useStore(selectionStore, (s) => s.ids.length);

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
      const ids = selectedIds;
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
               ids.includes(params.threadId);
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
               {selectedIds.length} selecionada
               {selectedIds.length === 1 ? "" : "s"}
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

   if (inSelectionMode) {
      return (
         <SidebarMenuItem>
            <SidebarMenuButton
               className={isSelected ? "bg-accent" : undefined}
               onClick={() => toggleSelected(thread.id)}
            >
               <Check
                  className={`size-4 shrink-0 ${
                     isSelected ? "opacity-100" : "opacity-30"
                  }`}
               />
               <span className="truncate">
                  {thread.title ?? "Conversa sem título"}
               </span>
            </SidebarMenuButton>
         </SidebarMenuItem>
      );
   }

   return (
      <SidebarMenuItem className="group/thread">
         <SidebarMenuButton
            asChild
            className={isActive ? "bg-primary/10 text-primary" : undefined}
         >
            <Link
               params={{ slug, teamSlug, threadId: thread.id }}
               to="/$slug/$teamSlug/chat/$threadId"
            >
               <span className="truncate">
                  {thread.title ?? "Conversa sem título"}
               </span>
            </Link>
         </SidebarMenuButton>
         <ThreadActions thread={thread} />
      </SidebarMenuItem>
   );
}

const renameSchema = z.object({ title: z.string().min(1).max(200) });

function ThreadActions({ thread }: { thread: ThreadRow }) {
   const navigate = useNavigate();
   const params = useParams({ strict: false });
   const { slug, teamSlug } = useDashboardSlugs();
   const { openAlertDialog } = useAlertDialog();
   const [renameOpen, setRenameOpen] = useState(false);

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

   const renameForm = useForm({
      defaultValues: { title: thread.title ?? "" },
      validators: { onChange: renameSchema },
      onSubmit: async ({ value }) => {
         await fromPromise(
            renameMutation.mutateAsync({
               threadId: thread.id,
               title: value.title.trim(),
            }),
            () => null,
         );
         setRenameOpen(false);
      },
   });

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
      <>
         <Popover onOpenChange={setRenameOpen} open={renameOpen}>
            <PopoverTrigger asChild>
               <span className="hidden" />
            </PopoverTrigger>
            <PopoverContent
               align="start"
               className="w-72 p-3"
               side="right"
               sideOffset={8}
            >
               <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                     e.preventDefault();
                     void renameForm.handleSubmit();
                  }}
               >
                  <span className="text-sm font-medium">Renomear conversa</span>
                  <renameForm.Field name="title">
                     {(field) => (
                        <Input
                           autoFocus
                           id={field.name}
                           name={field.name}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Título"
                           value={field.state.value}
                        />
                     )}
                  </renameForm.Field>
                  <div className="flex justify-end gap-2">
                     <Button
                        onClick={() => setRenameOpen(false)}
                        size="sm"
                        type="button"
                        variant="ghost"
                     >
                        Cancelar
                     </Button>
                     <renameForm.Subscribe selector={(s) => s.canSubmit}>
                        {(canSubmit) => (
                           <Button
                              disabled={!canSubmit}
                              size="sm"
                              type="submit"
                           >
                              Salvar
                           </Button>
                        )}
                     </renameForm.Subscribe>
                  </div>
               </form>
            </PopoverContent>
         </Popover>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <SidebarMenuAction aria-label="Ações da conversa">
                  <MoreHorizontal />
               </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right">
               <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                  <Pencil className="size-4" />
                  Renomear
               </DropdownMenuItem>
               <DropdownMenuItem onSelect={() => toggleSelected(thread.id)}>
                  <CheckSquare2 className="size-4" />
                  Selecionar
               </DropdownMenuItem>
               <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={handleRemove}
               >
                  <Trash2 className="size-4" />
                  Excluir
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </>
   );
}
