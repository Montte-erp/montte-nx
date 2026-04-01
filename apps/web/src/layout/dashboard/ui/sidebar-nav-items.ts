import type { LucideIcon } from "lucide-react";
import {
   ArrowLeftRight,
   Briefcase,
   Building2,
   CreditCard,
   Database,
   House,
   LayoutDashboard,
   Lightbulb,
   Package,
   Receipt,
   Tag,
   Tags,
   Target,
   Users,
} from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";
import type { SubSidebarSection } from "../hooks/use-sidebar-nav";

type Modulo = Outputs["organizationConfig"]["getModules"][number]["modulo"];

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
   /** Fallback stage shown when PostHog hasn't resolved the feature yet */
   earlyAccessFallbackStage?:
      | "alpha"
      | "beta"
      | "concept"
      | "general-availability";
   /** Whether the item can be hidden by the user via sidebar visibility settings */
   configurable?: boolean;
   moduleKey?: Modulo;
};

export type NavGroupDef = {
   id: string;
   label?: string;
   icon?: LucideIcon;
   items: NavItemDef[];
};

export const navGroups: NavGroupDef[] = [
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
            id: "dashboards",
            label: "Dashboards",
            icon: LayoutDashboard,
            route: "/$slug/$teamSlug/analytics/dashboards",
            earlyAccessFlag: "advanced-analytics",
            moduleKey: "RELATORIOS",
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            route: "/$slug/$teamSlug/analytics/insights",
            earlyAccessFlag: "advanced-analytics",
            moduleKey: "RELATORIOS",
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            route: "/$slug/$teamSlug/analytics/data-management",
            subPanel: "data-management",
            earlyAccessFlag: "data-management",
            earlyAccessFallbackStage: "concept",
         },
      ],
   },
   {
      id: "finance",
      label: "Finanças",
      items: [
         {
            id: "transactions",
            label: "Lançamentos",
            icon: ArrowLeftRight,
            route: "/$slug/$teamSlug/transactions",
            quickAction: { type: "create", target: "sheet" },
            configurable: true,
         },
         {
            id: "bank-accounts",
            label: "Contas Bancárias",
            icon: Building2,
            route: "/$slug/$teamSlug/bank-accounts",
            configurable: true,
            moduleKey: "CONTAS",
         },
         {
            id: "credit-cards",
            label: "Cartões de Crédito",
            icon: CreditCard,
            route: "/$slug/$teamSlug/credit-cards",
            configurable: true,
            moduleKey: "CARTOES",
         },
         {
            id: "categories",
            label: "Categorias",
            icon: Tag,
            route: "/$slug/$teamSlug/categories",
            configurable: true,
         },
         {
            id: "tags",
            label: "Tags",
            icon: Tags,
            route: "/$slug/$teamSlug/tags",
            configurable: true,
         },
         {
            id: "goals",
            label: "Metas",
            icon: Target,
            route: "/$slug/$teamSlug/goals",
            configurable: true,
            moduleKey: "PLANEJAMENTO",
         },
         {
            id: "bills",
            label: "Contas a Pagar/Receber",
            icon: Receipt,
            route: "/$slug/$teamSlug/bills",
            configurable: true,
         },
      ],
   },
   {
      id: "erp",
      label: "Negócio",
      items: [
         {
            id: "contacts",
            label: "Contatos",
            icon: Users,
            route: "/$slug/$teamSlug/contacts",
            earlyAccessFlag: "contacts",
            moduleKey: "CONTATOS",
         },
         {
            id: "inventory",
            label: "Estoque",
            icon: Package,
            route: "/$slug/$teamSlug/inventory",
            quickAction: { type: "create", target: "sheet" },
            configurable: true,
            earlyAccessFlag: "inventory",
            moduleKey: "ESTOQUE",
         },
         {
            id: "services",
            label: "Serviços",
            icon: Briefcase,
            route: "/$slug/$teamSlug/erp/services",
            earlyAccessFlag: "services",
            moduleKey: "SERVICOS",
         },
      ],
   },
];
