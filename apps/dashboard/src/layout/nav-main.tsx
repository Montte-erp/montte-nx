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
   useSidebar,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
   BarChart3,
   Building2,
   ChevronRight,
   CirclePlus,
   Copy,
   ExternalLink,
   FileText,
   FolderKanban,
   Landmark,
   type LucideIcon,
   MoreHorizontal,
   PanelTop,
   Percent,
   Receipt,
   Settings2,
   Sparkles,
   Tag,
   Target,
   TrendingUp,
   Users,
   Wallet,
   Zap,
} from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { openPageTab } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useSheet } from "@/hooks/use-sheet";
import {
   type SubmenuConfig,
   type SubmenuId,
   useSubmenu,
} from "./sidebar-submenu-context";

type NavItem = {
   icon: LucideIcon;
   id: string;
   title: string;
   url: string;
};

type NavItemActionsDropdownProps = {
   url: string;
   pageKey: string;
   title: string;
};

function NavItemActionsDropdown({
   url,
   pageKey,
   title,
}: NavItemActionsDropdownProps) {
   const navigate = useNavigate();

   const handleOpenInNewTab = () => {
      openPageTab(pageKey, title);
      navigate({ to: url });
   };

   const handleOpenNewWindow = () => {
      window.open(url, "_blank");
   };

   const handleCopyLink = async () => {
      try {
         const fullUrl = `${window.location.origin}${url}`;
         await navigator.clipboard.writeText(fullUrl);
         toast.success("Link copiado");
      } catch {
         toast.error("Falha ao copiar o link");
      }
   };

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <SidebarMenuAction showOnHover>
               <MoreHorizontal />
               <span className="sr-only">Mais opções</span>
            </SidebarMenuAction>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="start" className="min-w-48" side="right">
            <DropdownMenuItem onClick={handleOpenInNewTab}>
               <PanelTop className="size-4 mr-2" />
               Abrir em nova aba
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenNewWindow}>
               <ExternalLink className="size-4 mr-2" />
               Abrir em nova janela
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
               <Copy className="size-4 mr-2" />
               Copiar link
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
   );
}

