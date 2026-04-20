import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { useCallback } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { toast } from "sonner";
import { ThemeSwitcher } from "./theme-switcher";

function SidebarAccountMenuSkeleton() {
   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none" size="lg">
               <Skeleton className="size-8 rounded-full" />
               <div className="grid flex-1 gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
               </div>
            </SidebarMenuButton>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

function SidebarAccountMenuContent() {
   const { data: session } = useSuspenseQuery(
      orpc.session.getSession.queryOptions({}),
   );
   const { slug, teamSlug } = useDashboardSlugs();
   const { openAlertDialog } = useAlertDialog();
   const { isMobile, setOpenMobile } = useSidebar();
   const queryClient = useQueryClient();
   const router = useRouter();
   const handleLogout = useCallback(async () => {
      await authClient.signOut({
         fetchOptions: {
            onError: ({ error }) => {
               toast.error(error.message, { id: "logout" });
            },
            onRequest: () => {
               toast.loading("Saindo...", { id: "logout" });
            },
            onSuccess: async () => {
               await queryClient.invalidateQueries({
                  queryKey: orpc.session.getSession.queryKey({}),
               });
               router.navigate({ to: "/auth/sign-in" });
               toast.success("Você saiu com sucesso", { id: "logout" });
            },
         },
      });
      setOpenMobile(false);
   }, [queryClient, router, setOpenMobile]);

   const handleLogoutClick = useCallback(() => {
      openAlertDialog({
         actionLabel: "Sair",
         cancelLabel: "Cancelar",
         description: "Tem certeza que deseja sair da sua conta?",
         onAction: handleLogout,
         title: "Sair da Conta",
         variant: "destructive",
      });
   }, [openAlertDialog, handleLogout]);

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                     className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                     size="lg"
                  >
                     <Avatar className="size-8 shrink-0 rounded-full">
                        <AvatarImage
                           alt={session?.user.name ?? ""}
                           src={session?.user.image ?? undefined}
                        />
                        <AvatarFallback className="rounded-full text-[10px]">
                           {session?.user.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                     </Avatar>
                     <div className="grid min-w-0 flex-1 text-left leading-tight">
                        <span className="truncate text-sm font-medium">
                           {session?.user.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                           {session?.user.email}
                        </span>
                     </div>
                     <ChevronsUpDown className="shrink-0" />
                  </SidebarMenuButton>
               </DropdownMenuTrigger>
               <DropdownMenuContent
                  align="end"
                  side={isMobile ? "bottom" : "top"}
                  sideOffset={4}
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
               >
                  <DropdownMenuLabel className="py-2">
                     <div className="flex items-center gap-2">
                        <Avatar className="size-8 rounded-full">
                           <AvatarImage
                              src={session?.user.image ?? undefined}
                              alt={session?.user.name ?? ""}
                           />
                           <AvatarFallback>
                              {session?.user.name?.charAt(0) ?? "?"}
                           </AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1 leading-tight">
                           <span className="truncate font-medium">
                              {session?.user.name}
                           </span>
                           <span className="truncate text-xs text-muted-foreground">
                              {session?.user.email}
                           </span>
                        </div>
                     </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between px-2 py-1.5">
                     <span className="text-sm text-muted-foreground">Tema</span>
                     <ThemeSwitcher />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/settings/profile"
                     >
                        <Settings aria-hidden="true" />
                        Meu perfil
                     </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                     onSelect={handleLogoutClick}
                     className="text-destructive focus:text-destructive"
                  >
                     <LogOut aria-hidden="true" />
                     Sair
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

export function SidebarAccountMenu() {
   return (
      <QueryBoundary
         fallback={<SidebarAccountMenuSkeleton />}
         errorTitle="Erro ao carregar conta"
      >
         <SidebarAccountMenuContent />
      </QueryBoundary>
   );
}
