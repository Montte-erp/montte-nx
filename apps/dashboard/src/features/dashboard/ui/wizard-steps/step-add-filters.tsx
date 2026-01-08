import type {
	InsightConfig,
	InsightFilter,
} from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Plus, Trash2 } from "lucide-react";

const FILTER_OPERATORS = [
	{ value: "equals", label: "equals" },
	{ value: "not_equals", label: "does not equal" },
	{ value: "contains", label: "contains" },
	{ value: "gt", label: "is greater than" },
	{ value: "lt", label: "is less than" },
	{ value: "gte", label: "is at least" },
	{ value: "lte", label: "is at most" },
] as const;

const FILTER_FIELDS: Record<
	string,
	Array<{ value: string; label: string; type: "text" | "number" | "select" }>
> = {
	transactions: [
		{ value: "type", label: "Type", type: "select" },
		{ value: "categoryId", label: "Category", type: "select" },
		{ value: "bankAccountId", label: "Bank Account", type: "select" },
		{ value: "amount", label: "Amount", type: "number" },
	],
	bills: [
		{ value: "status", label: "Status", type: "select" },
		{ value: "amount", label: "Amount", type: "number" },
	],
	budgets: [{ value: "categoryId", label: "Category", type: "select" }],
	bank_accounts: [
		{ value: "type", label: "Type", type: "select" },
		{ value: "balance", label: "Balance", type: "number" },
	],
};

interface StepAddFiltersProps {
	dataSource: InsightConfig["dataSource"];
	filters: InsightFilter[];
	onFiltersChange: (filters: InsightFilter[]) => void;
}

export function StepAddFilters({
	dataSource,
	filters,
	onFiltersChange,
}: StepAddFiltersProps) {
	const availableFields = FILTER_FIELDS[dataSource] ?? [];

	const handleAddFilter = () => {
		const firstField = availableFields[0];
		if (firstField) {
			onFiltersChange([
				...filters,
				{
					field: firstField.value,
					operator: "equals",
					value: "",
				},
			]);
		}
	};

	const handleRemoveFilter = (index: number) => {
		onFiltersChange(filters.filter((_, i) => i !== index));
	};

	const handleUpdateFilter = (
		index: number,
		updates: Partial<InsightFilter>,
	) => {
		onFiltersChange(
			filters.map((filter, i) =>
				i === index ? { ...filter, ...updates } : filter,
			),
		);
	};

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">Filter your data</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Add filters to narrow down the data shown in your insight. This is
					optional.
				</p>
			</div>

			{filters.length === 0 ? (
				<div className="text-center py-12 border rounded-lg bg-muted/30">
					<p className="text-muted-foreground mb-4">No filters applied</p>
					<Button variant="outline" onClick={handleAddFilter}>
						<Plus className="size-4 mr-2" />
						Add Filter
					</Button>
				</div>
			) : (
				<div className="space-y-3">
					{filters.map((filter, index) => {
						const field = availableFields.find((f) => f.value === filter.field);

						return (
							<div
								key={`filter-${index + 1}`}
								className="flex items-center gap-2 p-3 border rounded-lg bg-card"
							>
								<span className="text-sm text-muted-foreground shrink-0">
									{index === 0 ? "Where" : "and"}
								</span>

								<Select
									value={filter.field}
									onValueChange={(value) =>
										handleUpdateFilter(index, { field: value })
									}
								>
									<SelectTrigger className="w-36">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{availableFields.map((f) => (
											<SelectItem key={f.value} value={f.value}>
												{f.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Select
									value={filter.operator}
									onValueChange={(value) =>
										handleUpdateFilter(index, {
											operator: value as InsightFilter["operator"],
										})
									}
								>
									<SelectTrigger className="w-40">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{FILTER_OPERATORS.map((op) => (
											<SelectItem key={op.value} value={op.value}>
												{op.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								<Input
									type={field?.type === "number" ? "number" : "text"}
									placeholder="Value"
									value={String(filter.value)}
									onChange={(e) =>
										handleUpdateFilter(index, { value: e.target.value })
									}
									className="flex-1"
								/>

								<Button
									variant="ghost"
									size="icon"
									className="shrink-0 text-muted-foreground hover:text-destructive"
									onClick={() => handleRemoveFilter(index)}
								>
									<Trash2 className="size-4" />
								</Button>
							</div>
						);
					})}

					<Button
						variant="outline"
						size="sm"
						className="w-full"
						onClick={handleAddFilter}
					>
						<Plus className="size-4 mr-2" />
						Add Another Filter
					</Button>
				</div>
			)}

			{filters.length > 0 && (
				<div className="p-3 rounded-lg bg-muted/50 border">
					<p className="text-xs text-muted-foreground">
						<span className="font-medium">Preview:</span> Showing data where{" "}
						{filters
							.map((f, i) => {
								const field = availableFields.find(
									(af) => af.value === f.field,
								);
								const op = FILTER_OPERATORS.find(
									(o) => o.value === f.operator,
								);
								return `${i > 0 ? " and " : ""}${field?.label ?? f.field} ${op?.label ?? f.operator} "${f.value}"`;
							})
							.join("")}
					</p>
				</div>
			)}
		</div>
	);
}
