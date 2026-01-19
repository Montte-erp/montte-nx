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
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
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
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { openPageTab } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { useSheet } from "@/hooks/use-sheet";
import { useSubmenu, type SubmenuConfig } from "./sidebar-submenu-context";

// ============================================
// Nav Item Actions Dropdown
// ============================================

type NavItemActionsDropdownProps = {
   url: string;
   pageKey: string;
   title: string;
};

function NavItemActionsDropdown({ url, pageKey, title }: NavItemActionsDropdownProps) {
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
         <DropdownMenuContent side="right" align="start" className="min-w-48">
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

   // Extract slug from pathname for navigation
   const slug = pathname.split("/")[1] || "";

   const isActive = (url: string) => {
      if (!url) return false;

      const resolvedUrl = url.replace("$slug", slug);

      if (resolvedUrl.includes("?")) {
         const [path, params] = resolvedUrl.split("?");
         return pathname === path && searchStr === `?${params}`;
      }

      return pathname === resolvedUrl && !searchStr;
   };

   // Check if any settings sub-item is active
   const isSettingsActive = () => {
      const settingsUrls = [
         "/$slug/categories",
         "/$slug/cost-centers",
         "/$slug/tags",
      ];
      return settingsUrls.some((url) => isActive(url));
   };

   // Finance section - core financial management
   const financeItems = [
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
   ];

   // Settings sub-items - categorization only
   const settingsItems = [
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
   ];

   // Submenu configurations
   const reportsConfig: SubmenuConfig = {
      id: "reports",
      title: "Análises",
      icon: BarChart3,
      isDynamic: true, // Flag for dynamic content with search, tree view, sorting
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
   };

   const planningConfig: SubmenuConfig = {
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
   };

   const categorizationConfig: SubmenuConfig = {
      id: "categorization",
      title: "Categorização",
      icon: Settings2,
      items: settingsItems,
   };

   const handleSubmenuTrigger = useCallback(
      (config: SubmenuConfig, ref: React.RefObject<HTMLButtonElement | null>) => {
         if (ref.current) {
            toggleSubmenu(config, ref.current);
         }
      },
      [toggleSubmenu],
   );

   const renderNavItem = (item: {
      icon: typeof TrendingUp;
      id: string;
      title: string;
      url: string;
   }) => {
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
            <NavItemActionsDropdown url={resolvedUrl} pageKey={item.id} title={item.title} />
         </SidebarMenuItem>
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
                  <NavItemActionsDropdown url={`/${slug}/transactions`} pageKey="transactions" title="Fluxo de Caixa" />
               </SidebarMenuItem>
            </SidebarMenu>

            {/* Reports Section - Flyout submenu */}
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton
                     ref={reportsRef}
                     className={cn(
                        isActive("/$slug/dashboards") ||
                           isActive("/$slug/insights")
                           ? "bg-primary/10 text-primary rounded-lg"
                           : "",
                        activeSubmenu === "reports" &&
                           "bg-sidebar-accent text-sidebar-accent-foreground",
                     )}
                     tooltip="Análises"
                     onClick={() =>
                        handleSubmenuTrigger(reportsConfig, reportsRef)
                     }
                  >
                     <BarChart3 />
                     <span>Análises</span>
                     <ChevronRight className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
               </SidebarMenuItem>
            </SidebarMenu>

            {/* Planning Section - Flyout submenu */}
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton
                     ref={planningRef}
                     className={cn(
                        isActive("/$slug/goals") || isActive("/$slug/budgets")
                           ? "bg-primary/10 text-primary rounded-lg"
                           : "",
                        activeSubmenu === "planning" &&
                           "bg-sidebar-accent text-sidebar-accent-foreground",
                     )}
                     tooltip="Planejamento"
                     onClick={() =>
                        handleSubmenuTrigger(planningConfig, planningRef)
                     }
                  >
                     <Target />
                     <span>Planejamento</span>
                     <ChevronRight className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
               </SidebarMenuItem>
            </SidebarMenu>

            {/* Categorização Section - Flyout submenu */}
            <SidebarMenu>
               <SidebarMenuItem>
                  <SidebarMenuButton
                     ref={categorizationRef}
                     className={cn(
                        isSettingsActive()
                           ? "bg-primary/10 text-primary rounded-lg"
                           : "",
                        activeSubmenu === "categorization" &&
                           "bg-sidebar-accent text-sidebar-accent-foreground",
                     )}
                     tooltip="Categorização"
                     onClick={() =>
                        handleSubmenuTrigger(categorizationConfig, categorizationRef)
                     }
                  >
                     <Settings2 />
                     <span>Categorização</span>
                     <ChevronRight className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
               </SidebarMenuItem>
            </SidebarMenu>

            {/* Finance Section */}
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
