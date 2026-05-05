import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from "@packages/ui/components/sidebar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Plus } from "lucide-react";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc, type Outputs } from "@/integrations/orpc/client";

type ThreadRow = Outputs["threads"]["list"]["threads"][number];

interface ThreadGroup {
   id: "today" | "yesterday" | "week" | "older";
   label: string;
   items: ThreadRow[];
}

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

   return (
      <>
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
                     <SidebarMenuItem key={thread.id}>
                        <SidebarMenuButton
                           asChild
                           className={
                              isActive
                                 ? "bg-primary/10 text-primary"
                                 : undefined
                           }
                        >
                           <Link
                              params={{
                                 slug,
                                 teamSlug,
                                 threadId: thread.id,
                              }}
                              to="/$slug/$teamSlug/chat/$threadId"
                           >
                              <span className="truncate">
                                 {thread.title ?? "Conversa sem título"}
                              </span>
                           </Link>
                        </SidebarMenuButton>
                     </SidebarMenuItem>
                  );
               })}
            </SidebarMenu>
         </SidebarGroupContent>
      </SidebarGroup>
   );
}
