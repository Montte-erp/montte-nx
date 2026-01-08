import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@packages/ui/components/command";
import { Button } from "@packages/ui/components/button";
import { useStore } from "@tanstack/react-store";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	BarChart3,
	ChevronDown,
	Layers,
	LayoutDashboard,
	LineChart,
	PieChart,
	Plus,
	Scale,
	Sparkles,
	Table2,
	TrendingUp,
} from "lucide-react";
import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import {
	insightPickerStore,
	closeInsightPicker,
} from "../hooks/use-insight-picker";
import { useDashboardTabs, openInsightTab } from "../hooks/use-dashboard-tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { useSheet } from "@/hooks/use-sheet";
import { InsightBuilderWizard } from "./insight-builder-wizard";
import { CreateNewCard } from "./create-new-card";
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
	if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
	return d.toLocaleDateString();
}

const INSIGHT_TYPES = [
	{
		value: "stat_card",
		label: "Stat Card",
		description: "Single metric with trend indicator",
		icon: TrendingUp,
	},
	{
		value: "line",
		label: "Line Chart",
		description: "Trends over time",
		icon: LineChart,
	},
	{
		value: "bar",
		label: "Bar Chart",
		description: "Compare categories",
		icon: BarChart3,
	},
	{
		value: "pie",
		label: "Pie Chart",
		description: "Distribution breakdown",
		icon: PieChart,
	},
	{
		value: "donut",
		label: "Donut Chart",
		description: "Distribution with center metric",
		icon: PieChart,
	},
	{
		value: "table",
		label: "Table",
		description: "Detailed data view",
		icon: Table2,
	},
	{
		value: "category_analysis",
		label: "Category Analysis",
		description: "Deep dive into category spending",
		icon: Layers,
	},
	{
		value: "comparison",
		label: "Comparison",
		description: "Side-by-side period analysis",
		icon: Scale,
	},
] as const;

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

