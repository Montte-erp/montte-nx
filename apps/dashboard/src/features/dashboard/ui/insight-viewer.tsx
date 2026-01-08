import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ArrowLeft,
	ChevronRight,
	Download,
	FileSpreadsheet,
	FileImage,
	Pencil,
	Save,
	X,
} from "lucide-react";
import { toast } from "sonner";
import { InsightWidget } from "./insight-widget";
import { InsightBuilderWizard } from "./insight-builder-wizard";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type BreadcrumbItem = {
	label: string;
	config: InsightConfig;
};

type InsightViewerProps = {
	config: InsightConfig;
	title: string;
	dashboardId?: string;
	breadcrumbs?: BreadcrumbItem[];
	onBack?: () => void;
	onClose?: () => void;
	onDrillDown?: (context: DrillDownContext) => void;
};

export function InsightViewer({
	config,
	title,
	dashboardId,
	breadcrumbs = [],
	onBack,
	onClose,
	onDrillDown,
}: InsightViewerProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { openSheet, closeSheet } = useSheet();

	const saveInsightMutation = useMutation(
		trpc.dashboards.createSavedInsight.mutationOptions({
			onSuccess: () => {
				toast.success("Insight saved");
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getAllSavedInsights.queryKey(),
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to save insight");
			},
		}),
	);

	const handleSaveAsInsight = () => {
		saveInsightMutation.mutate({
			name: title,
			config,
		});
	};

	const handleEdit = () => {
		if (dashboardId) {
			openSheet({
				children: (
					<InsightBuilderWizard
						dashboardId={dashboardId}
						initialChartType={config.chartType}
						onSuccess={() => {
							closeSheet();
						}}
						onCancel={closeSheet}
					/>
				),
			});
		}
	};

	const handleExportCsv = () => {
		// TODO: Implement CSV export for single insight
		toast.info("CSV export coming soon");
	};

	const handleExportImage = () => {
		// TODO: Implement image export for single insight
		toast.info("Image export coming soon");
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-3">
				<div className="flex items-center gap-2">
					{onBack && (
						<Button variant="ghost" size="icon" onClick={onBack}>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}

					{/* Breadcrumbs */}
					<nav className="flex items-center gap-1 text-sm">
						{breadcrumbs.map((crumb, index) => (
							<span key={`breadcrumb-${index + 1}`} className="flex items-center gap-1">
								<span className="text-muted-foreground hover:text-foreground cursor-pointer">
									{crumb.label}
								</span>
								<ChevronRight className="h-3 w-3 text-muted-foreground" />
							</span>
						))}
						<span className="font-medium">{title}</span>
					</nav>
				</div>

				<div className="flex items-center gap-2">
					{/* Save as Insight */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleSaveAsInsight}
						disabled={saveInsightMutation.isPending}
					>
						<Save className="h-4 w-4 mr-2" />
						Save
					</Button>

					{/* Edit */}
					{dashboardId && (
						<Button variant="outline" size="sm" onClick={handleEdit}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit
						</Button>
					)}

					{/* Export */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm">
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
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

					{/* Close */}
					{onClose && (
						<Button variant="ghost" size="icon" onClick={onClose}>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			{/* Insight Content */}
			<div className="flex-1 p-4">
				<Card className="h-full">
					<CardHeader className="py-3 px-4">
						<CardTitle className="text-sm font-medium">{title}</CardTitle>
					</CardHeader>
					<CardContent className="h-[calc(100%-48px)] p-4 pt-0">
						<InsightWidget
							widgetId="viewer"
							config={config}
							onDrillDown={onDrillDown}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
