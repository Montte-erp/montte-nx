import { translate } from "@packages/localization";
import {
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import {
   BarChart3,
   Building2,
   CirclePlus,
   FileText,
   Home,
   Landmark,
   Percent,
   Receipt,
   Tag,
   TrendingUp,
   Users,
   Wallet,
   Zap,
} from "lucide-react";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { useSheet } from "@/hooks/use-sheet";

export function NavMain() {
   const { openSheet } = useSheet();
   const { pathname, searchStr } = useLocation();
   const { setOpenMobile, state } = useSidebar();
   const {
      canAccessTags,
      canAccessCostCenters,
      canAccessCounterparties,
      canAccessInterestTemplates,
      canAccessAutomations,
   } = usePlanFeatures();

   const isActive = (url: string) => {
      if (!url) return false;

      const resolvedUrl = url.replace("$slug", pathname.split("/")[1] || "");

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
         title: translate("dashboard.layout.nav-main.home"),
         url: "/$slug/home",
      },
   ];

   // Analytics section
   const analyticsItems = [
      {
         icon: TrendingUp,
         id: "transactions",
         title: translate("dashboard.layout.nav-main.finance.overview"),
         url: "/$slug/transactions",
      },
      {
         icon: BarChart3,
         id: "dashboards",
         title: translate("dashboard.layout.nav-main.finance.dashboards"),
         url: "/$slug/dashboards",
      },
      {
         icon: Wallet,
         id: "budgets",
         title: translate("dashboard.layout.nav-main.finance.budgets"),
         url: "/$slug/budgets",
      },
   ];

   // Finance section
   const financeItems = [
      {
         icon: Building2,
         id: "bank-accounts",
         title: translate("dashboard.routes.bank-accounts.list-section.title"),
         url: "/$slug/bank-accounts",
      },
      {
         icon: Receipt,
         id: "bills-overview",
         title: translate("dashboard.layout.nav-main.bills.overview"),
         url: "/$slug/bills",
      },
      ...(canAccessCounterparties
         ? [
              {
                 icon: Users,
                 id: "counterparties",
                 title: translate(
                    "dashboard.layout.nav-main.bills.counterparties",
                 ),
                 url: "/$slug/counterparties",
              },
           ]
         : []),
      ...(canAccessInterestTemplates
         ? [
              {
                 icon: Percent,
                 id: "interest-templates",
                 title: translate(
                    "dashboard.layout.nav-main.bills.interest-templates",
                 ),
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
         title: translate(
            "dashboard.layout.nav-main.categorization.categories",
         ),
         url: "/$slug/categories",
      },
      ...(canAccessCostCenters
         ? [
              {
                 icon: Landmark,
                 id: "cost-centers",
                 title: translate(
                    "dashboard.layout.nav-main.categorization.cost-centers",
                 ),
                 url: "/$slug/cost-centers",
              },
           ]
         : []),
      ...(canAccessTags
         ? [
              {
                 icon: Tag,
                 id: "tags",
                 title: translate(
                    "dashboard.layout.nav-main.categorization.tags",
                 ),
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
                  tooltip={translate(
                     "dashboard.routes.transactions.features.add-new.title",
                  )}
               >
                  <CirclePlus />
                  <span>
                     {translate(
                        "dashboard.routes.transactions.features.add-new.title",
                     )}
                  </span>
               </SidebarMenuButton>
            </SidebarMenu>

            {/* Top-level Navigation (Home) */}
            <SidebarMenu>
               {topItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Analytics Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>
                  {translate("dashboard.layout.nav-main.analytics.title")}
               </SidebarGroupLabel>
            )}
            <SidebarMenu>
               {analyticsItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Finance Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>
                  {translate("dashboard.layout.nav-main.finance.title")}
               </SidebarGroupLabel>
            )}
            <SidebarMenu>
               {financeItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Organization Section */}
            {state === "expanded" && (
               <SidebarGroupLabel>
                  {translate("dashboard.layout.nav-main.organization.title")}
               </SidebarGroupLabel>
            )}
            <SidebarMenu>
               {organizationItems.map((item) => renderNavItem(item))}
            </SidebarMenu>

            {/* Automation Section */}
            {state === "expanded" && automationItems.length > 0 && (
               <SidebarGroupLabel>
                  {translate("dashboard.layout.nav-main.automation.title")}
               </SidebarGroupLabel>
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
