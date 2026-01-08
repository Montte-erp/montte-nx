import { Button } from "@packages/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type {
	WidgetPosition,
	InsightConfig,
	BalanceCardConfig,
	QuickActionsConfig,
	BankAccountsConfig,
	RecentTransactionsConfig,
} from "@packages/database/schemas/dashboards";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { BalanceCardWidget } from "./balance-card-widget";
import { BankAccountsWidget } from "./bank-accounts-widget";
import { InsightWidget } from "./insight-widget";
import { QuickActionsWidget } from "./quick-actions-widget";
import { RecentTransactionsWidget } from "./recent-transactions-widget";
import { TextCardWidget } from "./text-card-widget";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type Widget = {
	id: string;
	dashboardId: string;
	type: "insight" | "text_card" | "balance_card" | "quick_actions" | "bank_accounts" | "recent_transactions";
	name: string;
	position: WidgetPosition;
	config: unknown;
};

type WidgetContainerProps = {
	widget: Widget;
	onRemove: () => void;
	onEdit: () => void;
	onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

function renderWidgetContent(
	widget: Widget,
	onDrillDown?: (context: DrillDownContext) => void,
) {
	switch (widget.type) {
		case "text_card":
			return (
				<TextCardWidget
					config={widget.config as { type: "text_card"; content: string }}
				/>
			);
		case "balance_card":
			return <BalanceCardWidget config={widget.config as BalanceCardConfig} />;
		case "quick_actions":
			return <QuickActionsWidget config={widget.config as QuickActionsConfig} />;
		case "bank_accounts":
			return <BankAccountsWidget config={widget.config as BankAccountsConfig} />;
		case "recent_transactions":
			return (
				<RecentTransactionsWidget
					config={widget.config as RecentTransactionsConfig}
				/>
			);
		case "insight":
		default:
			return (
				<InsightWidget
					widgetId={widget.id}
					config={widget.config as InsightConfig}
					onDrillDown={onDrillDown}
				/>
			);
	}
}

export function WidgetContainer({
	widget,
	onRemove,
	onEdit,
	onDrillDown,
}: WidgetContainerProps) {
	const handleDrillDown = (context: DrillDownContext) => {
		if (onDrillDown && widget.type === "insight") {
			onDrillDown(widget.config as InsightConfig, context);
		}
	};

	return (
		<Card className="h-full flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between py-3 px-4 space-y-0">
				<div className="flex items-center gap-2">
					<div className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded">
						<GripVertical className="h-4 w-4 text-muted-foreground" />
					</div>
					<CardTitle className="text-sm font-medium">{widget.name}</CardTitle>
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8">
							<MoreHorizontal className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onEdit}>
							<Pencil className="h-4 w-4 mr-2" />
							Edit
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={onRemove}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Remove
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden p-4 pt-0">
				{renderWidgetContent(widget, onDrillDown ? handleDrillDown : undefined)}
			</CardContent>
		</Card>
	);
}
