import type { LucideIcon } from "lucide-react";
import {
   Building,
   Building2,
   FileText,
   FolderKanban,
   Landmark,
   Percent,
   Receipt,
   Search,
   Settings,
   Sparkles,
   Tag,
   Target,
   TrendingUp,
   Users,
   Wallet,
   Zap,
} from "lucide-react";
import { z } from "zod";
import {
   type PlanFeatures,
   usePlanFeatures,
} from "@/features/billing/lib/use-plan-features";

// ============================================
// Schemas
// ============================================

export const routeKeySchema = z.enum([
   "transactions",
   "bank-accounts",
   "bills",
   "counterparties",
   "dashboards",
   "insights",
   "goals",
   "budgets",
   "categories",
   "cost-centers",
   "tags",
   "interest-templates",
   "automations",
   "search",
   "settings",
   "organization",
]);

// ============================================
// Types (RouteConfig contains LucideIcon - can't be full Zod)
// ============================================

export type RouteKey = z.infer<typeof routeKeySchema>;

export type RouteConfig = {
   key: RouteKey;
   name: string;
   url: string;
   icon: LucideIcon;
   iconBg: string;
   iconColor: string;
   section?: "main" | "reports" | "planning" | "settings" | "finance";
   featureGate?: keyof PlanFeatures;
};

// RouteTabInfo - subset of RouteConfig for tab bar display
export type RouteTabInfo = Pick<
   RouteConfig,
   "name" | "icon" | "iconBg" | "iconColor"
>;

// ============================================
// Route Definitions (Static Data)
// ============================================

export const ROUTE_CONFIGS: RouteConfig[] = [
   // Main
   {
      key: "transactions",
      name: "Fluxo de Caixa",
      url: "/$slug/transactions",
      icon: TrendingUp,
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-500",
      section: "main",
   },
   // Reports
   {
      key: "dashboards",
      name: "Dashboards",
      url: "/$slug/dashboards",
      icon: FolderKanban,
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-500",
      section: "reports",
   },
   {
      key: "insights",
      name: "Insights",
      url: "/$slug/insights",
      icon: Sparkles,
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-500",
      section: "reports",
   },
   // Planning
   {
      key: "goals",
      name: "Metas",
      url: "/$slug/goals",
      icon: Target,
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-500",
      section: "planning",
   },
   {
      key: "budgets",
      name: "Orcamentos",
      url: "/$slug/budgets",
      icon: Wallet,
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-500",
      section: "planning",
   },
   // Finance
   {
      key: "bank-accounts",
      name: "Contas Bancarias",
      url: "/$slug/bank-accounts",
      icon: Building2,
      iconBg: "bg-indigo-500/20",
      iconColor: "text-indigo-500",
      section: "finance",
   },
   {
      key: "bills",
      name: "Contas a Pagar",
      url: "/$slug/bills",
      icon: Receipt,
      iconBg: "bg-orange-500/20",
      iconColor: "text-orange-500",
      section: "finance",
   },
   {
      key: "counterparties",
      name: "Cadastros",
      url: "/$slug/counterparties",
      icon: Users,
      iconBg: "bg-pink-500/20",
      iconColor: "text-pink-500",
      section: "finance",
      featureGate: "canAccessCounterparties",
   },
   // Settings/Categorization
   {
      key: "categories",
      name: "Categorias",
      url: "/$slug/categories",
      icon: FileText,
      iconBg: "bg-slate-500/20",
      iconColor: "text-slate-500",
      section: "settings",
   },
   {
      key: "cost-centers",
      name: "Centros de Custo",
      url: "/$slug/cost-centers",
      icon: Landmark,
      iconBg: "bg-teal-500/20",
      iconColor: "text-teal-500",
      section: "settings",
      featureGate: "canAccessCostCenters",
   },
   {
      key: "tags",
      name: "Tags",
      url: "/$slug/tags",
      icon: Tag,
      iconBg: "bg-violet-500/20",
      iconColor: "text-violet-500",
      section: "settings",
   },
   {
      key: "interest-templates",
      name: "Modelos de Juros",
      url: "/$slug/interest-templates",
      icon: Percent,
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-500",
      section: "settings",
      featureGate: "canAccessInterestTemplates",
   },
   {
      key: "automations",
      name: "Automacoes",
      url: "/$slug/automations",
      icon: Zap,
      iconBg: "bg-yellow-500/20",
      iconColor: "text-yellow-500",
      section: "settings",
      featureGate: "canAccessAutomations",
   },
   // Special
   {
      key: "search",
      name: "Busca",
      url: "/$slug/search",
      icon: Search,
      iconBg: "bg-green-500/20",
      iconColor: "text-green-500",
   },
   {
      key: "settings",
      name: "Configurações",
      url: "/$slug/settings",
      icon: Settings,
      iconBg: "bg-gray-500/20",
      iconColor: "text-gray-500",
   },
   {
      key: "organization",
      name: "Organização",
      url: "/$slug/organization",
      icon: Building,
      iconBg: "bg-sky-500/20",
      iconColor: "text-sky-500",
   },
];

