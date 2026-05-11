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
   DropdownMenuSub,
   DropdownMenuSubContent,
   DropdownMenuSubTrigger,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
} from "@packages/ui/components/sidebar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { Check, ChevronsUpDown, Plus, Settings, UserPlus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { QueryBoundary } from "@/components/query-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { CreateTeamForm } from "./-sidebar-scope-switcher/create-team-form";

type Organization = {
   id: string;
   name: string;
   slug: string;
   logo?: string | null;
   role?: string;
};

type Team = {
   id: string;
   name: string;
   slug: string;
};

const ORG_AVATAR_COLORS = [
   "bg-blue-600",
   "bg-emerald-600",
   "bg-violet-600",
   "bg-amber-600",
   "bg-rose-600",
   "bg-cyan-600",
   "bg-pink-600",
   "bg-indigo-600",
];

function getInitials(value: string) {
   return value.trim().charAt(0).toUpperCase() || "?";
}

function getOrgColor(name: string) {
   if (!name) return ORG_AVATAR_COLORS[0]!;
   let hash = 0;
   for (const char of name) {
      hash = char.charCodeAt(0) + ((hash << 5) - hash);
   }
   return ORG_AVATAR_COLORS[Math.abs(hash) % ORG_AVATAR_COLORS.length]!;
}

function OrgAvatar({
   name,
   logo,
   size = "sm",
}: {
   name: string;
   logo?: string | null;
   size?: "sm" | "md";
}) {
   const sizeClass = size === "md" ? "size-8 rounded-md" : "size-4 rounded-sm";
   return (
      <Avatar className={`${sizeClass} shrink-0`}>
         <AvatarImage alt={name} src={logo ?? undefined} />
         <AvatarFallback
            className={`${sizeClass} text-sm font-bold text-white ${getOrgColor(name)}`}
         >
            {getInitials(name)}
         </AvatarFallback>
      </Avatar>
   );
}

