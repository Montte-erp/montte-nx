import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import type { WidgetPosition, InsightConfig } from "@packages/database/schemas/dashboards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, FileText, Plus } from "lucide-react";
import { Suspense, useEffect } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { DashboardGrid } from "@/features/dashboard/ui/dashboard-grid";
import { InsightPickerCredenza, type DefaultInsightType } from "@/features/dashboard/ui/insight-picker-credenza";
import { TextCardEditorCredenza } from "@/features/dashboard/ui/text-card-editor-credenza";
import { useDashboardTabs, setAppTabName } from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useInsightDrillDown, type DrillDownContext } from "@/features/dashboard/hooks/use-insight-drill-down";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza, closeCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";

type DashboardPageProps = {
	dashboardId: string;
};

export function DashboardPage({ dashboardId }: DashboardPageProps) {
	return (
		<ErrorBoundary FallbackComponent={DashboardErrorFallback}>
			<Suspense fallback={<DashboardSkeleton />}>
				<DashboardContent dashboardId={dashboardId} />
			</Suspense>
		</ErrorBoundary>
	);
}

function DashboardErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-4">
			<p className="text-destructive">Failed to load dashboard</p>
			<p className="text-sm text-muted-foreground">{error.message}</p>
			<Button onClick={resetErrorBoundary}>Retry</Button>
		</div>
	);
}

function DashboardSkeleton() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-64" />
					<Skeleton className="h-4 w-96" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-24" />
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={`skeleton-${i + 1}`} className="h-64" />
				))}
			</div>
		</div>
	);
}

type Widget = {
	id: string;
	dashboardId: string;
	type: "insight" | "text_card";
	name: string;
	description: string | null;
	position: WidgetPosition;
	config: unknown;
};