// ============================================
// Route Tab Map (for backward compatibility)
// ============================================

export const ROUTE_TAB_MAP: Record<string, RouteTabInfo> = Object.fromEntries(
   ROUTE_CONFIGS.map((route) => [
      route.key,
      {
         name: route.name,
         icon: route.icon,
         iconBg: route.iconBg,
         iconColor: route.iconColor,
      },
   ]),
);

// ============================================
// Hook
// ============================================

export function useRoutes() {
   const planFeatures = usePlanFeatures();

   // Filter routes based on feature gates
   const availableRoutes = ROUTE_CONFIGS.filter((route) => {
      if (!route.featureGate) return true;
      return planFeatures[route.featureGate] === true;
   });

   // Get routes by section
   const getRoutesBySection = (section: RouteConfig["section"]) =>
      availableRoutes.filter((r) => r.section === section);

   // Get route info by key (for tab display)
   const getRouteByKey = (key: RouteKey) =>
      ROUTE_CONFIGS.find((r) => r.key === key);

   // Get route info from pathname
   const getRouteFromPathname = (pathname: string) => {
      const segments = pathname.split("/");
      const routeKey = segments[2] || "dashboards";
      return ROUTE_CONFIGS.find((r) => r.key === routeKey);
   };

   // Check if route is accessible
   const isRouteAccessible = (key: RouteKey) => {
      const route = ROUTE_CONFIGS.find((r) => r.key === key);
      if (!route?.featureGate) return true;
      return planFeatures[route.featureGate] === true;
   };

   return {
      allRoutes: ROUTE_CONFIGS,
      availableRoutes,
      getRoutesBySection,
      getRouteByKey,
      getRouteFromPathname,
      isRouteAccessible,
      // Convenience getters for sections
      mainRoutes: getRoutesBySection("main"),
      reportsRoutes: getRoutesBySection("reports"),
      planningRoutes: getRoutesBySection("planning"),
      financeRoutes: getRoutesBySection("finance"),
      settingsRoutes: getRoutesBySection("settings"),
   };
}

// ============================================
// Static helpers (for use outside React)
// ============================================

export function getRouteConfigByKey(key: RouteKey) {
   return ROUTE_CONFIGS.find((r) => r.key === key);
}

export function getRouteKeyFromPathname(pathname: string): RouteKey | null {
   const segments = pathname.split("/");
   const key = segments[2] || "dashboards";
   const validKey = routeKeySchema.safeParse(key);
   return validKey.success ? validKey.data : null;
}

/**
 * Get the tab display info for a given pathname
 * @param pathname - The current route pathname (e.g., "/org-slug/transactions")
 * @returns The route tab info or null if not found
 */
export function getRouteTabInfo(pathname: string): RouteTabInfo | null {
   const segments = pathname.split("/");
   const routeKey = segments[2] || "dashboards";

   return ROUTE_TAB_MAP[routeKey] || null;
}

/**
 * Get the route key from a pathname
 * @param pathname - The current route pathname
 * @returns The route key (e.g., "transactions", "bills")
 */
export function getRouteKey(pathname: string): string {
   const segments = pathname.split("/");
   return segments[2] || "dashboards";
}
