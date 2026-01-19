import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Building2,
	FileText,
	FolderKanban,
	Home,
	Landmark,
	Percent,
	Receipt,
	Search,
	Sparkles,
	Tag,
	Target,
	TrendingUp,
	Users,
	Wallet,
	Zap,
} from "lucide-react";

export type RouteTabInfo = {
	name: string;
	icon: LucideIcon;
	iconBg: string;
	iconColor: string;
};

// Map route patterns to tab display info
export const ROUTE_TAB_MAP: Record<string, RouteTabInfo> = {
	// Main routes
	home: {
		name: "Home",
		icon: Home,
		iconBg: "bg-blue-500/20",
		iconColor: "text-blue-500",
	},
	transactions: {
		name: "Transacoes",
		icon: TrendingUp,
		iconBg: "bg-emerald-500/20",
		iconColor: "text-emerald-500",
	},
	"bank-accounts": {
		name: "Contas Bancarias",
		icon: Building2,
		iconBg: "bg-indigo-500/20",
		iconColor: "text-indigo-500",
	},
	bills: {
		name: "Contas a Pagar",
		icon: Receipt,
		iconBg: "bg-orange-500/20",
		iconColor: "text-orange-500",
	},
	counterparties: {
		name: "Cadastros",
		icon: Users,
		iconBg: "bg-pink-500/20",
		iconColor: "text-pink-500",
	},

	// Reports
	dashboards: {
		name: "Dashboards",
		icon: FolderKanban,
		iconBg: "bg-purple-500/20",
		iconColor: "text-purple-500",
	},
	insights: {
		name: "Insights",
		icon: Sparkles,
		iconBg: "bg-blue-500/20",
		iconColor: "text-blue-500",
	},

	// Planning
	goals: {
		name: "Metas",
		icon: Target,
		iconBg: "bg-cyan-500/20",
		iconColor: "text-cyan-500",
	},
	budgets: {
		name: "Orcamentos",
		icon: Wallet,
		iconBg: "bg-amber-500/20",
		iconColor: "text-amber-500",
	},

	// Settings
	categories: {
		name: "Categorias",
		icon: FileText,
		iconBg: "bg-slate-500/20",
		iconColor: "text-slate-500",
	},
	"cost-centers": {
		name: "Centros de Custo",
		icon: Landmark,
		iconBg: "bg-teal-500/20",
		iconColor: "text-teal-500",
	},
	tags: {
		name: "Tags",
		icon: Tag,
		iconBg: "bg-violet-500/20",
		iconColor: "text-violet-500",
	},
	"interest-templates": {
		name: "Modelos de Juros",
		icon: Percent,
		iconBg: "bg-rose-500/20",
		iconColor: "text-rose-500",
	},
	automations: {
		name: "Automacoes",
		icon: Zap,
		iconBg: "bg-yellow-500/20",
		iconColor: "text-yellow-500",
	},

	// Special
	search: {
		name: "Search",
		icon: Search,
		iconBg: "bg-green-500/20",
		iconColor: "text-green-500",
	},
};

/**
 * Get the tab display info for a given pathname
 * @param pathname - The current route pathname (e.g., "/org-slug/transactions")
 * @returns The route tab info or null if not found
 */
export function getRouteTabInfo(pathname: string): RouteTabInfo | null {
	// Extract the route segment after /$slug/
	// pathname: /org-slug/transactions => segments = ["", "org-slug", "transactions"]
	const segments = pathname.split("/");
	const routeKey = segments[2] || "home";

	return ROUTE_TAB_MAP[routeKey] || null;
}

/**
 * Get the route key from a pathname
 * @param pathname - The current route pathname
 * @returns The route key (e.g., "transactions", "bills")
 */
export function getRouteKey(pathname: string): string {
	const segments = pathname.split("/");
	return segments[2] || "home";
}
