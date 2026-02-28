import type { LucideIcon } from "lucide-react";
import {
   ArrowLeftRight,
   Building2,
   Database,
   House,
   LayoutDashboard,
   Lightbulb,
   Sparkles,
   Tag,
   Tags,
} from "lucide-react";
import type { SubSidebarSection } from "../hooks/use-sidebar-nav";

export type NavItemAction = {
   type: "create";
   /** Route to navigate to for creation, or "sheet" to open a create sheet */
   target: "navigate" | "sheet" | "sub-menu";
};

export type NavItemDef = {
   id: string;
   label: string;
   icon: LucideIcon;
   route: string;
   /** Show a '+' quick-action button */
   quickAction?: NavItemAction;
   /** Item expands a floating sub-panel */
   subPanel?: SubSidebarSection;
   /** PostHog early access flag key — if set, item is hidden when user is not enrolled */
   earlyAccessFlag?: string;
   /** Stage of the early access feature, used to render the correct badge (override when PostHog feature is missing) */
   earlyAccessStage?: "alpha" | "beta" | "concept" | "general-availability";
};

export type NavGroupDef = {
   id: string;
   label?: string;
   icon?: LucideIcon;
   items: NavItemDef[];
};

export const navGroups: NavGroupDef[] = [
   {
      id: "finance",
      label: "Finanças",
      items: [
         {
            id: "transactions",
            label: "Transações",
            icon: ArrowLeftRight,
            route: "/$slug/$teamSlug/finance/transactions",
         },
         {
            id: "bank-accounts",
            label: "Contas Bancárias",
            icon: Building2,
            route: "/$slug/$teamSlug/finance/bank-accounts",
         },
         {
            id: "categories",
            label: "Categorias",
            icon: Tag,
            route: "/$slug/$teamSlug/finance/categories",
         },
         {
            id: "tags",
            label: "Tags",
            icon: Tags,
            route: "/$slug/$teamSlug/finance/tags",
         },
      ],
   },
   {
      id: "main",
      items: [
         {
            id: "home",
            label: "Inicio",
            icon: House,
            route: "/$slug/$teamSlug/home",
         },
         {
            id: "chat",
            label: "Montte AI",
            icon: Sparkles,
            route: "/$slug/$teamSlug/chat",
         },
         {
            id: "dashboards",
            label: "Dashboards",
            icon: LayoutDashboard,
            route: "/$slug/$teamSlug/analytics/dashboards",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "dashboards",
            earlyAccessFlag: "dashboards",
            earlyAccessStage: "beta" as const,
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            route: "/$slug/$teamSlug/analytics/insights",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "insights",
            earlyAccessFlag: "insights",
            earlyAccessStage: "beta" as const,
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            route: "/$slug/$teamSlug/analytics/data-management",
            quickAction: { type: "create", target: "sub-menu" },
            subPanel: "data-management",
            earlyAccessFlag: "data-management",
            earlyAccessStage: "beta" as const,
         },
      ],
   },
];
