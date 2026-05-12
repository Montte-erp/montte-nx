import type { LucideIcon } from "lucide-react";
import {
   ArrowLeftRight,
   Briefcase,
   Building2,
   CreditCard,
   Gauge,
   Gift,
   Inbox,
   Tag,
   Tags,
   Users,
} from "lucide-react";
export type NavItemDef = {
   id: string;
   label: string;
   icon: LucideIcon;
   iconColor?: string;
   route: string;
   earlyAccessFlag?: string;
   earlyAccessFallbackStage?:
      | "alpha"
      | "beta"
      | "concept"
      | "general-availability";
   configurable?: boolean;
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
            id: "inbox",
            label: "Inbox",
            icon: Inbox,
            iconColor: "text-sky-500",
            route: "/$slug/$teamSlug/inbox",
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
      ],
   },
   {
      id: "services",
      label: "Serviços",
      items: [
         {
            id: "services",
            label: "Catálogo",
            icon: Briefcase,
            iconColor: "text-emerald-500",
            route: "/$slug/$teamSlug/services",
            configurable: true,
            earlyAccessFlag: "servicos-catalogo",
         },
         {
            id: "meters",
            label: "Medidores",
            icon: Gauge,
            iconColor: "text-emerald-500",
            route: "/$slug/$teamSlug/services/meters",
            configurable: true,
            earlyAccessFlag: "servicos-medidores",
         },
         {
            id: "benefits",
            label: "Benefícios",
            icon: Gift,
            iconColor: "text-emerald-500",
            route: "/$slug/$teamSlug/services/benefits",
            configurable: true,
            earlyAccessFlag: "servicos-beneficios",
         },
         {
            id: "coupons",
            label: "Cupons",
            icon: Tag,
            iconColor: "text-emerald-500",
            route: "/$slug/$teamSlug/services/coupons",
            configurable: true,
            earlyAccessFlag: "servicos-cupons",
         },
      ],
   },
];
