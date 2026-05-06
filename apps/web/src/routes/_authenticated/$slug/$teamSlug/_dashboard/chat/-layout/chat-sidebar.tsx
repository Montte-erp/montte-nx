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
   PopoverAnchor,
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
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   Link,
   useMatchRoute,
   useNavigate,
   useParams,
} from "@tanstack/react-router";
import dayjs from "dayjs";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { setActiveThread } from "../../../-montte-ai/chat-store";
import {
   SelectionActionButton,
   useSelectionToolbar,
} from "@/hooks/use-selection-toolbar";
import { orpc, type Outputs } from "@/integrations/orpc/client";

type ThreadRow = Outputs["threads"]["list"]["threads"][number];

interface ThreadGroup {
   id: "today" | "yesterday" | "week" | "older";
   label: string;
   items: Array<{ thread: ThreadRow; index: number }>;
}

function groupByRecency(threads: readonly ThreadRow[]): ThreadGroup[] {
   const today = dayjs().startOf("day");
   const groups: Record<ThreadGroup["id"], ThreadGroup["items"]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
   };

   threads.forEach((thread, index) => {
      const ref = dayjs(thread.lastMessageAt ?? thread.createdAt);
      const days = today.diff(ref.startOf("day"), "day");
      const entry = { thread, index };
      if (days <= 0) groups.today.push(entry);
      else if (days === 1) groups.yesterday.push(entry);
      else if (days <= 7) groups.week.push(entry);
      else groups.older.push(entry);
   });

   const out: ThreadGroup[] = [
      { id: "today", label: "Hoje", items: groups.today },
      { id: "yesterday", label: "Ontem", items: groups.yesterday },
      { id: "week", label: "Esta semana", items: groups.week },
      { id: "older", label: "Anteriores", items: groups.older },
   ];
   return out.filter((g) => g.items.length > 0);
}

function filterThreads(
   threads: readonly ThreadRow[],
   search: string,
): ThreadRow[] {
   if (!search) return threads.slice();
   const q = search.toLowerCase();
   return threads.filter((t) => (t.title ?? "").toLowerCase().includes(q));
}

