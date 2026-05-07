import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import {
   AlertCircle,
   AlertTriangle,
   ArrowRight,
   Clock,
   Info,
   MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import type { InboxItem } from "./inbox-types";

const SEVERITY_BADGE = {
   urgent: { label: "Urgente", variant: "destructive" as const },
   warning: { label: "Aviso", variant: "default" as const },
   info: { label: "Info", variant: "secondary" as const },
} as const;

const SEVERITY_ICON = {
   urgent: AlertCircle,
   warning: AlertTriangle,
   info: Info,
} as const;

interface Props {
   item: InboxItem;
}

export function InboxCard({ item }: Props) {
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const dismissMutation = useMutation(
      orpc.inbox.dismiss.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.inbox.list.queryKey(),
            });
         },
         onError: () => toast.error("Falha ao dispensar item."),
      }),
   );

   const snoozeMutation = useMutation(
      orpc.inbox.snooze.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.inbox.list.queryKey(),
            });
            toast.success("Item adiado por 24h.");
         },
         onError: () => toast.error("Falha ao adiar item."),
      }),
   );

   const SeverityIcon = SEVERITY_ICON[item.severity];
   const badge = SEVERITY_BADGE[item.severity];

   const navigateAction = item.actions.find((a) => a.kind === "navigate");

   const handleNavigate = () => {
      if (!navigateAction || !slug || !teamSlug) return;
      const payload = navigateAction.payload as
         | { route?: string; id?: string; filter?: string }
         | undefined;
      if (!payload?.route) return;
      navigate({
         to: `/$slug/$teamSlug/${payload.route}`,
         params: { slug, teamSlug },
      });
   };

   return (
      <Card>
         <CardHeader className="flex flex-row items-start gap-4">
            <SeverityIcon
               className={
                  item.severity === "urgent"
                     ? "text-destructive size-5 shrink-0"
                     : item.severity === "warning"
                       ? "text-amber-500 size-5 shrink-0"
                       : "text-sky-500 size-5 shrink-0"
               }
            />
            <div className="flex flex-1 flex-col gap-2">
               <div className="flex items-center gap-2">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                     <Clock className="size-3" />
                     {dayjs(item.occurredAt).format("DD/MM/YYYY HH:mm")}
                  </span>
               </div>
               <CardTitle className="text-base">{item.title}</CardTitle>
               {item.description ? (
                  <CardDescription>{item.description}</CardDescription>
               ) : null}
            </div>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                     <MoreHorizontal />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end">
                  <DropdownMenuItem
                     onClick={() =>
                        snoozeMutation.mutate({
                           itemKey: item.itemKey,
                           until: dayjs().add(1, "day").toDate().toISOString(),
                        })
                     }
                  >
                     Adiar 24h
                  </DropdownMenuItem>
                  <DropdownMenuItem
                     onClick={() =>
                        dismissMutation.mutate({ itemKey: item.itemKey })
                     }
                  >
                     Dispensar
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </CardHeader>
         {navigateAction ? (
            <CardContent className="flex justify-end">
               <Button variant="outline" size="sm" onClick={handleNavigate}>
                  {navigateAction.label}
                  <ArrowRight />
               </Button>
            </CardContent>
         ) : null}
      </Card>
   );
}
