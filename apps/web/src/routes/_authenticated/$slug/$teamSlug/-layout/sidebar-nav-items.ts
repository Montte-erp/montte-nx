import type { LucideIcon } from "lucide-react";
import {
   ArrowLeftRight,
   Building2,
   CreditCard,
   Inbox,
   Tag,
   Tags,
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
];
