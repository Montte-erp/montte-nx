import type { BankAccountsConfig } from "@packages/database/schemas/dashboards";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { BankAccountItem } from "@/features/bank-account/ui/bank-account-item";
import { CreateBankAccountItem } from "@/features/bank-account/ui/create-bank-account-item";
import { ManageBankAccountForm } from "@/features/bank-account/ui/manage-bank-account-form";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type BankAccountsWidgetProps = {
	config: BankAccountsConfig;
};

function BankAccountsWidgetSkeleton() {
	return (
		<div className="h-full">
			<div className="grid gap-3 md:grid-cols-3">
				{Array.from({ length: 3 }).map((_, index) => (
					<Skeleton
						className="h-20 w-full"
						key={`bank-account-skeleton-${index + 1}`}
					/>
				))}
			</div>
		</div>
	);
}

function BankAccountsWidgetError() {
	return (
		<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
			Nenhuma Conta Bancária Encontrada
		</div>
	);
}

function BankAccountsWidgetContent({ config }: BankAccountsWidgetProps) {
	const trpc = useTRPC();
	const { openSheet } = useSheet();
	const { data: bankAccounts = [] } = useSuspenseQuery(
		trpc.bankAccounts.getAll.queryOptions(),
	);

	const limit = config.limit || 3;
	const showCreateButton = config.showCreateButton !== false;
	const visibleAccounts = bankAccounts.slice(0, limit);
	const shouldShowCreateTile = showCreateButton && visibleAccounts.length < limit;

	return (
		<div className="h-full">
			<div className="grid gap-3 md:grid-cols-3">
				{visibleAccounts.map((account) => (
					<BankAccountItem account={account} key={account.id} solid />
				))}
				{shouldShowCreateTile && (
					<CreateBankAccountItem
						onCreateAccount={() =>
							openSheet({ children: <ManageBankAccountForm /> })
						}
						solid
					/>
				)}
			</div>
		</div>
	);
}

export function BankAccountsWidget({ config }: BankAccountsWidgetProps) {
	return (
		<ErrorBoundary FallbackComponent={BankAccountsWidgetError}>
			<Suspense fallback={<BankAccountsWidgetSkeleton />}>
				<BankAccountsWidgetContent config={config} />
			</Suspense>
		</ErrorBoundary>
	);
}
