import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@packages/ui/components/empty";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Label } from "@packages/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, Plus } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
	type TransactionRow,
	buildTransactionColumns,
} from "@/features/transactions/ui/transactions-columns";
import { TransactionSheet } from "@/features/transactions/ui/transactions-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
	"/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions",
)({ component: TransactionsPage });

// =============================================================================
// Skeleton
// =============================================================================

function TransactionsSkeleton() {
	return (
		<div className="space-y-3">
			{Array.from({ length: 5 }).map((_, index) => (
				<Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
			))}
		</div>
	);
}

// =============================================================================
// Filter Bar
// =============================================================================

interface TransactionFilters {
	type?: "income" | "expense" | "transfer";
	dateFrom?: string;
	dateTo?: string;
}

interface FilterBarProps {
	filters: TransactionFilters;
	onFiltersChange: (filters: TransactionFilters) => void;
}

function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="space-y-1 min-w-[160px]">
				<Label htmlFor="filter-type">Tipo</Label>
				<Select
					onValueChange={(v) =>
						onFiltersChange({
							...filters,
							type: v === "all" ? undefined : (v as TransactionFilters["type"]),
						})
					}
					value={filters.type ?? "all"}
				>
					<SelectTrigger id="filter-type" className="h-8 text-sm">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Todos</SelectItem>
						<SelectItem value="income">Receita</SelectItem>
						<SelectItem value="expense">Despesa</SelectItem>
						<SelectItem value="transfer">Transferência</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-1">
				<Label>De</Label>
				<DatePicker
					className="h-8 text-sm w-[160px]"
					date={filters.dateFrom ? new Date(`${filters.dateFrom}T12:00:00`) : undefined}
					onSelect={(d) =>
						onFiltersChange({
							...filters,
							dateFrom: d ? d.toISOString().split("T")[0] : undefined,
						})
					}
					placeholder="Data inicial"
				/>
			</div>

			<div className="space-y-1">
				<Label>Até</Label>
				<DatePicker
					className="h-8 text-sm w-[160px]"
					date={filters.dateTo ? new Date(`${filters.dateTo}T12:00:00`) : undefined}
					onSelect={(d) =>
						onFiltersChange({
							...filters,
							dateTo: d ? d.toISOString().split("T")[0] : undefined,
						})
					}
					placeholder="Data final"
				/>
			</div>

			{(filters.type || filters.dateFrom || filters.dateTo) && (
				<Button
					className="h-8 text-sm"
					onClick={() => onFiltersChange({})}
					size="sm"
					variant="ghost"
				>
					Limpar filtros
				</Button>
			)}
		</div>
	);
}

// =============================================================================
// List
// =============================================================================

interface TransactionsListProps {
	filters: TransactionFilters;
}

function TransactionsList({ filters }: TransactionsListProps) {
	const { openCredenza, closeCredenza } = useCredenza();
	const { openAlertDialog } = useAlertDialog();

	const { data: transactions } = useSuspenseQuery(
		orpc.transactions.getAll.queryOptions({ input: filters }),
	);

	const deleteMutation = useMutation(
		orpc.transactions.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Transação excluída com sucesso.");
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao excluir transação.");
			},
		}),
	);

	const handleEdit = useCallback(
		(transaction: TransactionRow) => {
			openCredenza({
				children: (
					<TransactionSheet
						mode="edit"
						transaction={transaction}
						onSuccess={closeCredenza}
					/>
				),
			});
		},
		[openCredenza, closeCredenza],
	);

	const handleDelete = useCallback(
		(transaction: TransactionRow) => {
			openAlertDialog({
				title: "Excluir transação",
				description:
					"Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.",
				actionLabel: "Excluir",
				cancelLabel: "Cancelar",
				variant: "destructive",
				onAction: async () => {
					await deleteMutation.mutateAsync({ id: transaction.id });
				},
			});
		},
		[openAlertDialog, deleteMutation],
	);

	const columns = useMemo(
		() => buildTransactionColumns(handleEdit, handleDelete),
		[handleEdit, handleDelete],
	);

	if (transactions.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<ArrowLeftRight className="size-6" />
					</EmptyMedia>
					<EmptyTitle>Nenhuma transação</EmptyTitle>
					<EmptyDescription>
						Registre uma nova transação para começar a controlar suas finanças.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<DataTable
			columns={columns}
			data={transactions}
			getRowId={(row) => row.id}
			renderMobileCard={({ row }) => (
				<div className="rounded-lg border bg-background p-4 space-y-3">
					<div className="flex items-start justify-between gap-2">
						<div className="flex flex-col gap-1 min-w-0">
							<p className="text-sm font-medium tabular-nums">
								{row.original.date.split("-").reverse().join("/")}
							</p>
							{(row.original.name || row.original.description) && (
								<p className="text-xs text-muted-foreground truncate">
									{row.original.name || row.original.description}
								</p>
							)}
						</div>
					</div>
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
				</div>
			)}
		/>
	);
}

// =============================================================================
// Page
// =============================================================================

function TransactionsPage() {
	const { openCredenza, closeCredenza } = useCredenza();
	const [filters, setFilters] = useState<TransactionFilters>({});

	const handleCreate = useCallback(() => {
		openCredenza({
			children: <TransactionSheet mode="create" onSuccess={closeCredenza} />,
		});
	}, [openCredenza, closeCredenza]);

	return (
		<main className="flex flex-col gap-4">
			<PageHeader
				actions={
					<Button onClick={handleCreate} size="sm">
						<Plus className="size-4 mr-1" />
						Nova Transação
					</Button>
				}
				description="Gerencie suas receitas, despesas e transferências"
				title="Transações"
			/>
			<FilterBar filters={filters} onFiltersChange={setFilters} />
			<Suspense fallback={<TransactionsSkeleton />}>
				<TransactionsList filters={filters} />
			</Suspense>
		</main>
	);
}
