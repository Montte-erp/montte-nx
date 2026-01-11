import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Textarea } from "@packages/ui/components/textarea";
import { Badge } from "@packages/ui/components/badge";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCredenza } from "@/hooks/use-credenza";
import { trpc, useTRPC } from "@/integrations/clients";
import { toast } from "sonner";
import {
	AreaChart,
	BarChart3,
	Bookmark,
	Calendar,
	Database,
	Filter,
	Globe,
	Hash,
	Layers,
	LineChart,
	PieChart,
	Scale,
	Settings2,
	Table2,
	TrendingUp,
	GitMerge,
	Grid3X3,
	Clock,
} from "lucide-react";
import { useState } from "react";

type SaveAsInsightCredenzaProps = {
	config: InsightConfig;
	defaultName?: string;
	defaultDescription?: string;
};

// Label mappings for human-readable display
const DATA_SOURCE_LABELS: Record<InsightConfig["dataSource"], string> = {
	transactions: "Transacoes",
	bills: "Contas a pagar",
	budgets: "Orcamentos",
	bank_accounts: "Contas bancarias",
};

const AGGREGATION_LABELS: Record<InsightConfig["aggregation"], string> = {
	sum: "Soma",
	count: "Contagem",
	average: "Media",
	min: "Minimo",
	max: "Maximo",
};

const TIME_GROUPING_LABELS: Record<NonNullable<InsightConfig["timeGrouping"]>, string> = {
	day: "Dia",
	week: "Semana",
	month: "Mes",
	quarter: "Trimestre",
	year: "Ano",
};

const DATE_RANGE_LABELS: Record<string, string> = {
	today: "Hoje",
	yesterday: "Ontem",
	last_7_days: "Ultimos 7 dias",
	last_30_days: "Ultimos 30 dias",
	last_90_days: "Ultimos 90 dias",
	this_month: "Este mes",
	last_month: "Mes passado",
	this_quarter: "Este trimestre",
	this_year: "Este ano",
	last_year: "Ano passado",
};

const COMPARISON_LABELS: Record<string, string> = {
	previous_period: "Periodo anterior",
	previous_year: "Ano anterior",
};

const CHART_TYPE_CONFIG: Record<InsightConfig["chartType"], { label: string; icon: typeof LineChart }> = {
	line: { label: "Grafico de linhas", icon: LineChart },
	area: { label: "Grafico de area", icon: AreaChart },
	bar: { label: "Grafico de barras", icon: BarChart3 },
	stacked_bar: { label: "Barras empilhadas", icon: Layers },
	line_cumulative: { label: "Linha cumulativa", icon: TrendingUp },
	pie: { label: "Grafico de pizza", icon: PieChart },
	donut: { label: "Grafico de rosca", icon: PieChart },
	stat_card: { label: "Numero", icon: Hash },
	bar_total: { label: "Barras (total)", icon: BarChart3 },
	table: { label: "Tabela", icon: Table2 },
	world_map: { label: "Mapa mundial", icon: Globe },
	category_analysis: { label: "Analise por categoria", icon: Layers },
	comparison: { label: "Comparacao", icon: Scale },
	sankey: { label: "Diagrama de Sankey", icon: GitMerge },
	heatmap: { label: "Mapa de calor", icon: Grid3X3 },
};

