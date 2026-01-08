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
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function DashboardsListPage() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { activeOrganization } = useActiveOrganization();
	const { openAlertDialog } = useAlertDialog();

	const { data: dashboards, isLoading } = useQuery(
		trpc.dashboards.getAll.queryOptions(),
	);

	const createMutation = useMutation(
		trpc.dashboards.create.mutationOptions({
			onSuccess: (data) => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getAll.queryKey(),
				});
				toast.success("Dashboard created");
				router.navigate({
					to: "/$slug/dashboards/$dashboardId",
					params: { slug: activeOrganization.slug, dashboardId: data.id },
				});
			},
			onError: (error) => {
				toast.error(error.message || "Failed to create dashboard");
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.dashboards.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getAll.queryKey(),
				});
				toast.success("Dashboard deleted");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete dashboard");
			},
		}),
	);

	const handleCreate = () => {
		createMutation.mutate({
			name: "New Dashboard",
			description: undefined,
		});
	};

	const handleDelete = (id: string, name: string) => {
		openAlertDialog({
			title: "Delete Dashboard",
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
					<Skeleton className="h-9 w-36" />
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
					<h1 className="text-2xl font-bold">Dashboards</h1>
					<p className="text-muted-foreground">
						Create and manage your custom dashboards
					</p>
				</div>
				<Button onClick={handleCreate} disabled={createMutation.isPending}>
					<Plus className="h-4 w-4 mr-2" />
					New Dashboard
				</Button>
			</div>

			{dashboards && dashboards.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{dashboards.map((dashboard) => (
						<Card
							key={dashboard.id}
							className="cursor-pointer hover:bg-muted/50 transition-colors group relative"
							onClick={() =>
								router.navigate({
									to: "/$slug/dashboards/$dashboardId",
									params: {
										slug: activeOrganization.slug,
										dashboardId: dashboard.id,
									},
								})
							}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-3">
										<div className="rounded-md bg-primary/10 p-2">
											<LayoutDashboard className="h-4 w-4 text-primary" />
										</div>
										<div>
											<CardTitle className="text-base">
												{dashboard.name}
											</CardTitle>
											<CardDescription className="line-clamp-2">
												{dashboard.description || "No description"}
											</CardDescription>
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="opacity-0 group-hover:opacity-100 transition-opacity"
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(dashboard.id, dashboard.name);
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
							<LayoutDashboard className="h-6 w-6 text-muted-foreground" />
						</div>
						<CardTitle className="text-lg">No dashboards yet</CardTitle>
						<CardDescription className="mb-4">
							Create your first dashboard to start tracking insights
						</CardDescription>
						<Button
							onClick={handleCreate}
							disabled={createMutation.isPending}
							className="mx-auto"
						>
							<Plus className="h-4 w-4 mr-2" />
							Create Dashboard
						</Button>
					</CardHeader>
				</Card>
			)}
		</div>
	);
}
