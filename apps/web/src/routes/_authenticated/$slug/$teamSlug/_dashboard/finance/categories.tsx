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
import { Tag, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
	type CategoryRow,
	buildCategoryColumns,
} from "@/features/categories/ui/categories-columns";
import { CategorySheet } from "@/features/categories/ui/categories-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
	"/_authenticated/$slug/$teamSlug/_dashboard/finance/categories",
)({ component: CategoriesPage });

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

function CategoriesList() {
	const { openSheet, closeSheet } = useSheet();
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
			openSheet({
				children: (
					<CategorySheet
						category={{ id: category.id, name: category.name }}
						mode="edit"
						onSuccess={closeSheet}
					/>
				),
			});
		},
		[openSheet, closeSheet],
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
						<Tag className="size-6" />
					</EmptyMedia>
					<EmptyTitle>Nenhuma categoria</EmptyTitle>
					<EmptyDescription>
						Adicione uma categoria para organizar suas transações.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
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
	const { openSheet, closeSheet } = useSheet();

	const handleCreate = useCallback(() => {
		openSheet({
			children: <CategorySheet mode="create" onSuccess={closeSheet} />,
		});
	}, [openSheet, closeSheet]);

	return (
		<main className="flex flex-col gap-4">
			<PageHeader
				actions={
					<Button onClick={handleCreate} size="sm">
						<Plus className="size-4 mr-1" />
						Nova Categoria
					</Button>
				}
				description="Gerencie as categorias das suas transações"
				title="Categorias"
			/>
			<Suspense fallback={<CategoriesSkeleton />}>
				<CategoriesList />
			</Suspense>
		</main>
	);
}