export function SaveAsInsightCredenza({
	config,
	defaultName = "",
	defaultDescription = "",
}: SaveAsInsightCredenzaProps) {
	const { closeCredenza } = useCredenza();
	const queryClient = useQueryClient();
	const trpcHook = useTRPC();

	const [name, setName] = useState(defaultName);
	const [description, setDescription] = useState(defaultDescription);
	const [errors, setErrors] = useState<{ name?: string }>({});

	const saveInsightMutation = useMutation(
		trpc.dashboards.createSavedInsight.mutationOptions({
			onSuccess: () => {
				toast.success("Insight salvo com sucesso");
				queryClient.invalidateQueries({
					queryKey: trpcHook.dashboards.getAllSavedInsights.queryKey(),
				});
				closeCredenza();
			},
			onError: (error) => {
				toast.error(error.message || "Falha ao salvar insight");
			},
		}),
	);

	const handleSave = () => {
		// Validation
		const newErrors: { name?: string } = {};
		if (!name.trim()) {
			newErrors.name = "Nome e obrigatorio";
		} else if (name.length > 100) {
			newErrors.name = "Nome deve ter no maximo 100 caracteres";
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		setErrors({});
		saveInsightMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
			config,
		});
	};

	const handleCancel = () => {
		closeCredenza();
	};

	// Get chart type info
	const chartTypeInfo = CHART_TYPE_CONFIG[config.chartType] || { label: config.chartType, icon: BarChart3 };
	const ChartIcon = chartTypeInfo.icon;

	// Count active filters
	const filterCount = config.filters?.length || 0;

	// Get display options that are enabled
	const enabledOptions: string[] = [];
	if (config.showLegend) enabledOptions.push("Legenda");
	if (config.showLabels) enabledOptions.push("Rotulos");
	if (config.showTrendLine) enabledOptions.push("Linha de tendencia");
	if (config.showAlertThresholdLines) enabledOptions.push("Limites de alerta");
	if (config.showMovingAverage) enabledOptions.push("Media movel");
	if (config.showConfidenceIntervals) enabledOptions.push("Intervalos de confianca");
	if (config.forecast?.enabled) enabledOptions.push("Previsao");
	if (config.comparisonOverlay?.enabled) enabledOptions.push("Sobreposicao de comparacao");
	if (config.miniChart) enabledOptions.push("Mini grafico");

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<Bookmark className="h-5 w-5" />
					Salvar como Insight
				</CredenzaTitle>
				<CredenzaDescription>
					Salve esta configuracao para reutilizar em outros dashboards
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="max-h-[60vh] overflow-y-auto">
				<div className="space-y-6">
					{/* Form Fields */}
					<section className="space-y-4">
						<Field>
							<FieldLabel>Nome *</FieldLabel>
							<Input
								placeholder="Ex: Gastos mensais por categoria"
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									if (errors.name) setErrors({});
								}}
								className={errors.name ? "border-destructive" : ""}
							/>
							{errors.name && <FieldError>{errors.name}</FieldError>}
						</Field>
						<Field>
							<FieldLabel>Descricao (opcional)</FieldLabel>
							<Textarea
								placeholder="Descreva o proposito deste insight..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={2}
							/>
						</Field>
					</section>

					{/* Configuration Preview */}
					<section className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b">
							<Settings2 className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Configuracao
							</h4>
						</div>

						<div className="space-y-3 pl-2">
							{/* Data Source */}
							<ConfigRow
								icon={Database}
								label="Fonte de dados"
								value={DATA_SOURCE_LABELS[config.dataSource]}
							/>

							{/* Aggregation */}
							<ConfigRow
								icon={Hash}
								label="Agregacao"
								value={`${AGGREGATION_LABELS[config.aggregation]} de ${config.aggregateField}`}
							/>

							{/* Chart Type */}
							<div className="flex items-center gap-3 text-sm">
								<ChartIcon className="h-4 w-4 text-muted-foreground shrink-0" />
								<span className="text-muted-foreground">Tipo de grafico:</span>
								<span className="font-medium">{chartTypeInfo.label}</span>
							</div>

							{/* Time Grouping */}
							{config.timeGrouping && (
								<ConfigRow
									icon={Clock}
									label="Agrupado por"
									value={TIME_GROUPING_LABELS[config.timeGrouping]}
								/>
							)}

							{/* Date Range */}
							{config.dateRangeOverride?.relativePeriod && (
								<ConfigRow
									icon={Calendar}
									label="Periodo"
									value={DATE_RANGE_LABELS[config.dateRangeOverride.relativePeriod] || config.dateRangeOverride.relativePeriod}
								/>
							)}

							{/* Comparison */}
							{config.comparison && (
								<ConfigRow
									icon={Scale}
									label="Comparacao"
									value={COMPARISON_LABELS[config.comparison.type] || config.comparison.type}
								/>
							)}

							{/* Breakdown */}
							{config.breakdown && (
								<ConfigRow
									icon={Layers}
									label="Detalhamento"
									value={`Por ${config.breakdown.field}${config.breakdown.limit ? ` (top ${config.breakdown.limit})` : ""}`}
								/>
							)}

							{/* Filters */}
							{filterCount > 0 && (
								<div className="flex items-center gap-3 text-sm">
									<Filter className="h-4 w-4 text-muted-foreground shrink-0" />
									<span className="text-muted-foreground">Filtros:</span>
									<Badge variant="secondary" className="text-xs">
										{filterCount} {filterCount === 1 ? "filtro" : "filtros"} ativos
									</Badge>
								</div>
							)}

							{/* Display Options */}
							{enabledOptions.length > 0 && (
								<div className="flex items-start gap-3 text-sm">
									<Settings2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
									<span className="text-muted-foreground shrink-0">Opcoes:</span>
									<div className="flex flex-wrap gap-1">
										{enabledOptions.map((option) => (
											<Badge key={option} variant="outline" className="text-xs">
												{option}
											</Badge>
										))}
									</div>
								</div>
							)}
						</div>
					</section>
				</div>
			</CredenzaBody>
			<CredenzaFooter>
				<Button variant="outline" onClick={handleCancel}>
					Cancelar
				</Button>
				<Button
					onClick={handleSave}
					disabled={saveInsightMutation.isPending}
				>
					{saveInsightMutation.isPending ? "Salvando..." : "Salvar"}
				</Button>
			</CredenzaFooter>
		</>
	);
}

type ConfigRowProps = {
	icon: typeof Database;
	label: string;
	value: string;
};

function ConfigRow({ icon: Icon, label, value }: ConfigRowProps) {
	return (
		<div className="flex items-center gap-3 text-sm">
			<Icon className="h-4 w-4 text-muted-foreground shrink-0" />
			<span className="text-muted-foreground">{label}:</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}
