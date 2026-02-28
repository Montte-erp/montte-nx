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
import { Landmark, LayoutGrid, LayoutList, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
	type BankAccountRow,
	buildBankAccountColumns,
} from "@/features/bank-accounts/ui/bank-accounts-columns";
import { BankAccountSheet } from "@/features/bank-accounts/ui/bank-accounts-sheet";
import {
	type ViewConfig,
	useViewSwitch,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
	"/_authenticated/$slug/$teamSlug/_dashboard/finance/bank-accounts",
)({ component: BankAccountsPage });

const BANK_ACCOUNT_VIEWS: [ViewConfig<"table" | "card">, ViewConfig<"table" | "card">] = [
	{ id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
	{ id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function BankAccountsSkeleton() {
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

interface BankAccountsListProps {
	view: "table" | "card";
}

function BankAccountsList({ view }: BankAccountsListProps) {
	const { openSheet, closeSheet } = useSheet();
	const { openAlertDialog } = useAlertDialog();

	const { data: accounts } = useSuspenseQuery(
		orpc.bankAccounts.getAll.queryOptions({}),
	);

	const deleteMutation = useMutation(
		orpc.bankAccounts.remove.mutationOptions({
			onSuccess: () => {
				toast.success("Conta bancária excluída com sucesso.");
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao excluir conta bancária.");
			},
		}),
	);

	const handleEdit = useCallback(
		(account: BankAccountRow) => {
			openSheet({
				children: (
					<BankAccountSheet
						account={account}
						mode="edit"
						onSuccess={closeSheet}
					/>
				),
			});
		},
		[openSheet, closeSheet],
	);

	const handleDelete = useCallback(
		(account: BankAccountRow) => {
			openAlertDialog({
				title: "Excluir conta bancária",
				description: `Tem certeza que deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`,
				actionLabel: "Excluir",
				cancelLabel: "Cancelar",
				variant: "destructive",
				onAction: async () => {
					await deleteMutation.mutateAsync({ id: account.id });
				},
			});
		},
		[openAlertDialog, deleteMutation],
	);

	const columns = buildBankAccountColumns(handleEdit, handleDelete);

	if (accounts.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<Landmark className="size-6" />
					</EmptyMedia>
					<EmptyTitle>Nenhuma conta bancária</EmptyTitle>
					<EmptyDescription>
						Adicione uma conta bancária para começar a organizar suas finanças.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	if (view === "card") {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{accounts.map((account) => (
					<div
						className="rounded-lg border bg-background p-4 space-y-3"
						key={account.id}
					>
						<div className="flex items-center gap-2 min-w-0">
							<span
								className="size-3 rounded-full shrink-0"
								style={{ backgroundColor: account.color }}
							/>
							<p className="font-medium truncate">{account.name}</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								onClick={() => handleEdit(account)}
								size="sm"
								variant="outline"
							>
								Editar
							</Button>
							<Button
								className="text-destructive"
								onClick={() => handleDelete(account)}
								size="sm"
								variant="ghost"
							>
								Excluir
							</Button>
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<DataTable
			columns={columns}
			data={accounts}
			getRowId={(row) => row.id}
			renderMobileCard={({ row, toggleExpanded, isExpanded, canExpand }) => (
				<div className="rounded-lg border bg-background p-4 space-y-3">
					<div className="flex items-start justify-between gap-2">
						<div className="flex items-center gap-2 min-w-0">
							<span
								className="size-3 rounded-full shrink-0"
								style={{ backgroundColor: row.original.color }}
							/>
							<p className="font-medium truncate">{row.original.name}</p>
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
						{canExpand && (
							<Button onClick={toggleExpanded} size="sm" variant="ghost">
								{isExpanded ? "Ocultar" : "Mais"}
							</Button>
						)}
					</div>
				</div>
			)}
			renderSubComponent={({ row }) => (
				<div className="px-4 py-4 flex items-center gap-2 flex-wrap border-t">
					<Button
						className="text-destructive hover:text-destructive"
						onClick={() => handleDelete(row.original)}
						size="sm"
						variant="ghost"
					>
						<Trash2 className="size-3 mr-2" />
						Excluir
					</Button>
				</div>
			)}
		/>
	);
}

// =============================================================================
// Page
// =============================================================================

function BankAccountsPage() {
	const { openSheet, closeSheet } = useSheet();
	const { currentView, setView, views } = useViewSwitch(
		"finance:bank-accounts:view",
		BANK_ACCOUNT_VIEWS,
	);

	function handleCreate() {
		openSheet({
			children: (
				<BankAccountSheet mode="create" onSuccess={closeSheet} />
			),
		});
	}

	return (
		<main className="flex flex-col gap-4">
			<DefaultHeader
				actions={
					<Button onClick={handleCreate} size="sm">
						<Plus className="size-4 mr-1" />
						Nova Conta
					</Button>
				}
				description="Gerencie suas contas bancárias e saldos"
				title="Contas Bancárias"
				viewSwitch={<ViewSwitchDropdown currentView={currentView} onViewChange={setView} views={views} />}
			/>
			<Suspense fallback={<BankAccountsSkeleton />}>
				<BankAccountsList view={currentView} />
			</Suspense>
		</main>
	);
}
