import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { openInsightTab } from "@/features/dashboard/hooks/use-dashboard-tabs";

export function InsightsListPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { activeOrganization } = useActiveOrganization();
	const { openAlertDialog } = useAlertDialog();

	const { data: insights, isLoading } = useQuery(
		trpc.dashboards.getAllSavedInsights.queryOptions(),
	);

	const deleteMutation = useMutation(
		trpc.dashboards.deleteSavedInsight.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getAllSavedInsights.queryKey(),
				});
				toast.success("Insight deleted");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete insight");
			},
		}),
	);

	const handleOpen = (insightId: string, name: string) => {
		openInsightTab(insightId, name);
		router.navigate({
			to: "/$slug/insights/$insightId",
			params: { slug: activeOrganization.slug, insightId },
		});
	};

	const handleDelete = (id: string, name: string) => {
		openAlertDialog({
			title: "Delete Insight",
			description: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
			actionLabel: "Delete",
			variant: "destructive",
			onAction: async () => {
				await deleteMutation.mutateAsync({ id });
			},
		});
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<Skeleton className="h-8 w-48" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<Skeleton key={`skeleton-${i + 1}`} className="h-32" />
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Saved Insights</h1>
					<p className="text-muted-foreground">
						View and manage your saved insights
					</p>
				</div>
			</div>

			{insights && insights.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{insights.map((insight) => (
						<Card
							key={insight.id}
							className="cursor-pointer hover:bg-muted/50 transition-colors group relative"
							onClick={() => handleOpen(insight.id, insight.name)}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-3">
										<div className="rounded-md bg-blue-500/10 p-2">
											<Sparkles className="h-4 w-4 text-blue-500" />
										</div>
										<div>
											<CardTitle className="text-base">
												{insight.name}
											</CardTitle>
											<CardDescription className="line-clamp-2">
												{insight.description || "No description"}
											</CardDescription>
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(insight.id, insight.name);
										}}
									>
										<Trash2 className="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</CardHeader>
						</Card>
					))}
				</div>
			) : (
				<Card className="border-dashed">
					<CardHeader className="text-center py-12">
						<div className="mx-auto rounded-full bg-muted p-3 mb-4 w-fit">
							<Sparkles className="h-6 w-6 text-muted-foreground" />
						</div>
						<CardTitle className="text-lg">No saved insights yet</CardTitle>
						<CardDescription className="mb-4">
							Create insights from dashboards to save and reuse them
						</CardDescription>
					</CardHeader>
				</Card>
			)}
		</div>
	);
}
