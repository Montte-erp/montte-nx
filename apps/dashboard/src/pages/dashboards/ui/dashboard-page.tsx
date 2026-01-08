import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@packages/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { Skeleton } from "@packages/ui/components/skeleton";
import type { WidgetPosition, InsightConfig } from "@packages/database/schemas/dashboards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarDays,
	Download,
	FileImage,
	FileSpreadsheet,
	FileText,
	Pencil,
	Plus,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { DashboardGrid } from "@/features/dashboard/ui/dashboard-grid";
import { InsightBuilderWizard } from "@/features/dashboard/ui/insight-builder-wizard";
import { WidgetConfigPanel } from "@/features/dashboard/ui/widget-config-panel";
import { useDashboardTabs } from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useInsightDrillDown, type DrillDownContext } from "@/features/dashboard/hooks/use-insight-drill-down";
import { openWidgetConfigPanel } from "@/features/dashboard/hooks/use-widget-config-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { exportToCsv, exportToImage } from "@/features/dashboard/utils/export-utils";

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
	position: WidgetPosition;
	config: unknown;
};

function DashboardContent({ dashboardId }: { dashboardId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { openSheet, closeSheet } = useSheet();
	const { openAlertDialog } = useAlertDialog();
	const { updateTabName } = useDashboardTabs();
	const { drillDown } = useInsightDrillDown(dashboardId);

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [editDescription, setEditDescription] = useState("");
	const titleInputRef = useRef<HTMLInputElement>(null);
	const gridContainerRef = useRef<HTMLDivElement>(null);

	const { data: dashboard } = useQuery(
		trpc.dashboards.getById.queryOptions({ id: dashboardId }),
	);

	const updateMutation = useMutation(
		trpc.dashboards.update.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
				updateTabName(dashboardId, data.name);
			},
			onError: (error) => {
				toast.error(error.message || "Failed to update dashboard");
			},
		}),
	);

	const addWidgetMutation = useMutation(
		trpc.dashboards.addWidget.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
				toast.success("Widget added");
				closeSheet();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to add widget");
			},
		}),
	);

	const removeWidgetMutation = useMutation(
		trpc.dashboards.removeWidget.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
				toast.success("Widget removed");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to remove widget");
			},
		}),
	);

	useEffect(() => {
		if (dashboard) {
			setEditTitle(dashboard.name);
			setEditDescription(dashboard.description || "");
		}
	}, [dashboard]);

	useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus();
			titleInputRef.current.select();
		}
	}, [isEditingTitle]);

	if (!dashboard) {
		return <DashboardSkeleton />;
	}

	const handleSaveTitle = () => {
		if (editTitle.trim() && editTitle !== dashboard.name) {
			updateMutation.mutate({
				id: dashboardId,
				name: editTitle.trim(),
			});
		}
		setIsEditingTitle(false);
	};

	const handleSaveDescription = () => {
		if (editDescription !== (dashboard.description || "")) {
			updateMutation.mutate({
				id: dashboardId,
				description: editDescription.trim() || null,
			});
		}
		setIsEditingDescription(false);
	};

	const handleAddTextCard = () => {
		// Find a free position
		const widgets = dashboard.widgets || [];
		const maxY = widgets.reduce((max, w) => Math.max(max, w.position.y + w.position.h), 0);
		
		addWidgetMutation.mutate({
			dashboardId,
			name: "Text Card",
			type: "text_card",
			position: { x: 0, y: maxY, w: 4, h: 2 },
			config: {
				type: "text_card",
				content: "# New Text Card\n\nAdd your content here...",
			},
		});
	};

	const handleAddInsight = () => {
		openSheet({
			children: (
				<InsightBuilderWizard
					dashboardId={dashboardId}
					onSuccess={() => {
						queryClient.invalidateQueries({
							queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
						});
						closeSheet();
					}}
					onCancel={closeSheet}
				/>
			),
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

	const handleEditWidget = (widget: Widget) => {
		if (widget.type === "insight") {
			// Open the config panel for insight widgets
			openWidgetConfigPanel({
				widgetId: widget.id,
				dashboardId: dashboardId,
				widgetName: widget.name,
				widgetConfig: widget.config as InsightConfig,
			});
		} else {
			// TODO: Text card editor
			toast.info("Text card editor coming soon");
		}
	};

	const handleDrillDown = (config: InsightConfig, context: DrillDownContext) => {
		drillDown(config, context);
	};

	const handleExportCsv = () => {
		// For CSV export, we'll export a summary of all widgets
		const widgetsSummary = widgets.map((widget) => ({
			Name: widget.name,
			Type: widget.type,
			Position: `(${widget.position.x}, ${widget.position.y})`,
			Size: `${widget.position.w}x${widget.position.h}`,
		}));
		exportToCsv(widgetsSummary, `${dashboard.name}-summary`);
		toast.success("Dashboard exported as CSV");
	};

	const handleExportImage = async () => {
		if (!gridContainerRef.current) {
			toast.error("Unable to export dashboard");
			return;
		}
		try {
			await exportToImage(gridContainerRef.current, dashboard.name);
			toast.success("Dashboard exported as image");
		} catch {
			toast.error("Failed to export as image");
		}
	};

	const handleExportPdf = () => {
		// PDF export requires server-side rendering
		toast.info("PDF export coming soon");
	};

	const widgets = (dashboard.widgets || []) as Widget[];

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1 flex-1">
					{isEditingTitle ? (
						<Input
							ref={titleInputRef}
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							onBlur={handleSaveTitle}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveTitle();
								if (e.key === "Escape") {
									setEditTitle(dashboard.name);
									setIsEditingTitle(false);
								}
							}}
							className="text-2xl font-bold h-auto py-1 px-2 -ml-2"
						/>
					) : (
						<h1
							className="text-2xl font-bold cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2 inline-flex items-center gap-2 group"
							onClick={() => setIsEditingTitle(true)}
						>
							{dashboard.name}
							<Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100" />
						</h1>
					)}

					{isEditingDescription ? (
						<Input
							value={editDescription}
							onChange={(e) => setEditDescription(e.target.value)}
							onBlur={handleSaveDescription}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveDescription();
								if (e.key === "Escape") {
									setEditDescription(dashboard.description || "");
									setIsEditingDescription(false);
								}
							}}
							placeholder="Add a description..."
							className="text-sm text-muted-foreground"
						/>
					) : (
						<p
							className="text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2"
							onClick={() => setIsEditingDescription(true)}
						>
							{dashboard.description || "Click to add description..."}
						</p>
					)}
				</div>

				<div className="flex items-center gap-2">
					{/* Date Range Filter */}
					<Button variant="outline" size="sm">
						<CalendarDays className="h-4 w-4 mr-2" />
						Last 30 days
					</Button>

					{/* Add Widget */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="sm">
								<Plus className="h-4 w-4 mr-2" />
								Add
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleAddInsight}>
								<Plus className="h-4 w-4 mr-2" />
								Add insight
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleAddTextCard}>
								<FileText className="h-4 w-4 mr-2" />
								Add text card
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Export */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleExportPdf}>
								<FileText className="h-4 w-4 mr-2" />
								Export as PDF
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleExportCsv}>
								<FileSpreadsheet className="h-4 w-4 mr-2" />
								Export as CSV
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleExportImage}>
								<FileImage className="h-4 w-4 mr-2" />
								Export as Image
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Widgets Grid */}
			{widgets.length > 0 ? (
				<div ref={gridContainerRef}>
					<DashboardGrid
						dashboardId={dashboardId}
						widgets={widgets}
						onRemoveWidget={handleRemoveWidget}
						onEditWidget={handleEditWidget}
						onDrillDown={handleDrillDown}
					/>
				</div>
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
							<Button onClick={handleAddInsight}>
								<Plus className="h-4 w-4 mr-2" />
								Add insight
							</Button>
							<Button variant="outline" onClick={handleAddTextCard}>
								<FileText className="h-4 w-4 mr-2" />
								Add text card
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Widget Config Panel */}
			<WidgetConfigPanel />
		</div>
	);
}
