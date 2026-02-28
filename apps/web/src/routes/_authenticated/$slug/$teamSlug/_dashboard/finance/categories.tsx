import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, LayoutGrid, LayoutList, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
	type CategoryRow,
	buildCategoryColumns,
} from "@/features/categories/ui/categories-columns";
import { CategorySheet } from "@/features/categories/ui/categories-sheet";
import { type ViewConfig, useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
	"/_authenticated/$slug/$teamSlug/_dashboard/finance/categories",
)({ component: CategoriesPage });

const CATEGORY_VIEWS: [ViewConfig<"table" | "card">, ViewConfig<"table" | "card">] = [
	{ id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
	{ id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function CategoriesSkeleton() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 5 }).map((_, index) => (
				<Skeleton
					className="h-12 w-full"
					key={`skeleton-${index + 1}`}
				/>
			))}
		</div>
	);
}

// =============================================================================
// List
// =============================================================================

interface CategoriesListProps {
	view: "table" | "card";
}

function CategoriesList({ view }: CategoriesListProps) {
	const { openCredenza, closeCredenza } = useCredenza();
	const { openAlertDialog } = useAlertDialog();

	const { data: categories } = useSuspenseQuery(
		orpc.categories.getAll.queryOptions({}),
	);

	const deleteMutation = useMutation(
		orpc.categories.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Categoria excluída com sucesso.");
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao excluir categoria.");
			},
		}),
	);

	const handleEdit = useCallback(
		(category: CategoryRow) => {
			openCredenza({
				children: (
					<CategorySheet
						category={{
							id: category.id,
							name: category.name,
							color: category.color,
							icon: category.icon,
							type: category.type,
						}}
						mode="edit"
						onSuccess={closeCredenza}
					/>
				),
			});
		},
		[openCredenza, closeCredenza],
	);

	const handleDelete = useCallback(
		(category: CategoryRow) => {
			openAlertDialog({
				title: "Excluir categoria",
				description: `Tem certeza que deseja excluir a categoria "${category.name}"? Esta ação não pode ser desfeita.`,
				actionLabel: "Excluir",
				cancelLabel: "Cancelar",
				variant: "destructive",
				onAction: async () => {
					await deleteMutation.mutateAsync({ id: category.id });
				},
			});
		},
		[openAlertDialog, deleteMutation],
	);

	const columns = buildCategoryColumns(handleEdit, handleDelete);

	if (categories.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FolderOpen className="size-6" />
					</EmptyMedia>
					<EmptyTitle>Nenhuma categoria</EmptyTitle>
					<EmptyDescription>
						Adicione uma categoria para organizar suas transações.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	if (view === "card") {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{categories.map((category) => (
					<div
						className="rounded-lg border bg-background p-4 space-y-3"
						key={category.id}
					>
						<div className="flex items-center gap-2 min-w-0">
							{category.color && (
								<span
									className="size-4 rounded-full shrink-0"
									style={{ backgroundColor: category.color }}
								/>
							)}
							<p className="font-medium truncate">{category.name}</p>
						</div>
						{!category.isDefault && (
							<div className="flex items-center gap-2">
								<Button
									onClick={() => handleEdit(category)}
									size="sm"
									variant="outline"
								>
									Editar
								</Button>
								<Button
									className="text-destructive"
									onClick={() => handleDelete(category)}
									size="sm"
									variant="ghost"
								>
									Excluir
								</Button>
							</div>
						)}
					</div>
				))}
			</div>
		);
	}

	return (
		<DataTable
			columns={columns}
			data={categories}
			getRowId={(row) => row.id}
			renderMobileCard={({ row }) => (
				<div className="rounded-lg border bg-background p-4 space-y-3">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							{row.original.color && (
								<span
									className="size-4 rounded-full shrink-0"
									style={{ backgroundColor: row.original.color }}
								/>
							)}
							<p className="font-medium truncate">{row.original.name}</p>
						</div>
					</div>
					{!row.original.isDefault && (
						<div className="flex items-center gap-2">
							<Button
								onClick={() => handleEdit(row.original)}
								size="sm"
								variant="outline"
							>
								Editar
							</Button>
							<Button
								className="text-destructive"
								onClick={() => handleDelete(row.original)}
								size="sm"
								variant="ghost"
							>
								Excluir
							</Button>
						</div>
					)}
				</div>
			)}
		/>
	);
}

// =============================================================================
// Page
// =============================================================================

function CategoriesPage() {
	const { openCredenza, closeCredenza } = useCredenza();
	const { currentView, setView, views } = useViewSwitch(
		"finance:categories:view",
		CATEGORY_VIEWS,
	);

	const handleCreate = useCallback(() => {
		openCredenza({
			children: <CategorySheet mode="create" onSuccess={closeCredenza} />,
		});
	}, [openCredenza, closeCredenza]);

	return (
		<main className="flex flex-col gap-4">
			<DefaultHeader
				actions={
					<Button onClick={handleCreate} size="sm">
						<Plus className="size-4 mr-1" />
						Nova Categoria
					</Button>
				}
				description="Gerencie as categorias das suas transações"
				title="Categorias"
				viewSwitch={
					<ViewSwitchDropdown
						currentView={currentView}
						onViewChange={setView}
						views={views}
					/>
				}
			/>
			<Suspense fallback={<CategoriesSkeleton />}>
				<CategoriesList view={currentView} />
			</Suspense>
		</main>
	);
}