export function GlobalInsightPicker() {
	const state = useStore(insightPickerStore);
	const { activeOrganization } = useActiveOrganization();
	const slug = activeOrganization?.slug;
	const navigate = useNavigate();
	const trpc = useTRPC();
	const { openSheet, closeSheet } = useSheet();
	const { openDashboardTab } = useDashboardTabs();
	const [search, setSearch] = useState("");
	const [showAllInsights, setShowAllInsights] = useState(false);

	// Fetch dashboards
	const { data: dashboards } = useQuery(
		trpc.dashboards.getAll.queryOptions(undefined, {
			staleTime: 30000,
			enabled: state.isOpen,
		}),
	);

	// Fetch saved insights
	const { data: savedInsights } = useQuery(
		trpc.dashboards.getAllSavedInsights.queryOptions(
			{ search: search || undefined },
			{
				staleTime: 30000,
				enabled: state.isOpen,
			},
		),
	);

	// Fetch recents
	const { data: recents } = useQuery(
		trpc.dashboards.getRecents.queryOptions(
			{ limit: 5 },
			{
				staleTime: 30000,
				enabled: state.isOpen,
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
				openDashboardTab(data.id, data.name);
				closeInsightPicker();
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

	// Add widget to dashboard mutation
	const addWidgetMutation = useMutation(
		trpc.dashboards.addWidget.mutationOptions({
			onSuccess: () => {
				toast.success("Insight added to dashboard");
				closeInsightPicker();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to add insight");
			},
		}),
	);

	// Reset search when dialog opens
	useEffect(() => {
		if (state.isOpen) {
			setSearch("");
			setShowAllInsights(false);
		}
	}, [state.isOpen]);

	// Keyboard shortcut to open picker
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				if (state.isOpen) {
					closeInsightPicker();
				} else {
					insightPickerStore.setState((s) => ({
						...s,
						isOpen: true,
						mode: "default",
					}));
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [state.isOpen]);

	const handleOpenDashboard = useCallback(
		(dashboardId: string, name: string) => {
			// Record access for recents
			recordAccessMutation.mutate({
				itemType: "dashboard",
				itemId: dashboardId,
				itemName: name,
			});

			openDashboardTab(dashboardId, name);
			closeInsightPicker();
			navigate({
				to: "/$slug/dashboards/$dashboardId",
				params: { dashboardId, slug: slug! },
			});
		},
		[navigate, openDashboardTab, slug, recordAccessMutation],
	);

	// Handle opening a saved insight as a new tab
	const handleOpenInsight = useCallback(
		(insightId: string, name: string) => {
			recordAccessMutation.mutate({
				itemType: "insight",
				itemId: insightId,
				itemName: name,
			});

			openInsightTab(insightId, name);
			closeInsightPicker();
			navigate({
				to: "/$slug/insights/$insightId",
				params: { insightId, slug: slug! },
			});
		},
		[navigate, slug, recordAccessMutation],
	);

	// Handle adding a saved insight to the current dashboard
	const handleAddInsightToDashboard = useCallback(
		(insightConfig: InsightConfig, insightName: string) => {
			const dashboardId = state.currentDashboardId || state.dashboardId;
			if (!dashboardId) {
				toast.error("No dashboard selected");
				return;
			}

			addWidgetMutation.mutate({
				dashboardId,
				type: "insight",
				name: insightName,
				config: insightConfig,
				position: { x: 0, y: 0, w: 6, h: 3 },
			});
		},
		[state.currentDashboardId, state.dashboardId, addWidgetMutation],
	);

	const handleCreateDashboard = useCallback(() => {
		createDashboardMutation.mutate({
			name: "New Dashboard",
		});
	}, [createDashboardMutation]);

	const handleSelectInsightType = useCallback(
		(chartType: InsightConfig["chartType"]) => {
			closeInsightPicker();

			// If we have a dashboard context, open the insight builder wizard for that dashboard
			if (state.dashboardId) {
				openSheet({
					children: (
						<InsightBuilderWizard
							dashboardId={state.dashboardId}
							initialChartType={chartType}
							onSuccess={() => {
								closeSheet();
								state.onInsightCreated?.("new-insight");
							}}
							onCancel={closeSheet}
						/>
					),
				});
			} else {
				// No dashboard context - create a new dashboard first, then add insight
				// Or show a dashboard selector
				toast.info("Select a dashboard first to add an insight");
			}
		},
		[state.dashboardId, state.onInsightCreated, openSheet, closeSheet],
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

	const filteredInsightTypes = INSIGHT_TYPES.filter(
		(t) =>
			t.label.toLowerCase().includes(search.toLowerCase()) ||
			t.description.toLowerCase().includes(search.toLowerCase()),
	);

	// Insight types to show (limited unless expanded)
	const visibleInsightTypes = showAllInsights
		? filteredInsightTypes
		: filteredInsightTypes.slice(0, 4);
	const hiddenCount = filteredInsightTypes.length - 4;

	// Filter saved insights
	const filteredSavedInsights = savedInsights?.filter((insight) =>
		insight.name.toLowerCase().includes(search.toLowerCase()),
	);

	// Check if we have a dashboard context (can add insights)
	const hasDashboardContext = Boolean(state.currentDashboardId || state.dashboardId);

	if (!slug) return null;

	return (
		<CommandDialog
			open={state.isOpen}
			onOpenChange={(open) => {
				if (!open) closeInsightPicker();
			}}
			title="Search"
			description="Search dashboards and create new insights"
			className="max-w-2xl"
		>
			<CommandInput
				placeholder="Search dashboards, insights, or create new..."
				value={search}
				onValueChange={setSearch}
			/>
			<CommandList className="max-h-[500px]">
				<CommandEmpty>No results found.</CommandEmpty>

				{/* RECENTS Section */}
				{!search && recents && recents.length > 0 && (
					<>
						<CommandGroup heading="RECENTS">
							{recents.map((item) => (
								<CommandItem
									key={item.id}
									value={`recent-${item.id}`}
									onSelect={() => {
										if (item.itemType === "dashboard") {
											handleOpenDashboard(item.itemId, item.itemName);
										} else if (item.itemType === "insight") {
											handleOpenInsight(item.itemId, item.itemName);
										}
									}}
								>
									<div className={`flex items-center justify-center size-5 rounded mr-2 ${
										item.itemType === "dashboard"
											? "bg-purple-500/15"
											: "bg-blue-500/15"
									}`}>
										{item.itemType === "dashboard" ? (
											<LayoutDashboard className="size-3 text-purple-600 dark:text-purple-400" />
										) : (
											<Sparkles className="size-3 text-blue-600 dark:text-blue-400" />
										)}
									</div>
									<span className="flex-1">{item.itemName}</span>
									<span className="text-xs text-muted-foreground">
										{formatRelativeTime(item.accessedAt)}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{/* CREATE NEW Section - Grid of cards when no search */}
				{state.mode === "default" && !search && (
					<>
						<CommandGroup heading="CREATE NEW">
							<div className="grid grid-cols-2 gap-2 p-2">
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
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{/* Create New Section - List when searching or adding to dashboard */}
				{(search || state.mode === "addToDashboard") && state.mode !== "default" && (
					<>
						<CommandGroup heading="CREATE NEW INSIGHT">
							{visibleInsightTypes.map((type) => {
								const Icon = type.icon;
								return (
									<CommandItem
										key={type.value}
										value={`create-${type.value}`}
										onSelect={() =>
											handleSelectInsightType(
												type.value as InsightConfig["chartType"],
											)
										}
									>
										<Icon className="mr-2 h-4 w-4 text-muted-foreground" />
										<div className="flex flex-col">
											<span>{type.label}</span>
											<span className="text-xs text-muted-foreground">
												{type.description}
											</span>
										</div>
									</CommandItem>
								);
							})}
							{!showAllInsights && hiddenCount > 0 && (
								<CommandItem
									value="show-all-insights"
									onSelect={() => setShowAllInsights(true)}
								>
									<ChevronDown className="mr-2 h-4 w-4 text-muted-foreground" />
									<span>Show all ({hiddenCount} more)</span>
								</CommandItem>
							)}
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{/* SAVED INSIGHTS Section */}
				{filteredSavedInsights && filteredSavedInsights.length > 0 && (
					<>
						<CommandGroup heading="SAVED INSIGHTS">
							{filteredSavedInsights.slice(0, 5).map((insight) => (
								<CommandItem
									key={insight.id}
									value={`insight-${insight.id}`}
									onSelect={() => handleOpenInsight(insight.id, insight.name)}
									className="group"
								>
									<div className="flex items-center justify-center size-5 rounded bg-blue-500/15 mr-2">
										<Sparkles className="size-3 text-blue-600 dark:text-blue-400" />
									</div>
									<div className="flex-1 min-w-0">
										<span className="truncate block">{insight.name}</span>
										{insight.description && (
											<span className="text-xs text-muted-foreground truncate block">
												{insight.description}
											</span>
										)}
									</div>
									{hasDashboardContext && (
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
											onClick={(e) => {
												e.stopPropagation();
												handleAddInsightToDashboard(
													insight.config as InsightConfig,
													insight.name,
												);
											}}
										>
											<Plus className="h-3 w-3" />
										</Button>
									)}
									<span className="text-xs text-muted-foreground shrink-0 ml-2">
										{formatRelativeTime(insight.updatedAt)}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
						<CommandSeparator />
					</>
				)}

				{/* DASHBOARDS Section with timestamps */}
				{filteredDashboards && filteredDashboards.length > 0 && (
					<CommandGroup heading="DASHBOARDS">
						{filteredDashboards.map((dashboard) => (
							<CommandItem
								key={dashboard.id}
								value={`dashboard-${dashboard.id}`}
								onSelect={() => handleOpenDashboard(dashboard.id, dashboard.name)}
							>
								<div className="flex items-center justify-center size-5 rounded bg-purple-500/15 mr-2">
									<LayoutDashboard className="size-3 text-purple-600 dark:text-purple-400" />
								</div>
								<span className="flex-1">{dashboard.name}</span>
								<span className="text-xs text-muted-foreground">
									{formatRelativeTime(dashboard.updatedAt)}
								</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
