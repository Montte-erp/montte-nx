import type { LucideIcon } from "lucide-react";
import {
   ArrowLeftRight,
   Building2,
   CreditCard,
   Database,
   House,
   LayoutDashboard,
   Lightbulb,
   Receipt,
   Sparkles,
   Tag,
   Tags,
   Target,
   Users,
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
            id: "credit-cards",
            label: "Cartões de Crédito",
            icon: CreditCard,
            route: "/$slug/$teamSlug/finance/credit-cards",
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
         {
            id: "goals",
            label: "Metas",
            icon: Target,
            route: "/$slug/$teamSlug/finance/goals",
         },
         {
            id: "bills",
            label: "Contas",
            icon: Receipt,
            route: "/$slug/$teamSlug/finance/bills",
         },
      ],
   },
   {
      id: "erp",
      label: "ERP",
      items: [
         {
            id: "contacts",
            label: "Contatos",
            icon: Users,
            route: "/$slug/$teamSlug/finance/contacts",
            earlyAccessFlag: "contacts",
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
            earlyAccessFlag: "advanced-analytics",
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            route: "/$slug/$teamSlug/analytics/insights",
            earlyAccessFlag: "advanced-analytics",
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            route: "/$slug/$teamSlug/analytics/data-management",
            subPanel: "data-management",
            earlyAccessFlag: "advanced-analytics",
         },
      ],
   },
];
