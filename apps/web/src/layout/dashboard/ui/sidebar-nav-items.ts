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
import type { SubSidebarSection } from "../hooks/use-sidebar-store";

export type NavItemAction = {
   type: "create";
   target: "navigate" | "sheet" | "sub-menu";
};

export type NavItemDef = {
   id: string;
   label: string;
   icon: LucideIcon;
   iconColor?: string;
   route: string;
   quickAction?: NavItemAction;
   subPanel?: SubSidebarSection;
   earlyAccessFlag?: string;
   earlyAccessFallbackStage?:
      | "alpha"
      | "beta"
      | "concept"
      | "general-availability";
   configurable?: boolean;
   children?: NavItemDef[];
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
            iconColor: "text-sky-500",
            route: "/$slug/$teamSlug/home",
         },
         {
            id: "dashboards",
            label: "Dashboards",
            icon: LayoutDashboard,
            iconColor: "text-violet-500",
            route: "/$slug/$teamSlug/analytics/dashboards",
            earlyAccessFlag: "analises-avancadas",
         },
         {
            id: "insights",
            label: "Insights",
            icon: Lightbulb,
            iconColor: "text-amber-500",
            route: "/$slug/$teamSlug/analytics/insights",
            earlyAccessFlag: "analises-avancadas",
         },
         {
            id: "data-management",
            label: "Dados",
            icon: Database,
            iconColor: "text-emerald-500",
            route: "/$slug/$teamSlug/analytics/data-management",
            subPanel: "data-management",
            earlyAccessFlag: "dados",
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
            iconColor: "text-blue-500",
            route: "/$slug/$teamSlug/transactions",
            quickAction: { type: "create", target: "sheet" },
            configurable: true,
         },
         {
            id: "bank-accounts",
            label: "Contas Bancárias",
            icon: Building2,
            iconColor: "text-indigo-500",
            route: "/$slug/$teamSlug/bank-accounts",
            configurable: true,
         },
         {
            id: "credit-cards",
            label: "Cartões de Crédito",
            icon: CreditCard,
            iconColor: "text-pink-500",
            route: "/$slug/$teamSlug/credit-cards",
            configurable: true,
         },
         {
            id: "categories",
            label: "Categorias",
            icon: Tag,
            iconColor: "text-orange-500",
            route: "/$slug/$teamSlug/categories",
            configurable: true,
         },
         {
            id: "tags",
            label: "Centros de Custo",
            icon: Tags,
            iconColor: "text-teal-500",
            route: "/$slug/$teamSlug/tags",
            configurable: true,
         },
         {
            id: "goals",
            label: "Metas",
            icon: Target,
            iconColor: "text-red-500",
            route: "/$slug/$teamSlug/goals",
            configurable: true,
         },
         {
            id: "bills",
            label: "Contas a Pagar/Receber",
            icon: Receipt,
            iconColor: "text-yellow-500",
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
            iconColor: "text-cyan-500",
            route: "/$slug/$teamSlug/contacts",
            configurable: true,
            earlyAccessFlag: "contatos",
         },
         {
            id: "inventory",
            label: "Estoque",
            icon: Package,
            iconColor: "text-lime-500",
            route: "/$slug/$teamSlug/inventory",
            quickAction: { type: "create", target: "sheet" },
            configurable: true,
            earlyAccessFlag: "produtos-estoque",
         },
         {
            id: "services",
            label: "Serviços",
            icon: Briefcase,
            iconColor: "text-rose-500",
            route: "/$slug/$teamSlug/erp/services",
            configurable: true,
            earlyAccessFlag: "gestao-de-servicos",
         },
      ],
   },
];
