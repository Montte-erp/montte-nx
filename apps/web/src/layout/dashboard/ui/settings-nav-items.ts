import type { LucideIcon } from "lucide-react";
import {
   AlertTriangle,
   Box,
   Contact2,
   CreditCard,
   DollarSign,
   FlaskConical,
   Network,
   Package,
   Palette,
   Settings2,
   Shield,
   Sparkles,
   User,
   Users,
} from "lucide-react";
import type { FeatureFlagKey } from "@core/posthog/config";

export type SettingsNavItemDef = {
   id: string;
   title: string;
   href: string;
   icon?: LucideIcon;
   external?: boolean;
   danger?: boolean;
   earlyAccessFlag?: FeatureFlagKey;
   children?: SettingsNavItemDef[];
};

export type SettingsNavSection = {
   id: string;
   label: string;
   defaultOpen: boolean;
   items: SettingsNavItemDef[];
};

export const settingsNavSections: SettingsNavSection[] = [
   {
      id: "project",
      label: "Espaço",
      defaultOpen: true,
      items: [
         {
            id: "project-general",
            title: "Geral",
            href: "/$slug/$teamSlug/settings/project/general",
            icon: Settings2,
         },
         {
            id: "project-modules",
            title: "Módulos",
            href: "/$slug/$teamSlug/settings/project/modules",
            icon: Box,
            children: [
               {
                  id: "module-financeiro",
                  title: "Financeiro",
                  href: "/$slug/$teamSlug/settings/project/products/financeiro",
                  icon: DollarSign,
               },
               {
                  id: "module-estoque",
                  title: "Estoque",
                  href: "/$slug/$teamSlug/settings/project/products/estoque",
                  icon: Package,
                  earlyAccessFlag: "produtos-estoque",
               },
               {
                  id: "module-contatos",
                  title: "Contatos",
                  href: "/$slug/$teamSlug/settings/project/products/contatos",
                  icon: Contact2,
                  earlyAccessFlag: "contatos",
               },
               {
                  id: "module-assistente-ia",
                  title: "Assistente IA",
                  href: "/$slug/$teamSlug/settings/project/products/ai-agents",
                  icon: Sparkles,
                  earlyAccessFlag: "analises-avancadas",
               },
            ],
         },
         {
            id: "project-integrations",
            title: "Integrações",
            href: "/$slug/$teamSlug/settings/project/integrations",
            icon: Network,
         },
         {
            id: "project-danger-zone",
            title: "Zona de perigo",
            href: "/$slug/$teamSlug/settings/project/danger-zone",
            icon: AlertTriangle,
            danger: true,
         },
      ],
   },
   {
      id: "organization",
      label: "Organização",
      defaultOpen: true,
      items: [
         {
            id: "org-general",
            title: "Geral",
            href: "/$slug/$teamSlug/settings/organization/general",
            icon: Settings2,
         },
         {
            id: "org-members",
            title: "Membros",
            href: "/$slug/$teamSlug/settings/organization/members",
            icon: Users,
         },
         {
            id: "org-billing",
            title: "Faturamento",
            href: "/$slug/$teamSlug/billing",
            icon: CreditCard,
            external: true,
         },
         {
            id: "org-danger-zone",
            title: "Zona de perigo",
            href: "/$slug/$teamSlug/settings/organization/danger-zone",
            icon: AlertTriangle,
            danger: true,
         },
      ],
   },
   {
      id: "account",
      label: "Conta",
      defaultOpen: true,
      items: [
         {
            id: "account-profile",
            title: "Perfil",
            href: "/$slug/$teamSlug/settings/profile",
            icon: User,
         },
         {
            id: "account-security",
            title: "Segurança",
            href: "/$slug/$teamSlug/settings/security",
            icon: Shield,
         },
         {
            id: "account-feature-previews",
            title: "Prévias de funcionalidades",
            href: "/$slug/$teamSlug/settings/feature-previews",
            icon: FlaskConical,
         },
         {
            id: "account-customization",
            title: "Personalização",
            href: "/$slug/$teamSlug/settings/customization",
            icon: Palette,
         },
         {
            id: "account-danger-zone",
            title: "Zona de perigo",
            href: "/$slug/$teamSlug/settings/danger-zone",
            icon: AlertTriangle,
            danger: true,
         },
      ],
   },
];
