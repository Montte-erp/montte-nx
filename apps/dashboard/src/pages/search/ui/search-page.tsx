import { Input } from "@packages/ui/components/input";
import { Separator } from "@packages/ui/components/separator";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	BarChart3,
	LayoutDashboard,
	LineChart,
	Loader2,
	Search,
	Sparkles,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CreateNewCard } from "@/features/dashboard/ui/create-new-card";
import {
	openDashboardTab,
	openInsightTab,
	useDashboardTabs,
} from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

// Helper function to format relative timestamps like PostHog
function formatRelativeTime(date: Date | string): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins} min ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 4)
		return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
	return d.toLocaleDateString();
}

// Quick create options for the grid layout
const QUICK_CREATE_OPTIONS = [
	{
		value: "dashboard",
		label: "New Dashboard",
		description: "Create an empty dashboard",
		icon: LayoutDashboard,
		iconColor: "text-purple-600 dark:text-purple-400",
		iconBg: "bg-purple-500/15",
	},
	{
		value: "line",
		label: "Line Chart",
		description: "Track trends over time",
		icon: LineChart,
		iconColor: "text-blue-600 dark:text-blue-400",
		iconBg: "bg-blue-500/15",
	},
	{
		value: "bar",
		label: "Bar Chart",
		description: "Compare categories",
		icon: BarChart3,
		iconColor: "text-green-600 dark:text-green-400",
		iconBg: "bg-green-500/15",
	},
	{
		value: "stat_card",
		label: "Stat Card",
		description: "Single metric with trend",
		icon: TrendingUp,
		iconColor: "text-orange-600 dark:text-orange-400",
		iconBg: "bg-orange-500/15",
	},
] as const;

