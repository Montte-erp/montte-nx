import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarMenuSub,
   SidebarMenuSubButton,
   SidebarMenuSubItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
   BarChart3,
   Building2,
   ChevronDown,
   CirclePlus,
   FileText,
   FolderKanban,
   Home,
   Landmark,
   Percent,
   Receipt,
   Sparkles,
   Tag,
   TrendingUp,
   Users,
   Wallet,
   Zap,
} from "lucide-react";
import { useState } from "react";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useSheet } from "@/hooks/use-sheet";

export function NavMain() {
   const { openSheet } = useSheet();
   const { pathname, searchStr } = useLocation();
   const { setOpenMobile, state } = useSidebar();
   const [projectOpen, setProjectOpen] = useState(true);
   const {
      canAccessTags,
      canAccessCostCenters,
      canAccessCounterparties,
      canAccessInterestTemplates,
      canAccessAutomations,
   } = usePlanFeatures();

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

   // Top-level navigation (always visible)
   const topItems = [
      {
         icon: Home,
         id: "home",
         title: "Home",
         url: "/$slug/home",
      },
   ];

   // Analytics section
   const analyticsItems = [
      {
         icon: TrendingUp,
         id: "transactions",
         title: "Fluxo de caixa",
         url: "/$slug/transactions",
      },
      {
         icon: Wallet,
         id: "budgets",
         title: "Orçamentos",
         url: "/$slug/budgets",
      },
   ];

   // Finance section
   const financeItems = [
      {
         icon: Building2,
         id: "bank-accounts",
         title: "Contas Bancárias",
         url: "/$slug/bank-accounts",
      },
      {
         icon: Receipt,
         id: "bills-overview",
         title: "Gestão de Contas",
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
   ];

   // Organization section
   const organizationItems = [
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

   // Automation section
   const automationItems = canAccessAutomations
      ? [
           {
              icon: Zap,
              id: "automations",
              title: "Automações",
              url: "/$slug/automations",
           },
        ]
      : [];

   const renderNavItem = (item: {
      icon: typeof TrendingUp;
      id: string;
      title: string;
      url: string;
   }) => {
      const Icon = item.icon;

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

            {/* Top-level Navigation (Home) */}
            <SidebarMenu>
               {topItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Project Section - Collapsible with Dashboards and Insights */}
            <SidebarMenu>
               <Collapsible open={projectOpen} onOpenChange={setProjectOpen}>
                  <SidebarMenuItem>
                     <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                           tooltip="Projeto"
                           className={cn(
                              (isActive("/$slug/dashboards") || isActive("/$slug/insights"))
                                 ? "bg-primary/10 text-primary rounded-lg"
                                 : ""
                           )}
                        >
                           <FolderKanban />
                           <span>Projeto</span>
                           <ChevronDown
                              className={cn(
                                 "ml-auto h-4 w-4 transition-transform",
                                 projectOpen && "rotate-180"
                              )}
                           />
                        </SidebarMenuButton>
                     </CollapsibleTrigger>
                     <CollapsibleContent>
                        <SidebarMenuSub>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                 asChild
                                 isActive={isActive("/$slug/dashboards")}
                              >
                                 <Link
                                    onClick={() => setOpenMobile(false)}
                                    params={{ slug }}
                                    to="/$slug/dashboards"
                                 >
                                    <BarChart3 className="size-4" />
                                    <span>Dashboards</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                           <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                 asChild
                                 isActive={isActive("/$slug/insights")}
                              >
                                 <Link
                                    onClick={() => setOpenMobile(false)}
                                    params={{ slug }}
                                    to="/$slug/insights"
                                 >
                                    <Sparkles className="size-4" />
                                    <span>Insights</span>
                                 </Link>
                              </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                        </SidebarMenuSub>
                     </CollapsibleContent>
                  </SidebarMenuItem>
               </Collapsible>
            </SidebarMenu>

            {/* Analytics Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>Análise</SidebarGroupLabel>
            )}
            <SidebarMenu>
               {analyticsItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Finance Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>Finanças</SidebarGroupLabel>
            )}
            <SidebarMenu>
               {financeItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Organization Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>Organização</SidebarGroupLabel>
            )}
            <SidebarMenu>
               {organizationItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Automation Section */}
            {state === "expanded" && automationItems.length > 0 && (
               <SidebarGroupLabel>Automação</SidebarGroupLabel>
            )}
            {automationItems.length > 0 && (
               <SidebarMenu>
                  {automationItems.map((item) => renderNavItem(item))}
               </SidebarMenu>
            )}
         </SidebarGroupContent>
      </SidebarGroup>
   );
}