export function ChatSidebar({ search }: { search: string }) {
   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();
   const params = useParams({ strict: false });
   const { openAlertDialog } = useAlertDialog();

   const { data } = useSuspenseQuery(
      orpc.threads.list.queryOptions({ input: { limit: 50 } }),
   );
   const filtered = filterThreads(data.threads, search);
   const groups = groupByRecency(filtered);

   const removeBulkMutation = useMutation(
      orpc.threads.removeBulk.mutationOptions({
         onError: () => toast.error("Falha ao excluir conversas."),
      }),
   );

   const { selectedIndices, toggle } = useSelectionToolbar(
      ({ selectedIndices, clear }) => (
         <SelectionActionButton
            icon={<Trash2 className="size-3.5" />}
            onClick={() => {
               const ids = Array.from(selectedIndices)
                  .map((i) => filtered[i]?.id)
                  .filter((id): id is string => Boolean(id));
               if (ids.length === 0) return;
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
                     const currentId =
                        "threadId" in params &&
                        typeof params.threadId === "string"
                           ? params.threadId
                           : null;
                     clear();
                     if (currentId && ids.includes(currentId)) {
                        void navigate({
                           params: { slug, teamSlug },
                           to: "/$slug/$teamSlug/chat",
                        });
                     }
                  },
               });
            }}
            variant="destructive"
         >
            Excluir
         </SelectionActionButton>
      ),
   );

   const inSelectionMode = selectedIndices.size > 0;

   return (
      <>
         <SidebarGroup>
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                     <Link
                        onClick={() => setActiveThread(null)}
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

         {groups.map((group) => (
            <ThreadGroupSection
               group={group}
               inSelectionMode={inSelectionMode}
               key={group.id}
               onToggle={toggle}
               selectedIndices={selectedIndices}
            />
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

function ThreadGroupSection({
   group,
   selectedIndices,
   inSelectionMode,
   onToggle,
}: {
   group: ThreadGroup;
   selectedIndices: Set<number>;
   inSelectionMode: boolean;
   onToggle: (index: number) => void;
}) {
   const { slug, teamSlug } = useDashboardSlugs();
   const matchRoute = useMatchRoute();

   return (
      <SidebarGroup>
         <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
         <SidebarGroupContent>
            <SidebarMenu>
               {group.items.map(({ thread, index }) => {
                  const isActive = Boolean(
                     matchRoute({
                        to: "/$slug/$teamSlug/chat/$threadId",
                        params: { slug, teamSlug, threadId: thread.id },
                     }),
                  );
                  return (
                     <ThreadItem
                        inSelectionMode={inSelectionMode}
                        isActive={isActive}
                        isSelected={selectedIndices.has(index)}
                        key={thread.id}
                        onToggle={() => onToggle(index)}
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
   isSelected,
   inSelectionMode,
   onToggle,
}: {
   thread: ThreadRow;
   isActive: boolean;
   isSelected: boolean;
   inSelectionMode: boolean;
   onToggle: () => void;
}) {
   const { slug, teamSlug } = useDashboardSlugs();
   const [renameOpen, setRenameOpen] = useState(false);

   return (
      <Popover onOpenChange={setRenameOpen} open={renameOpen}>
         <PopoverAnchor asChild>
            <SidebarMenuItem className="group/thread relative">
               <Checkbox
                  aria-label="Selecionar conversa"
                  checked={isSelected}
                  className={`absolute left-2 top-1/2 z-10 -translate-y-1/2 transition-opacity ${
                     inSelectionMode || isSelected
                        ? "opacity-100"
                        : "opacity-0 group-hover/thread:opacity-100"
                  }`}
                  onCheckedChange={onToggle}
                  onClick={(e) => {
                     e.stopPropagation();
                     e.preventDefault();
                     onToggle();
                  }}
               />
               <SidebarMenuButton
                  asChild
                  className={`pl-9 ${isActive ? "bg-primary/10 text-primary" : ""}`}
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
         </PopoverAnchor>
         <PopoverContent
            align="start"
            className="w-72 p-3"
            onCloseAutoFocus={(e) => e.preventDefault()}
            onFocusOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
               const target = e.target as HTMLElement | null;
               if (target?.closest("[data-radix-menu-content]")) {
                  e.preventDefault();
               }
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            side="right"
            sideOffset={8}
         >
            <RenameThreadForm
               onClose={() => setRenameOpen(false)}
               thread={thread}
            />
         </PopoverContent>
      </Popover>
   );
}

const renameSchema = z.object({ title: z.string().min(1).max(200) });

function RenameThreadForm({
   thread,
   onClose,
}: {
   thread: ThreadRow;
   onClose: () => void;
}) {
   const renameMutation = useMutation(
      orpc.threads.update.mutationOptions({
         onError: () => toast.error("Falha ao renomear conversa."),
      }),
   );

   const form = useForm({
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
         onClose();
      },
   });

   return (
      <form
         className="flex flex-col gap-3"
         onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
         }}
      >
         <span className="text-sm font-medium">Renomear conversa</span>
         <form.Field name="title">
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
         </form.Field>
         <div className="flex justify-end gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="ghost">
               Cancelar
            </Button>
            <form.Subscribe selector={(s) => s.canSubmit}>
               {(canSubmit) => (
                  <Button disabled={!canSubmit} size="sm" type="submit">
                     Salvar
                  </Button>
               )}
            </form.Subscribe>
         </div>
      </form>
   );
}

function ThreadActions({ thread }: { thread: ThreadRow }) {
   const navigate = useNavigate();
   const params = useParams({ strict: false });
   const { slug, teamSlug } = useDashboardSlugs();
   const { openAlertDialog } = useAlertDialog();

   const removeMutation = useMutation(
      orpc.threads.remove.mutationOptions({
         onError: () => toast.error("Falha ao excluir conversa."),
      }),
   );

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
            <PopoverTrigger asChild>
               <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="size-4" />
                  Renomear
               </DropdownMenuItem>
            </PopoverTrigger>
            <DropdownMenuItem
               className="text-destructive focus:text-destructive"
               onSelect={handleRemove}
            >
               <Trash2 className="size-4" />
               Excluir
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
