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
import { Input } from "@packages/ui/components/input";
import type {
	WidgetPosition,
	InsightConfig,
	BalanceCardConfig,
	QuickActionsConfig,
	BankAccountsConfig,
	RecentTransactionsConfig,
	AnomalyCardConfig,
	TextCardConfig,
} from "@packages/database/schemas/dashboards";
import {
	ChartLine,
	Filter,
	Maximize2,
	Minimize2,
	MoreHorizontal,
	Pencil,
	Settings2,
	Trash2,
	Bookmark,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@packages/ui/lib/utils";
import { AnomalyWidget } from "./anomaly-widget";
import { BalanceCardWidget } from "./balance-card-widget";
import { BankAccountsWidget } from "./bank-accounts-widget";
import { DisplayTypeCredenza } from "./display-type-credenza";
import { InsightWidget } from "./insight-widget";
import { QuickActionsWidget } from "./quick-actions-widget";
import { RecentTransactionsWidget } from "./recent-transactions-widget";
import { TextCardWidget } from "./text-card-widget";
import { TextCardEditorCredenza } from "./text-card-editor-credenza";
import { WidgetConfigToolbar } from "./widget-config-toolbar";
import { WidgetFiltersCredenza } from "./widget-filters-credenza";
import { WidgetOptionsCredenza } from "./widget-options-credenza";
import { SaveAsInsightCredenza } from "./save-as-insight-credenza";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";
import { useCredenza } from "@/hooks/use-credenza";

type Widget = {
	id: string;
	dashboardId: string;
	type:
	| "insight"
	| "text_card"
	| "balance_card"
	| "quick_actions"
	| "bank_accounts"
	| "recent_transactions"
	| "anomaly_card";
	name: string;
	description: string | null;
	position: WidgetPosition;
	config: unknown;
};

type WidgetContainerProps = {
	widget: Widget;
	onRemove: () => void;
	onUpdateConfig: (updates: Partial<InsightConfig>) => void;
	onUpdateName: (name: string) => void;
	onUpdateDescription: (description: string | null) => void;
	onChangeWidth: (newWidth: number) => void;
	onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

function renderWidgetContent(
	widget: Widget,
	onDrillDown?: (context: DrillDownContext) => void,
	onEditTextCard?: () => void,
) {
	switch (widget.type) {
		case "text_card":
			return (
				<TextCardWidget
					config={widget.config as TextCardConfig}
					onEdit={onEditTextCard}
				/>
			);
		case "balance_card":
			return (
				<BalanceCardWidget config={widget.config as BalanceCardConfig} />
			);
		case "quick_actions":
			return (
				<QuickActionsWidget config={widget.config as QuickActionsConfig} />
			);
		case "bank_accounts":
			return (
				<BankAccountsWidget config={widget.config as BankAccountsConfig} />
			);
		case "recent_transactions":
			return (
				<RecentTransactionsWidget
					config={widget.config as RecentTransactionsConfig}
				/>
			);
		case "anomaly_card":
			return (
				<AnomalyWidget config={widget.config as AnomalyCardConfig} />
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
	onUpdateConfig,
	onUpdateName,
	onUpdateDescription,
	onChangeWidth,
	onDrillDown,
}: WidgetContainerProps) {
	const { openCredenza } = useCredenza();
	const isInsight = widget.type === "insight";
	const isTextCard = widget.type === "text_card";
	const insightConfig = isInsight ? (widget.config as InsightConfig) : null;

	// Width limits: text cards 1-3, insights 3-6
	const currentWidth = widget.position.w;
	const minWidth = isTextCard ? 1 : 3;
	const maxWidth = isTextCard ? 3 : 6;
	const canExpand = currentWidth < maxWidth;
	const canShrink = currentWidth > minWidth;

	// Inline title editing state
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitle, setEditTitle] = useState(widget.name);
	const titleInputRef = useRef<HTMLInputElement>(null);

	// Inline description editing state
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [editDescription, setEditDescription] = useState(
		widget.description || "",
	);
	const descriptionInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditTitle(widget.name);
	}, [widget.name]);

	useEffect(() => {
		setEditDescription(widget.description || "");
	}, [widget.description]);

	useEffect(() => {
		if (isEditingTitle && titleInputRef.current) {
			titleInputRef.current.focus();
			titleInputRef.current.select();
		}
	}, [isEditingTitle]);

	useEffect(() => {
		if (isEditingDescription && descriptionInputRef.current) {
			descriptionInputRef.current.focus();
			descriptionInputRef.current.select();
		}
	}, [isEditingDescription]);

	const handleSaveTitle = () => {
		if (editTitle.trim() && editTitle !== widget.name) {
			onUpdateName(editTitle.trim());
		}
		setIsEditingTitle(false);
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSaveTitle();
		} else if (e.key === "Escape") {
			setEditTitle(widget.name);
			setIsEditingTitle(false);
		}
	};

	const handleSaveDescription = () => {
		const trimmed = editDescription.trim();
		if (trimmed !== (widget.description || "")) {
			onUpdateDescription(trimmed || null);
		}
		setIsEditingDescription(false);
	};

	const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSaveDescription();
		} else if (e.key === "Escape") {
			setEditDescription(widget.description || "");
			setIsEditingDescription(false);
		}
	};

	const handleDrillDown = (context: DrillDownContext) => {
		if (onDrillDown && isInsight) {
			onDrillDown(widget.config as InsightConfig, context);
		}
	};

	const handleExpand = () => {
		if (canExpand) {
			onChangeWidth(currentWidth + 1);
		}
	};

	const handleShrink = () => {
		if (canShrink) {
			onChangeWidth(currentWidth - 1);
		}
	};

	const handleOpenDisplayType = () => {
		if (!insightConfig) return;
		openCredenza({
			children: (
				<DisplayTypeCredenza
					currentType={insightConfig.chartType}
					dataSource={insightConfig.dataSource}
					onSelectType={(chartType) => onUpdateConfig({ chartType })}
				/>
			),
		});
	};

	const handleOpenOptions = () => {
		if (!insightConfig) return;
		openCredenza({
			children: (
				<WidgetOptionsCredenza
					config={insightConfig}
					onApply={onUpdateConfig}
				/>
			),
		});
	};

	const handleOpenFilters = () => {
		if (!insightConfig) return;
		openCredenza({
			children: (
				<WidgetFiltersCredenza
					config={insightConfig}
					onApply={onUpdateConfig}
				/>
			),
		});
	};

	const handleSaveAsInsight = () => {
		if (!insightConfig) return;
		openCredenza({
			children: (
				<SaveAsInsightCredenza
					config={insightConfig}
					defaultName={widget.name}
					defaultDescription={widget.description || ""}
				/>
			),
		});
	};

	return (
		<Card className="h-full flex flex-col">
			{/* Desktop: Config toolbar for insights */}
			{isInsight && insightConfig && (
				<WidgetConfigToolbar
					config={insightConfig}
					onUpdateConfig={onUpdateConfig}
					onOpenOptions={handleOpenOptions}
					onOpenFilters={handleOpenFilters}
					onSaveAsInsight={handleSaveAsInsight}
					canExpand={canExpand}
					canShrink={canShrink}
					onExpand={handleExpand}
					onShrink={handleShrink}
					onRemove={onRemove}
				/>
			)}

			{/* Card header - simplified for text cards, full for other types */}
			{isTextCard ? (
				<CardHeader className="flex flex-row items-center justify-end py-2 px-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{canExpand && (
								<DropdownMenuItem
									onClick={handleExpand}
									className="hidden md:flex"
								>
									<Maximize2 className="h-4 w-4 mr-2" />
									Expandir
								</DropdownMenuItem>
							)}
							{canShrink && (
								<DropdownMenuItem
									onClick={handleShrink}
									className="hidden md:flex"
								>
									<Minimize2 className="h-4 w-4 mr-2" />
									Reduzir
								</DropdownMenuItem>
							)}
							{(canExpand || canShrink) && (
								<DropdownMenuSeparator className="hidden md:block" />
							)}
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={onRemove}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Remover
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardHeader>
			) : (
				<CardHeader className="flex flex-row items-start justify-between py-3 px-4 space-y-0 gap-2">
					<div className="flex items-start gap-2 flex-1 min-w-0">
						<div className="flex flex-col gap-1 flex-1 min-w-0">
							{/* Editable Title */}
							{isEditingTitle ? (
								<Input
									ref={titleInputRef}
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									onBlur={handleSaveTitle}
									onKeyDown={handleTitleKeyDown}
									className="text-sm font-medium h-7 py-1 px-2"
								/>
							) : (
								<CardTitle
									className="text-sm font-medium cursor-pointer hover:bg-muted/50 rounded px-2 py-0.5 -ml-2 inline-flex items-center gap-2 truncate"
									onClick={() => setIsEditingTitle(true)}
								>
									{widget.name}
									<Pencil className="h-3 w-3 text-muted-foreground shrink-0" />
								</CardTitle>
							)}
							{/* Editable Description */}
							{isEditingDescription ? (
								<Input
									ref={descriptionInputRef}
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									onBlur={handleSaveDescription}
									onKeyDown={handleDescriptionKeyDown}
									placeholder="Add a description..."
									className="text-xs h-6 py-1 px-2 text-muted-foreground"
								/>
							) : (
								<span
									className="text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 rounded px-2 py-0.5 -ml-2 inline-flex items-center gap-1.5 truncate"
									onClick={() => setIsEditingDescription(true)}
								>
									{widget.description || (
										<span className="italic text-muted-foreground/70">
											Add description...
										</span>
									)}
									<Pencil className="h-2.5 w-2.5 text-muted-foreground/70 shrink-0" />
								</span>
							)}
						</div>
					</div>
					{/* Mobile: dropdown menu for insights, all platforms for non-insights */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={cn(
									"h-8 w-8 shrink-0",
									isInsight && "md:hidden",
								)}
							>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{/* Width controls for non-insights on desktop */}
							{!isInsight && canExpand && (
								<DropdownMenuItem
									onClick={handleExpand}
									className="hidden md:flex"
								>
									<Maximize2 className="h-4 w-4 mr-2" />
									Expandir
								</DropdownMenuItem>
							)}
							{!isInsight && canShrink && (
								<DropdownMenuItem
									onClick={handleShrink}
									className="hidden md:flex"
								>
									<Minimize2 className="h-4 w-4 mr-2" />
									Reduzir
								</DropdownMenuItem>
							)}
							{!isInsight && (canExpand || canShrink) && (
								<DropdownMenuSeparator className="hidden md:block" />
							)}
							{/* Mobile: Show insight config options via credenzas */}
							{isInsight && (
								<>
									<DropdownMenuItem onClick={handleOpenDisplayType}>
										<ChartLine className="h-4 w-4 mr-2" />
										Tipo de exibição
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleOpenOptions}>
										<Settings2 className="h-4 w-4 mr-2" />
										Opções
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleOpenFilters}>
										<Filter className="h-4 w-4 mr-2" />
										Filtros
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleSaveAsInsight}>
										<Bookmark className="h-4 w-4 mr-2" />
										Salvar como Insight
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={onRemove}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Remover
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</CardHeader>
			)}
			<CardContent className="flex-1 overflow-hidden p-4 pt-0">
				{renderWidgetContent(
					widget,
					onDrillDown ? handleDrillDown : undefined,
					isTextCard
						? () => {
								openCredenza({
									children: (
										<TextCardEditorCredenza
											initialContent={(widget.config as TextCardConfig).content}
											onSave={(content) => {
												onUpdateConfig({ content } as Partial<InsightConfig>);
											}}
										/>
									),
								});
							}
						: undefined,
				)}
			</CardContent>
		</Card>
	);
}