export function SearchPage() {
	const { activeOrganization } = useActiveOrganization();
	const slug = activeOrganization?.slug;
	const navigate = useNavigate();
	const trpc = useTRPC();
	const { openDashboardTab: openDashboardTabHook } = useDashboardTabs();
	const [search, setSearch] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Fetch dashboards
	const { data: dashboards, isLoading: isLoadingDashboards } = useQuery(
		trpc.dashboards.getAll.queryOptions(undefined, {
			staleTime: 30000,
		}),
	);

	// Fetch saved insights
	const { data: savedInsights, isLoading: isLoadingInsights } = useQuery(
		trpc.dashboards.getAllSavedInsights.queryOptions(
			{ search: search || undefined },
			{
				staleTime: 30000,
			},
		),
	);

	// Fetch recents
	const { data: recents, isLoading: isLoadingRecents } = useQuery(
		trpc.dashboards.getRecents.queryOptions(
			{ limit: 10 },
			{
				staleTime: 30000,
			},
		),
	);

	// Record access mutation for recents tracking
	const recordAccessMutation = useMutation(
		trpc.dashboards.recordAccess.mutationOptions(),
	);

	// Create dashboard mutation
	const createDashboardMutation = useMutation(
		trpc.dashboards.create.mutationOptions({
			onSuccess: (data) => {
				toast.success("Dashboard created");
				openDashboardTabHook(data.id, data.name);
				navigate({
					to: "/$slug/dashboards/$dashboardId",
					params: { dashboardId: data.id, slug: slug! },
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create dashboard");
			},
		}),
	);

	// Auto-focus search input on mount
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	// Keyboard shortcut to focus search (Cmd+K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				inputRef.current?.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleOpenDashboard = useCallback(
		(dashboardId: string, name: string) => {
			// Record access for recents
			recordAccessMutation.mutate({
				itemType: "dashboard",
				itemId: dashboardId,
				itemName: name,
			});

			openDashboardTab(dashboardId, name);
			navigate({
				to: "/$slug/dashboards/$dashboardId",
				params: { dashboardId, slug: slug! },
			});
		},
		[navigate, slug, recordAccessMutation],
	);

	const handleOpenInsight = useCallback(
		(insightId: string, name: string) => {
			recordAccessMutation.mutate({
				itemType: "insight",
				itemId: insightId,
				itemName: name,
			});

			openInsightTab(insightId, name);
			navigate({
				to: "/$slug/insights/$insightId",
				params: { insightId, slug: slug! },
			});
		},
		[navigate, slug, recordAccessMutation],
	);

	const handleCreateDashboard = useCallback(() => {
		createDashboardMutation.mutate({
			name: "New Dashboard",
		});
	}, [createDashboardMutation]);

	const handleSelectInsightType = useCallback(
		(_chartType: InsightConfig["chartType"]) => {
			// Creating insights requires a dashboard context
			// For now, show a message to create a dashboard first
			toast.info("Create a dashboard first, then add insights from there");
		},
		[],
	);

	const handleQuickCreate = useCallback(
		(value: string) => {
			if (value === "dashboard") {
				handleCreateDashboard();
			} else {
				handleSelectInsightType(value as InsightConfig["chartType"]);
			}
		},
		[handleCreateDashboard, handleSelectInsightType],
	);

	// Filter items based on search
	const filteredDashboards = dashboards?.filter((d) =>
		d.name.toLowerCase().includes(search.toLowerCase()),
	);

	const filteredSavedInsights = savedInsights?.filter((insight) =>
		insight.name.toLowerCase().includes(search.toLowerCase()),
	);

	const isLoading = isLoadingDashboards || isLoadingInsights || isLoadingRecents;

	if (!slug) return null;

	return (
		<div className="flex flex-col h-full">
			{/* Search Header */}
			<div className="sticky top-0 z-10 bg-background border-b p-4">
				<div className="relative max-w-2xl mx-auto">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						ref={inputRef}
						placeholder="Search dashboards, insights, or create new..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10 h-11"
					/>
					<kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
						<span className="text-xs">⌘</span>K
					</kbd>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl mx-auto p-4 space-y-6">
					{isLoading && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						</div>
					)}

					{!isLoading && (
						<>
							{/* RECENTS Section */}
							{!search && recents && recents.length > 0 && (
								<section>
									<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
										Recents
									</h3>
									<div className="space-y-1">
										{recents.map((item) => (
											<button
												key={item.id}
												type="button"
												onClick={() => {
													if (item.itemType === "dashboard") {
														handleOpenDashboard(item.itemId, item.itemName);
													} else if (item.itemType === "insight") {
														handleOpenInsight(item.itemId, item.itemName);
													}
												}}
												className={cn(
													"flex items-center gap-3 w-full p-2 rounded-lg text-left",
													"hover:bg-accent transition-colors",
												)}
											>
												<div
													className={cn(
														"flex items-center justify-center size-6 rounded",
														item.itemType === "dashboard"
															? "bg-purple-500/15"
															: "bg-blue-500/15",
													)}
												>
													{item.itemType === "dashboard" ? (
														<LayoutDashboard className="size-3.5 text-purple-600 dark:text-purple-400" />
													) : (
														<Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
													)}
												</div>
												<span className="flex-1 text-sm truncate">
													{item.itemName}
												</span>
												<span className="text-xs text-muted-foreground shrink-0">
													{formatRelativeTime(item.accessedAt)}
												</span>
											</button>
										))}
									</div>
									<Separator className="mt-4" />
								</section>
							)}

							{/* CREATE NEW Section */}
							{!search && (
								<section>
									<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
										Create New
									</h3>
									<div className="grid grid-cols-2 gap-2">
										{QUICK_CREATE_OPTIONS.map((option) => (
											<CreateNewCard
												key={option.value}
												icon={option.icon}
												title={option.label}
												description={option.description}
												onClick={() => handleQuickCreate(option.value)}
												iconColor={option.iconColor}
												iconBg={option.iconBg}
											/>
										))}
									</div>
									<Separator className="mt-4" />
								</section>
							)}

							{/* SAVED INSIGHTS Section */}
							{filteredSavedInsights && filteredSavedInsights.length > 0 && (
								<section>
									<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
										Saved Insights
									</h3>
									<div className="space-y-1">
										{filteredSavedInsights.slice(0, 10).map((insight) => (
											<button
												key={insight.id}
												type="button"
												onClick={() =>
													handleOpenInsight(insight.id, insight.name)
												}
												className={cn(
													"flex items-center gap-3 w-full p-2 rounded-lg text-left",
													"hover:bg-accent transition-colors",
												)}
											>
												<div className="flex items-center justify-center size-6 rounded bg-blue-500/15">
													<Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
												</div>
												<div className="flex-1 min-w-0">
													<span className="text-sm truncate block">
														{insight.name}
													</span>
													{insight.description && (
														<span className="text-xs text-muted-foreground truncate block">
															{insight.description}
														</span>
													)}
												</div>
												<span className="text-xs text-muted-foreground shrink-0">
													{formatRelativeTime(insight.updatedAt)}
												</span>
											</button>
										))}
									</div>
									<Separator className="mt-4" />
								</section>
							)}

							{/* DASHBOARDS Section */}
							{filteredDashboards && filteredDashboards.length > 0 && (
								<section>
									<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
										Dashboards
									</h3>
									<div className="space-y-1">
										{filteredDashboards.map((dashboard) => (
											<button
												key={dashboard.id}
												type="button"
												onClick={() =>
													handleOpenDashboard(dashboard.id, dashboard.name)
												}
												className={cn(
													"flex items-center gap-3 w-full p-2 rounded-lg text-left",
													"hover:bg-accent transition-colors",
												)}
											>
												<div className="flex items-center justify-center size-6 rounded bg-purple-500/15">
													<LayoutDashboard className="size-3.5 text-purple-600 dark:text-purple-400" />
												</div>
												<span className="flex-1 text-sm truncate">
													{dashboard.name}
												</span>
												<span className="text-xs text-muted-foreground shrink-0">
													{formatRelativeTime(dashboard.updatedAt)}
												</span>
											</button>
										))}
									</div>
								</section>
							)}

							{/* Empty state when searching */}
							{search &&
								(!filteredDashboards || filteredDashboards.length === 0) &&
								(!filteredSavedInsights ||
									filteredSavedInsights.length === 0) && (
									<div className="text-center py-8">
										<p className="text-muted-foreground">
											No results found for "{search}"
										</p>
									</div>
								)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