function DashboardContent({ dashboardId }: { dashboardId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { openAlertDialog } = useAlertDialog();
	const { updateTabName } = useDashboardTabs();
	const { drillDown } = useInsightDrillDown();
	const { openCredenza } = useCredenza();

	const queryOptions = trpc.dashboards.getById.queryOptions({ id: dashboardId });
	const { data: dashboard } = useQuery(queryOptions);

	type DashboardData = NonNullable<typeof dashboard>;

	const queryKey = trpc.dashboards.getById.queryKey({ id: dashboardId });

	const updateMutation = useMutation(
		trpc.dashboards.update.mutationOptions({
			onMutate: async (newData) => {
				await queryClient.cancelQueries({ queryKey });
				const previousData = queryClient.getQueryData<DashboardData>(queryKey);

				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						...(newData.name !== undefined && { name: newData.name }),
						...(newData.description !== undefined && { description: newData.description }),
						...(newData.isPinned !== undefined && { isPinned: newData.isPinned }),
					};
				});

				// Optimistically update tab name
				if (newData.name) {
					updateTabName(dashboardId, newData.name);
				}

				return { previousData };
			},
			onError: (error, _vars, context) => {
				// Rollback on error
				if (context?.previousData) {
					queryClient.setQueryData<DashboardData>(queryKey, context.previousData);
					updateTabName(dashboardId, context.previousData.name);
				}
				toast.error(error.message || "Failed to update dashboard");
			},
			onSuccess: (data) => {
				// Sync with server data
				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return { ...old, ...data };
				});
				updateTabName(dashboardId, data.name);
				if (data.isPinned) {
					setAppTabName(data.name, data.id);
				}
			},
		}),
	);

	const addWidgetMutation = useMutation(
		trpc.dashboards.addWidget.mutationOptions({
			onMutate: async (newWidget) => {
				await queryClient.cancelQueries({ queryKey });
				const previousData = queryClient.getQueryData<DashboardData>(queryKey);

				const tempId = `temp-${Date.now()}`;
				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						widgets: [
							...old.widgets,
							{
								id: tempId,
								dashboardId: newWidget.dashboardId,
								type: newWidget.type,
								name: newWidget.name,
								description: newWidget.description ?? null,
								position: newWidget.position,
								config: newWidget.config,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
						],
					};
				});

				closeCredenza();
				return { previousData, tempId };
			},
			onError: (error, _vars, context) => {
				if (context?.previousData) {
					queryClient.setQueryData<DashboardData>(queryKey, context.previousData);
				}
				toast.error(error.message || "Failed to add widget");
			},
			onSuccess: (data, _vars, context) => {
				// Replace temp widget with real data from server
				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						widgets: old.widgets.map((w) =>
							w.id === context?.tempId ? data : w
						),
					};
				});
				toast.success("Widget added");
			},
		}),
	);

	const removeWidgetMutation = useMutation(
		trpc.dashboards.removeWidget.mutationOptions({
			onMutate: async ({ widgetId }) => {
				await queryClient.cancelQueries({ queryKey });
				const previousData = queryClient.getQueryData<DashboardData>(queryKey);

				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						widgets: old.widgets.filter((w) => w.id !== widgetId),
					};
				});

				return { previousData };
			},
			onError: (error, _vars, context) => {
				if (context?.previousData) {
					queryClient.setQueryData<DashboardData>(queryKey, context.previousData);
				}
				toast.error(error.message || "Failed to remove widget");
			},
			onSuccess: () => {
				toast.success("Widget removed");
			},
		}),
	);

	const updateWidgetMutation = useMutation(
		trpc.dashboards.updateWidget.mutationOptions({
			onMutate: async ({ widgetId, ...updates }) => {
				await queryClient.cancelQueries({ queryKey });
				const previousData = queryClient.getQueryData<DashboardData>(queryKey);

				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						widgets: old.widgets.map((w) =>
							w.id === widgetId
								? {
										...w,
										...(updates.name !== undefined && { name: updates.name }),
										...(updates.position !== undefined && { position: updates.position }),
										...(updates.config !== undefined && { config: updates.config }),
									}
								: w
						),
					};
				});

				return { previousData };
			},
			onError: (error, _vars, context) => {
				if (context?.previousData) {
					queryClient.setQueryData<DashboardData>(queryKey, context.previousData);
				}
				toast.error(error.message || "Failed to update widget");
			},
			onSuccess: (data) => {
				// Sync with server data
				queryClient.setQueryData<DashboardData>(queryKey, (old) => {
					if (!old) return old;
					return {
						...old,
						widgets: old.widgets.map((w) =>
							w.id === data.id ? data : w
						),
					};
				});
			},
		}),
	);

	// Sync app tab name when viewing the default (pinned) dashboard
	useEffect(() => {
		if (dashboard?.isPinned) {
			setAppTabName(dashboard.name, dashboard.id);
		}
	}, [dashboard?.isPinned, dashboard?.name, dashboard?.id]);

	if (!dashboard) {
		return <DashboardSkeleton />;
	}

	const handleAddTextCard = () => {
		openCredenza({
			children: (
				<TextCardEditorCredenza
					initialContent=""
					onSave={(content) => {
						const widgets = dashboard.widgets || [];
						const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);

						addWidgetMutation.mutate({
							dashboardId,
							name: "Text Card",
							description: null,
							type: "text_card",
							position: { x: 0, y: maxY, w: 1, h: 2 },
							config: {
								type: "text_card",
								content,
							},
						});
					}}
				/>
			),
		});
	};

	const handleOpenInsightPicker = () => {
		openCredenza({
			className: "md:max-w-3xl",
			children: (
				<InsightPickerCredenza
					onSelectDefault={handleAddDefaultInsight}
					onSelectSaved={handleAddSavedInsight}
				/>
			),
		});
	};

	const handleAddDefaultInsight = (type: DefaultInsightType) => {
		const widgets = dashboard.widgets || [];
		const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);

		const defaultConfigs: Record<DefaultInsightType, InsightConfig> = {
			transactions: {
				type: "insight",
				dataSource: "transactions",
				aggregation: "sum",
				aggregateField: "amount",
				timeGrouping: "month",
				breakdown: { field: "categoryId", limit: 10 },
				filters: [],
				chartType: "line",
			},
			bills: {
				type: "insight",
				dataSource: "bills",
				aggregation: "sum",
				aggregateField: "amount",
				timeGrouping: "month",
				breakdown: { field: "type", limit: 10 },
				filters: [],
				chartType: "bar",
			},
			budgets: {
				type: "insight",
				dataSource: "budgets",
				aggregation: "sum",
				aggregateField: "amount",
				timeGrouping: "month",
				filters: [],
				chartType: "bar",
			},
			bank_accounts: {
				type: "insight",
				dataSource: "bank_accounts",
				aggregation: "sum",
				aggregateField: "balance",
				breakdown: { field: "name", limit: 10 },
				filters: [],
				chartType: "stat_card",
			},
		};

		const defaultNames: Record<DefaultInsightType, string> = {
			transactions: "Transactions Overview",
			bills: "Bills Summary",
			budgets: "Budget Progress",
			bank_accounts: "Account Balances",
		};

		const defaultDescriptions: Record<DefaultInsightType, string> = {
			transactions: "Track your income and expenses over time",
			bills: "Monitor upcoming and paid bills",
			budgets: "View budget allocation and spending",
			bank_accounts: "Current balance across all accounts",
		};

		addWidgetMutation.mutate({
			dashboardId,
			name: defaultNames[type],
			description: defaultDescriptions[type],
			type: "insight",
			position: { x: 0, y: maxY, w: 3, h: 4 },
			config: defaultConfigs[type],
		});
	};

	const handleAddSavedInsight = (insight: { id: string; name: string; description?: string | null; config: InsightConfig }) => {
		const widgets = dashboard.widgets || [];
		const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);

		addWidgetMutation.mutate({
			dashboardId,
			name: insight.name,
			description: insight.description || null,
			type: "insight",
			position: { x: 0, y: maxY, w: 3, h: 4 },
			config: insight.config,
		});
	};

	const handleRemoveWidget = (widgetId: string, widgetName: string) => {
		openAlertDialog({
			title: "Remove Widget",
			description: `Are you sure you want to remove "${widgetName}"?`,
			actionLabel: "Remove",
			variant: "destructive",
			onAction: async () => {
				await removeWidgetMutation.mutateAsync({ widgetId });
			},
		});
	};

	const handleUpdateWidgetConfig = (widgetId: string, updates: Partial<InsightConfig>) => {
		const widget = widgets.find((w) => w.id === widgetId);
		if (!widget || widget.type !== "insight") return;

		const currentConfig = widget.config as InsightConfig;
		updateWidgetMutation.mutate({
			widgetId,
			config: { ...currentConfig, ...updates },
		});
	};

	const handleUpdateWidgetName = (widgetId: string, name: string) => {
		updateWidgetMutation.mutate({
			widgetId,
			name,
		});
	};

	const handleUpdateWidgetDescription = (widgetId: string, description: string | null) => {
		updateWidgetMutation.mutate({
			widgetId,
			description,
		});
	};

	const handleChangeWidgetWidth = (widgetId: string, newWidth: number) => {
		const widget = widgets.find((w) => w.id === widgetId);
		if (!widget) return;

		// Clamp width based on widget type
		const isTextCard = widget.type === "text_card";
		const minWidth = isTextCard ? 1 : 3;
		const maxWidth = isTextCard ? 3 : 6;
		const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

		updateWidgetMutation.mutate({
			widgetId,
			position: { ...widget.position, w: clampedWidth },
		});
	};

	const handleDrillDown = (config: InsightConfig, context: DrillDownContext) => {
		drillDown(config, context);
	};

	const widgets = (dashboard.widgets || []) as Widget[];

	return (
		<div className="space-y-6">
			{/* Header */}
			<DefaultHeader
				title={dashboard.name}
				description={dashboard.description || ""}
				onTitleChange={(newTitle) => {
					updateMutation.mutate({
						id: dashboardId,
						name: newTitle,
					});
				}}
				onDescriptionChange={(newDescription) => {
					updateMutation.mutate({
						id: dashboardId,
						description: newDescription.trim() || null,
					});
				}}
				descriptionPlaceholder="Click to add description..."
				actions={
					<>
						<Button size="sm" variant="outline" onClick={handleAddTextCard}>
							<FileText className="h-4 w-4 mr-2" />
							Text Card
						</Button>
						<Button size="sm" onClick={handleOpenInsightPicker}>
							<BarChart3 className="h-4 w-4 mr-2" />
							Insight
						</Button>
					</>
				}
			/>

			{/* Widgets Grid */}
			{widgets.length > 0 ? (
				<DashboardGrid
					dashboardId={dashboardId}
					widgets={widgets}
					onRemoveWidget={handleRemoveWidget}
					onUpdateWidgetConfig={handleUpdateWidgetConfig}
					onUpdateWidgetName={handleUpdateWidgetName}
					onUpdateWidgetDescription={handleUpdateWidgetDescription}
					onChangeWidgetWidth={handleChangeWidgetWidth}
					onDrillDown={handleDrillDown}
				/>
			) : (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12 text-center">
						<div className="rounded-full bg-muted p-3 mb-4">
							<Plus className="h-6 w-6 text-muted-foreground" />
						</div>
						<CardTitle className="text-lg mb-2">No widgets yet</CardTitle>
						<CardDescription className="mb-4">
							Add insights or text cards to customize your dashboard
						</CardDescription>
						<div className="flex gap-2">
							<Button variant="outline" onClick={handleAddTextCard}>
								<FileText className="h-4 w-4 mr-2" />
								Text Card
							</Button>
							<Button onClick={handleOpenInsightPicker}>
								<BarChart3 className="h-4 w-4 mr-2" />
								Insight
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
