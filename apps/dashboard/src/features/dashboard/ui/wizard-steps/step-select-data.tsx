import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";
import { Building2, CreditCard, PiggyBank, Receipt } from "lucide-react";

const DATA_SOURCES = [
	{
		value: "transactions",
		label: "Transactions",
		description:
			"All income and expense transactions. Best for cash flow analysis.",
		icon: Receipt,
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
	},
	{
		value: "bills",
		label: "Bills",
		description:
			"Recurring bills and scheduled payments. Track upcoming expenses.",
		icon: CreditCard,
		color: "text-red-500",
		bg: "bg-red-500/10",
	},
	{
		value: "budgets",
		label: "Budgets",
		description:
			"Budget allocations and spending. Monitor budget performance.",
		icon: PiggyBank,
		color: "text-purple-500",
		bg: "bg-purple-500/10",
	},
	{
		value: "bank_accounts",
		label: "Bank Accounts",
		description: "Account balances and totals. Overview of your wealth.",
		icon: Building2,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
] as const;

interface StepSelectDataProps {
	value: InsightConfig["dataSource"] | null;
	onChange: (source: InsightConfig["dataSource"]) => void;
}

export function StepSelectData({ value, onChange }: StepSelectDataProps) {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">What data do you want to analyze?</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Select the data source for your insight. This determines what fields
					are available.
				</p>
			</div>

			<div className="grid gap-3">
				{DATA_SOURCES.map((source) => {
					const Icon = source.icon;
					const isSelected = value === source.value;

					return (
						<button
							key={source.value}
							type="button"
							onClick={() =>
								onChange(source.value as InsightConfig["dataSource"])
							}
							className={cn(
								"flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all",
								"hover:border-primary/50 hover:bg-accent/50",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isSelected
									? "border-primary bg-primary/5"
									: "border-border",
							)}
						>
							<div className={cn("p-3 rounded-lg shrink-0", source.bg)}>
								<Icon className={cn("size-6", source.color)} />
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-medium">{source.label}</p>
								<p className="text-sm text-muted-foreground mt-0.5">
									{source.description}
								</p>
							</div>
							{isSelected && (
								<div className="shrink-0 size-5 rounded-full bg-primary flex items-center justify-center">
									<svg
										className="size-3 text-primary-foreground"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={3}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								</div>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
