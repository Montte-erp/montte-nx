import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Avatar, AvatarFallback } from "@packages/ui/components/avatar";
import {
	ArrowDownUp,
	Banknote,
	BarChart3,
	CreditCard,
	Layers,
	LineChart,
	PieChart,
	Plus,
	Scale,
	Search,
	Sparkles,
	Table2,
	TrendingUp,
	Wallet,
	X,
} from "lucide-react";
import { useTRPC } from "@/integrations/clients";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";

export type DefaultInsightType = "transactions" | "bills" | "budgets" | "bank_accounts";

type InsightPickerCredenzaProps = {
	onSelectDefault: (type: DefaultInsightType) => void;
	onSelectSaved: (insight: SavedInsight) => void;
};

type SavedInsight = {
	id: string;
	name: string;
	description: string | null;
	config: InsightConfig;
	createdAt: Date;
	updatedAt: Date;
};

const DEFAULT_INSIGHTS: Array<{
	type: DefaultInsightType;
	name: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{
		type: "transactions",
		name: "Transactions",
		description: "Track income and expenses over time",
		icon: ArrowDownUp,
	},
	{
		type: "bills",
		name: "Bills",
		description: "Monitor upcoming and recurring bills",
		icon: CreditCard,
	},
	{
		type: "budgets",
		name: "Budgets",
		description: "Budget tracking and spending analysis",
		icon: Wallet,
	},
	{
		type: "bank_accounts",
		name: "Bank Accounts",
		description: "Account balances and cash flow",
		icon: Banknote,
	},
];

const CHART_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
	stat_card: TrendingUp,
	line: LineChart,
	bar: BarChart3,
	pie: PieChart,
	donut: PieChart,
	table: Table2,
	category_analysis: Layers,
	comparison: Scale,
};

function formatRelativeTime(date: Date | string): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins} min ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
	const diffMonths = Math.floor(diffDays / 30);
	if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
	return d.toLocaleDateString();
}