function SidebarScopeSwitcherSkeleton() {
   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <SidebarMenuButton className="pointer-events-none" size="lg">
               <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted" />
               <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
               </div>
            </SidebarMenuButton>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

function SidebarScopeSwitcherContent() {
   const { activeOrganization } = useActiveOrganization();
   const { activeTeam, teams } = useActiveTeam();
   const { openCredenza } = useCredenza();
   const queryClient = useQueryClient();
   const router = useRouter();
   const { pathname } = useLocation();
   const { slug, teamSlug } = useDashboardSlugs();
   const [isSwitching, startSwitching] = useTransition();

   const { data: organizations } = useSuspenseQuery(
      orpc.organization.getOrganizations.queryOptions({}),
   );

   function switchOrganization(org: Organization) {
      if (org.id === activeOrganization.id || isSwitching) return;
      const toastId = toast.loading("Trocando organização...");

      startSwitching(async () => {
         const result = await authClient.organization.setActive({
            organizationId: org.id,
            organizationSlug: org.slug,
         });
         if (result.error) {
            toast.error(result.error.message, { id: toastId });
            return;
         }

         await queryClient.invalidateQueries();

         const teamsForOrg = await queryClient.fetchQuery(
            orpc.organization.getOrganizationTeams.queryOptions({}),
         );
         const firstTeam = teamsForOrg[0];
         if (!firstTeam) {
            toast.error("Organização sem espaços", { id: toastId });
            router.navigate({ to: "/onboarding" });
            return;
         }

         await authClient.organization.setActiveTeam({ teamId: firstTeam.id });
         await queryClient.invalidateQueries({
            queryKey: orpc.session.getSession.queryKey({}),
         });

         toast.success("Organização trocada", { id: toastId });
         router.navigate({
            to: "/$slug/$teamSlug/inbox",
            params: { slug: org.slug, teamSlug: firstTeam.slug },
         });
      });
   }

   function switchTeam(team: Team) {
      if (team.id === activeTeam?.id) return;

      startSwitching(async () => {
         await authClient.organization.setActiveTeam({ teamId: team.id });
         await queryClient.invalidateQueries({
            queryKey: orpc.session.getSession.queryKey({}),
         });

         const teamPrefix = `/${slug}/${teamSlug}`;
         const nextPath = pathname.startsWith(teamPrefix)
            ? pathname.replace(teamPrefix, `/${slug}/${team.slug}`)
            : `/${slug}/${team.slug}/inbox`;
         router.navigate({ to: nextPath });
      });
   }

   function newProject() {
      openCredenza({
         className: "max-w-md sm:max-w-md",
         renderChildren: () => <CreateTeamForm />,
      });
   }

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                     className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                     data-testid="sidebar-scope-switcher"
                     size="lg"
                  >
                     <Avatar className="aspect-square size-8 shrink-0 rounded-lg">
                        <AvatarImage
                           alt={activeOrganization.name}
                           src={activeOrganization.logo ?? undefined}
                        />
                        <AvatarFallback
                           className={`rounded-lg text-sm font-bold text-white ${getOrgColor(activeOrganization.name)}`}
                        >
                           {getInitials(activeOrganization.name)}
                        </AvatarFallback>
                     </Avatar>
                     <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">
                           {activeTeam?.name ?? "Sem espaço"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                           {activeOrganization.name}
                        </span>
                     </div>
                     <ChevronsUpDown className="ml-auto size-4 shrink-0" />
                  </SidebarMenuButton>
               </DropdownMenuTrigger>

               <DropdownMenuContent
                  align="start"
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-72 rounded-lg"
                  side="bottom"
                  sideOffset={4}
               >
                  <DropdownMenuLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                     Espaço
                  </DropdownMenuLabel>

                  <DropdownMenuSub>
                     <DropdownMenuSubTrigger className="gap-2">
                        <span className="truncate font-medium">
                           {activeTeam?.name ?? "Sem espaço"}
                        </span>
                     </DropdownMenuSubTrigger>
                     <DropdownMenuSubContent className="min-w-52">
                        {teams.map((team) => (
                           <DropdownMenuItem
                              key={team.id}
                              onSelect={() => switchTeam(team)}
                           >
                              {team.id === activeTeam?.id ? (
                                 <Check className="size-4 shrink-0" />
                              ) : (
                                 <span className="size-4 shrink-0" />
                              )}
                              <span className="truncate">{team.name}</span>
                           </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={newProject}>
                           <Plus className="size-4" />
                           <span>Novo espaço</span>
                        </DropdownMenuItem>
                     </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/settings/organization/members"
                     >
                        <UserPlus className="size-4" />
                        Convidar membros
                     </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/settings/project/general"
                     >
                        <Settings className="size-4" />
                        Configurações do espaço
                     </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                     Organização
                  </DropdownMenuLabel>

                  <DropdownMenuSub>
                     <DropdownMenuSubTrigger className="gap-2">
                        <OrgAvatar
                           logo={activeOrganization.logo}
                           name={activeOrganization.name}
                        />
                        <span className="truncate font-medium">
                           {activeOrganization.name}
                        </span>
                     </DropdownMenuSubTrigger>
                     <DropdownMenuSubContent className="min-w-52">
                        {organizations.map((org) => (
                           <DropdownMenuItem
                              key={org.id}
                              onSelect={() => switchOrganization(org)}
                           >
                              {org.id === activeOrganization.id ? (
                                 <Check className="size-4 shrink-0" />
                              ) : (
                                 <span className="size-4 shrink-0" />
                              )}
                              <OrgAvatar
                                 logo={org.logo}
                                 name={org.name}
                                 size="md"
                              />
                              <span className="truncate">{org.name}</span>
                              {org.role && (
                                 <span className="ml-auto shrink-0 text-sm text-muted-foreground">
                                    {org.role}
                                 </span>
                              )}
                           </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                           onSelect={() =>
                              router.navigate({
                                 to: "/onboarding",
                                 search: { new: true },
                              })
                           }
                        >
                           <Plus className="size-4" />
                           Nova organização
                        </DropdownMenuItem>
                     </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/settings/organization/general"
                     >
                        <Settings className="size-4" />
                        Configurações da organização
                     </Link>
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

export function SidebarScopeSwitcher() {
   return (
      <QueryBoundary
         errorTitle="Erro ao carregar menu"
         fallback={<SidebarScopeSwitcherSkeleton />}
      >
         <SidebarScopeSwitcherContent />
      </QueryBoundary>
   );
}