export function NavMain() {
   const { openSheet } = useSheet();
   const { pathname, searchStr } = useLocation();
   const { setOpenMobile, state } = useSidebar();
   const { toggleSubmenu, activeSubmenu } = useSubmenu();
   const {
      canAccessTags,
      canAccessCostCenters,
      canAccessCounterparties,
      canAccessInterestTemplates,
      canAccessAutomations,
   } = usePlanFeatures();

   const reportsRef = useRef<HTMLButtonElement>(null);
   const planningRef = useRef<HTMLButtonElement>(null);
   const categorizationRef = useRef<HTMLButtonElement>(null);

   const slug = pathname.split("/")[1] || "";

   const isActive = useCallback(
      (url: string) => {
         if (!url) return false;
         const resolvedUrl = url.replace("$slug", slug);

         if (resolvedUrl.includes("?")) {
            const [path, params] = resolvedUrl.split("?");
            return pathname === path && searchStr === `?${params}`;
         }

         return pathname === resolvedUrl && !searchStr;
      },
      [pathname, searchStr, slug],
   );

   const isAnyActive = useCallback(
      (urls: string[]) => urls.some(isActive),
      [isActive],
   );

   const financeItems: NavItem[] = useMemo(
      () => [
         {
            icon: Building2,
            id: "bank-accounts",
            title: "Contas Bancárias",
            url: "/$slug/bank-accounts",
         },
         {
            icon: Receipt,
            id: "bills",
            title: "Contas a Pagar",
            url: "/$slug/bills",
         },
         ...(canAccessCounterparties
            ? [
                 {
                    icon: Users,
                    id: "counterparties",
                    title: "Cadastros",
                    url: "/$slug/counterparties",
                 },
              ]
            : []),
         ...(canAccessInterestTemplates
            ? [
                 {
                    icon: Percent,
                    id: "interest-templates",
                    title: "Modelos de Juros",
                    url: "/$slug/interest-templates",
                 },
              ]
            : []),
         ...(canAccessAutomations
            ? [
                 {
                    icon: Zap,
                    id: "automations",
                    title: "Automações",
                    url: "/$slug/automations",
                 },
              ]
            : []),
      ],
      [
         canAccessCounterparties,
         canAccessInterestTemplates,
         canAccessAutomations,
      ],
   );

   const settingsItems: NavItem[] = useMemo(
      () => [
         {
            icon: FileText,
            id: "categories",
            title: "Categorias",
            url: "/$slug/categories",
         },
         ...(canAccessCostCenters
            ? [
                 {
                    icon: Landmark,
                    id: "cost-centers",
                    title: "Centros de Custo",
                    url: "/$slug/cost-centers",
                 },
              ]
            : []),
         ...(canAccessTags
            ? [
                 {
                    icon: Tag,
                    id: "tags",
                    title: "Tags",
                    url: "/$slug/tags",
                 },
              ]
            : []),
      ],
      [canAccessCostCenters, canAccessTags],
   );

   const submenuConfigs = useMemo(
      (): Record<SubmenuId, SubmenuConfig & { activeUrls: string[] }> => ({
         reports: {
            id: "reports",
            title: "Análises",
            icon: BarChart3,
            isDynamic: true,
            items: [
               {
                  id: "dashboards",
                  title: "Dashboards",
                  url: "/$slug/dashboards",
                  icon: FolderKanban,
               },
               {
                  id: "insights",
                  title: "Insights",
                  url: "/$slug/insights",
                  icon: Sparkles,
               },
            ],
            activeUrls: ["/$slug/dashboards", "/$slug/insights"],
         },
         planning: {
            id: "planning",
            title: "Planejamento",
            icon: Target,
            items: [
               {
                  id: "goals",
                  title: "Metas",
                  url: "/$slug/goals",
                  icon: Target,
               },
               {
                  id: "budgets",
                  title: "Orçamentos",
                  url: "/$slug/budgets",
                  icon: Wallet,
               },
            ],
            activeUrls: ["/$slug/goals", "/$slug/budgets"],
         },
         categorization: {
            id: "categorization",
            title: "Categorização",
            icon: Settings2,
            items: settingsItems,
            activeUrls: settingsItems.map((item) => item.url),
         },
      }),
      [settingsItems],
   );

   const handleSubmenuTrigger = useCallback(
      (
         config: SubmenuConfig,
         ref: React.RefObject<HTMLButtonElement | null>,
      ) => {
         if (ref.current) {
            toggleSubmenu(config, ref.current);
         }
      },
      [toggleSubmenu],
   );

   const renderNavItem = (item: NavItem) => {
      const Icon = item.icon;
      const resolvedUrl = item.url.replace("$slug", slug);

      return (
         <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
               asChild
               className={
                  isActive(item.url)
                     ? "bg-primary/10 text-primary rounded-lg"
                     : ""
               }
               tooltip={item.title}
            >
               <Link
                  onClick={() => setOpenMobile(false)}
                  params={{}}
                  to={item.url}
               >
                  <Icon />
                  <span>{item.title}</span>
               </Link>
            </SidebarMenuButton>
            <NavItemActionsDropdown
               pageKey={item.id}
               title={item.title}
               url={resolvedUrl}
            />
         </SidebarMenuItem>
      );
   };

   const renderSubmenuTrigger = (
      configKey: keyof typeof submenuConfigs,
      ref: React.RefObject<HTMLButtonElement | null>,
   ) => {
      const config = submenuConfigs[configKey];
      const Icon = config.icon;
      const isItemActive = isAnyActive(config.activeUrls);
      const isSubmenuOpen = activeSubmenu === config.id;

      return (
         <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton
                  className={cn(
                     isItemActive && "bg-primary/10 text-primary rounded-lg",
                     isSubmenuOpen &&
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                  )}
                  onClick={() => handleSubmenuTrigger(config, ref)}
                  ref={ref}
                  tooltip={config.title}
               >
                  <Icon />
                  <span>{config.title}</span>
                  <ChevronRight className="ml-auto h-4 w-4" />
               </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      );
   };

   return (
      <SidebarGroup className="group-data-[collapsible=icon]">
         <SidebarGroupContent className="flex flex-col gap-2">
            {/* Primary Action Button */}
            <SidebarMenu>
               <SidebarMenuButton
                  className="bg-primary text-primary-foreground cursor-pointer"
                  onClick={() =>
                     openSheet({ children: <ManageTransactionForm /> })
                  }
                  tooltip="Adicionar Nova Transação"
               >
                  <CirclePlus />
                  <span>Adicionar Nova Transação</span>
               </SidebarMenuButton>
            </SidebarMenu>

            {/* Transactions - Main feature */}
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton
                     asChild
                     className={
                        isActive("/$slug/transactions")
                           ? "bg-primary/10 text-primary rounded-lg"
                           : ""
                     }
                     tooltip="Fluxo de Caixa"
                  >
                     <Link
                        onClick={() => setOpenMobile(false)}
                        params={{ slug }}
                        to="/$slug/transactions"
                     >
                        <TrendingUp />
                        <span>Fluxo de Caixa</span>
                     </Link>
                  </SidebarMenuButton>
                  <NavItemActionsDropdown
                     pageKey="transactions"
                     title="Fluxo de Caixa"
                     url={`/${slug}/transactions`}
                  />
               </SidebarMenuItem>
            </SidebarMenu>

            {renderSubmenuTrigger("reports", reportsRef)}
            {renderSubmenuTrigger("planning", planningRef)}
            {renderSubmenuTrigger("categorization", categorizationRef)}

            {state === "expanded" && (
               <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            )}
            <SidebarMenu>
               {financeItems.map((item) => renderNavItem(item))}
            </SidebarMenu>
         </SidebarGroupContent>
      </SidebarGroup>
   );
}
