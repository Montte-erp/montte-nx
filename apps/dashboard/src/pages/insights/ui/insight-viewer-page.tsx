import { Button } from "@packages/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ChevronLeft,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
	Calendar,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/default/default-header";
import { InsightWidget } from "@/features/dashboard/ui/insight-widget";
import { useDashboardTabs } from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

type InsightViewerPageProps = {
	insightId: string;
};

export function InsightViewerPage({ insightId }: InsightViewerPageProps) {
	const { activeOrganization } = useActiveOrganization();
	const slug = activeOrganization?.slug;
	const navigate = useNavigate();
	const trpc = useTRPC();
	const { openInsightTab, closeTab } = useDashboardTabs();
	const { openAlertDialog } = useAlertDialog();
	const { openCredenza, closeCredenza } = useCredenza();

	// Fetch insight data
	const { data: insight, isLoading, error } = useQuery(
		trpc.dashboards.getSavedInsight.queryOptions(
			{ id: insightId },
			{ staleTime: 30000 },
		),
	);

	// Fetch dashboards for "Add to Dashboard" feature
	const { data: dashboards } = useQuery(
		trpc.dashboards.getAll.queryOptions(undefined, { staleTime: 30000 }),
	);

	// Record access mutation
	const recordAccessMutation = useMutation(
		trpc.dashboards.recordAccess.mutationOptions(),
	);

	// Delete insight mutation
	const deleteInsightMutation = useMutation(
		trpc.dashboards.deleteSavedInsight.mutationOptions({
			onSuccess: () => {
				toast.success("Insight deleted");
				closeTab(`insight-${insightId}`);
				navigate({ to: "/$slug/dashboards", params: { slug: slug! } });
			},
			onError: (err) => {
				toast.error(err.message || "Failed to delete insight");
			},
		}),
	);

	// Add widget to dashboard mutation
	const addWidgetMutation = useMutation(
		trpc.dashboards.addWidget.mutationOptions({
			onSuccess: () => {
				toast.success("Insight added to dashboard");
				closeCredenza();
			},
			onError: (err) => {
				toast.error(err.message || "Failed to add insight to dashboard");
			},
		}),
	);

	// Update tab when insight loads
	useEffect(() => {
		if (insight) {
			openInsightTab(insightId, insight.name);
			// Record access for recents
			recordAccessMutation.mutate({
				itemType: "insight",
				itemId: insightId,
				itemName: insight.name,
			});
		}
	}, [insight, insightId, openInsightTab, recordAccessMutation]);

	const handleDelete = () => {
		openAlertDialog({
			title: "Delete Insight",
			description:
				"Are you sure you want to delete this insight? This action cannot be undone.",
			actionLabel: "Delete",
			variant: "destructive",
			onAction: async () => {
				await deleteInsightMutation.mutateAsync({ id: insightId });
			},
		});
	};

	const handleAddToDashboard = () => {
		openCredenza({
			children: (
				<DashboardSelectorContent
					dashboards={dashboards || []}
					insightConfig={insight?.config as InsightConfig}
					insightName={insight?.name || "Insight"}
					onSelect={(dashboardId) => {
						addWidgetMutation.mutate({
							dashboardId,
							type: "insight",
							name: insight?.name || "Insight",
							config: insight?.config as InsightConfig,
							position: { x: 0, y: 0, w: 6, h: 3 },
						});
					}}
				/>
			),
		});
	};

	const handleBack = () => {
		closeTab(`insight-${insightId}`);
		navigate({ to: "/$slug/dashboards", params: { slug: slug! } });
	};

	if (isLoading) {
		return <InsightViewerSkeleton />;
	}

	if (error || !insight) {
		return (
			<div className="p-4">
				<div className="text-center py-12">
					<p className="text-destructive mb-4">
						{error?.message || "Insight not found"}
					</p>
					<Button variant="outline" onClick={handleBack}>
						<ChevronLeft className="h-4 w-4 mr-2" />
						Back to Dashboards
					</Button>
				</div>
			</div>
		);
	}

	const insightConfig = insight.config as InsightConfig;

	return (
		<div className="p-4 relative">
			<DefaultHeader
				title={insight.name}
				description={insight.description || "No description"}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleBack}>
							<ChevronLeft className="h-4 w-4 mr-2" />
							Back
						</Button>
						<Button variant="outline" size="sm">
							<Calendar className="h-4 w-4 mr-2" />
							Last 30 days
						</Button>
						<Button size="sm" onClick={handleAddToDashboard}>
							<Plus className="h-4 w-4 mr-2" />
							Add to Dashboard
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem>
									<Pencil className="h-4 w-4 mr-2" />
									Edit
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={handleDelete}
								>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				}
			/>

			<div className="mt-6">
				<div className="bg-card border rounded-lg p-6 min-h-[400px]">
					<InsightWidget
						widgetId={insightId}
						config={insightConfig}
					/>
				</div>
			</div>
		</div>
	);
}

function InsightViewerSkeleton() {
	return (
		<div className="p-4">
			<div className="flex justify-between items-start mb-6">
				<div>
					<Skeleton className="h-10 w-64 mb-2" />
					<Skeleton className="h-5 w-48" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-32" />
					<Skeleton className="h-9 w-9" />
				</div>
			</div>
			<Skeleton className="h-[400px] w-full rounded-lg" />
		</div>
	);
}

type DashboardSelectorContentProps = {
	dashboards: Array<{ id: string; name: string }>;
	insightConfig: InsightConfig;
	insightName: string;
	onSelect: (dashboardId: string) => void;
};

function DashboardSelectorContent({
	dashboards,
	onSelect,
}: DashboardSelectorContentProps) {
	if (dashboards.length === 0) {
		return (
			<div className="p-6 text-center">
				<p className="text-muted-foreground mb-4">No dashboards available</p>
				<p className="text-sm text-muted-foreground">
					Create a dashboard first to add this insight
				</p>
			</div>
		);
	}

	return (
		<div className="p-4">
			<h3 className="font-semibold mb-4">Select Dashboard</h3>
			<div className="space-y-2 max-h-[300px] overflow-y-auto">
				{dashboards.map((dashboard) => (
					<button
						key={dashboard.id}
						type="button"
						className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
						onClick={() => onSelect(dashboard.id)}
					>
						{dashboard.name}
					</button>
				))}
			</div>
		</div>
	);
}