export function InsightPickerCredenza({
	onSelectDefault,
	onSelectSaved,
}: InsightPickerCredenzaProps) {
	const [search, setSearch] = useState("");
	const trpc = useTRPC();

	const { data: savedInsights = [] } = useQuery(
		trpc.dashboards.getAllSavedInsights.queryOptions({ search: search || undefined }),
	);

	const filteredDefaults = DEFAULT_INSIGHTS.filter(
		(insight) =>
			insight.name.toLowerCase().includes(search.toLowerCase()) ||
			insight.description.toLowerCase().includes(search.toLowerCase()),
	);

	const hasResults = filteredDefaults.length > 0 || savedInsights.length > 0;

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<Sparkles className="h-5 w-5" />
					Add insight
				</CredenzaTitle>
				<CredenzaDescription>
					Choose from default insights or your saved ones
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="pb-6">
				<div className="relative mb-4">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search insights..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-10 pr-10 h-11"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
						>
							<X className="h-3 w-3 text-muted-foreground" />
						</button>
					)}
				</div>

				{!hasResults ? (
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="rounded-full bg-muted p-4 mb-4">
							<Search className="h-6 w-6 text-muted-foreground" />
						</div>
						<p className="text-muted-foreground font-medium">No insights found</p>
						<p className="text-sm text-muted-foreground mt-1">Try a different search term</p>
					</div>
				) : (
					<>
						{/* Desktop: Table view */}
						<div className="hidden md:block max-h-[400px] overflow-auto rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50">
										<TableHead className="w-12" />
										<TableHead className="text-xs font-medium uppercase tracking-wider">Name</TableHead>
										<TableHead className="text-xs font-medium uppercase tracking-wider">Created by</TableHead>
										<TableHead className="text-xs font-medium uppercase tracking-wider">Created</TableHead>
										<TableHead className="text-xs font-medium uppercase tracking-wider">Last modified</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{/* Default Insights */}
									{filteredDefaults.map((insight) => (
										<TableRow 
											key={insight.type} 
											className="group transition-colors hover:bg-muted/50"
										>
											<TableCell>
												<Button
													size="icon"
													variant="ghost"
													className={cn(
														"h-8 w-8 rounded-full border border-border",
														"transition-all duration-200",
														"group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
													)}
													onClick={() => onSelectDefault(insight.type)}
												>
													<Plus className="h-4 w-4" />
												</Button>
											</TableCell>
											<TableCell>
												<div className="flex items-center gap-3">
													<div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
														<insight.icon className="h-5 w-5 text-muted-foreground" />
													</div>
													<div className="min-w-0">
														<div className="font-medium truncate">{insight.name}</div>
														<div className="text-sm text-muted-foreground truncate">
															{insight.description}
														</div>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<span className="text-muted-foreground text-sm">System</span>
											</TableCell>
											<TableCell>
												<span className="text-muted-foreground text-sm">-</span>
											</TableCell>
											<TableCell>
												<span className="text-muted-foreground text-sm">-</span>
											</TableCell>
										</TableRow>
									))}

									{/* Saved Insights */}
									{savedInsights.map((insight) => {
										const Icon = CHART_TYPE_ICONS[insight.config.chartType] || BarChart3;
										return (
											<TableRow 
												key={insight.id} 
												className="group transition-colors hover:bg-muted/50"
											>
												<TableCell>
													<Button
														size="icon"
														variant="ghost"
														className={cn(
															"h-8 w-8 rounded-full border border-border",
															"transition-all duration-200",
															"group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
														)}
														onClick={() => onSelectSaved(insight)}
													>
														<Plus className="h-4 w-4" />
													</Button>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-3">
														<div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
															<Icon className="h-5 w-5 text-muted-foreground" />
														</div>
														<div className="min-w-0">
															<div className="font-medium truncate">{insight.name}</div>
															{insight.description && (
																<div className="text-sm text-muted-foreground truncate">
																	{insight.description}
																</div>
															)}
														</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<Avatar className="h-6 w-6">
															<AvatarFallback className="text-xs bg-primary/10 text-primary">M</AvatarFallback>
														</Avatar>
														<span className="text-muted-foreground text-sm">you</span>
													</div>
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatRelativeTime(insight.createdAt)}
												</TableCell>
												<TableCell className="text-muted-foreground text-sm">
													{formatRelativeTime(insight.updatedAt)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>

						{/* Mobile: Cards view */}
						<div className="md:hidden max-h-[400px] overflow-auto space-y-2">
							{/* Default Insights */}
							{filteredDefaults.map((insight) => (
								<button
									key={insight.type}
									type="button"
									onClick={() => onSelectDefault(insight.type)}
									className={cn(
										"w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border",
										"bg-card hover:bg-muted/50 hover:border-primary/50",
										"transition-all duration-200 text-left",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									)}
								>
									<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
										<Plus className="h-5 w-5 text-primary" />
									</div>
									<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
										<insight.icon className="h-5 w-5 text-muted-foreground" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="font-medium truncate">{insight.name}</div>
										<div className="text-sm text-muted-foreground truncate">
											{insight.description}
										</div>
									</div>
								</button>
							))}

							{/* Saved Insights */}
							{savedInsights.map((insight) => {
								const Icon = CHART_TYPE_ICONS[insight.config.chartType] || BarChart3;
								return (
									<button
										key={insight.id}
										type="button"
										onClick={() => onSelectSaved(insight)}
										className={cn(
											"w-full flex items-center gap-3 p-4 rounded-xl border-2 border-border",
											"bg-card hover:bg-muted/50 hover:border-primary/50",
											"transition-all duration-200 text-left",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										)}
									>
										<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
											<Plus className="h-5 w-5 text-primary" />
										</div>
										<div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
											<Icon className="h-5 w-5 text-muted-foreground" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="font-medium truncate">{insight.name}</div>
											{insight.description && (
												<div className="text-sm text-muted-foreground truncate">
													{insight.description}
												</div>
											)}
											<div className="text-xs text-muted-foreground mt-1">
												{formatRelativeTime(insight.updatedAt)}
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</>
				)}
			</CredenzaBody>
		</>
	);
}
