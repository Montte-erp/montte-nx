import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field } from "@packages/ui/components/field";
import { Label } from "@packages/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@packages/ui/components/toggle-group";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { BarChart, Eye, Palette, Settings2, Tag, Trophy } from "lucide-react";

type WidgetOptionsCredenzaProps = {
	config: InsightConfig;
	onApply: (updates: Partial<InsightConfig>) => void;
};

const Y_AXIS_UNITS = [
	{ value: "none", label: "None" },
	{ value: "currency", label: "Currency" },
	{ value: "percentage", label: "Percentage" },
	{ value: "number", label: "Number" },
];

export function WidgetOptionsCredenza({
	config,
	onApply,
}: WidgetOptionsCredenzaProps) {
	const { closeCredenza } = useCredenza();

	const [showLabels, setShowLabels] = useState(config.showLabels ?? false);
	const [showLegend, setShowLegend] = useState(config.showLegend ?? false);
	const [showAlertThresholdLines, setShowAlertThresholdLines] = useState(
		config.showAlertThresholdLines ?? false,
	);
	const [showMultipleYAxes, setShowMultipleYAxes] = useState(
		config.showMultipleYAxes ?? false,
	);
	const [showTrendLine, setShowTrendLine] = useState(config.showTrendLine ?? false);
	const [colorBy, setColorBy] = useState<"name" | "rank">(config.colorBy ?? "name");
	const [yAxisUnit, setYAxisUnit] = useState(config.yAxisUnit || "none");
	const [yAxisScale, setYAxisScale] = useState<"linear" | "logarithmic">(
		config.yAxisScale ?? "linear",
	);
	const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(
		config.showConfidenceIntervals ?? false,
	);
	const [showMovingAverage, setShowMovingAverage] = useState(
		config.showMovingAverage ?? false,
	);

	const handleApply = () => {
		onApply({
			showLabels,
			showLegend,
			showAlertThresholdLines,
			showMultipleYAxes,
			showTrendLine,
			colorBy,
			yAxisUnit: yAxisUnit === "none" ? undefined : yAxisUnit,
			yAxisScale,
			showConfidenceIntervals,
			showMovingAverage,
		});
		closeCredenza();
	};

	const handleCancel = () => {
		closeCredenza();
	};

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<Settings2 className="h-5 w-5" />
					Opções do Widget
				</CredenzaTitle>
				<CredenzaDescription>
					Configure a exibição do widget
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="max-h-[60vh] overflow-y-auto">
				<div className="space-y-6">
					{/* Display Settings */}
					<section className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b">
							<Eye className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Configurações de Exibição
							</h4>
						</div>
						<div className="space-y-4 pl-6">
							<SwitchField
								id="show-labels"
								label="Mostrar valores na série"
								checked={showLabels}
								onCheckedChange={setShowLabels}
							/>
							<SwitchField
								id="show-legend"
								label="Mostrar legenda"
								checked={showLegend}
								onCheckedChange={setShowLegend}
							/>
							<SwitchField
								id="show-threshold"
								label="Mostrar linhas de limite de alerta"
								checked={showAlertThresholdLines}
								onCheckedChange={setShowAlertThresholdLines}
							/>
							<SwitchField
								id="show-multi-y-axis"
								label="Mostrar múltiplos eixos Y"
								checked={showMultipleYAxes}
								onCheckedChange={setShowMultipleYAxes}
							/>
							<SwitchField
								id="show-trend-line"
								label="Mostrar linha de tendência"
								checked={showTrendLine}
								onCheckedChange={setShowTrendLine}
							/>
						</div>
					</section>

					{/* Color Customization */}
					<section className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b">
							<Palette className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Personalização de Cores
							</h4>
						</div>
						<ToggleGroup
							type="single"
							value={colorBy}
							onValueChange={(value) => value && setColorBy(value as "name" | "rank")}
							variant="outline"
							className="w-full grid grid-cols-2"
						>
							<ToggleGroupItem value="name" className="flex items-center gap-2">
								<Tag className="h-4 w-4" />
								Por nome
							</ToggleGroupItem>
							<ToggleGroupItem value="rank" className="flex items-center gap-2">
								<Trophy className="h-4 w-4" />
								Por classificação
							</ToggleGroupItem>
						</ToggleGroup>
					</section>

					{/* Y-Axis Settings */}
					<section className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b">
							<BarChart className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Eixo Y
							</h4>
						</div>
						<div className="space-y-4">
							<Field>
								<Label className="text-sm font-normal">
									Unidade do eixo Y
								</Label>
								<Select value={yAxisUnit} onValueChange={setYAxisUnit}>
									<SelectTrigger className="h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Y_AXIS_UNITS.map((unit) => (
											<SelectItem key={unit.value} value={unit.value}>
												{unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<div>
								<Label className="text-sm font-normal mb-2 block">
									Escala do eixo Y
								</Label>
								<ToggleGroup
									type="single"
									value={yAxisScale}
									onValueChange={(value) =>
										value && setYAxisScale(value as "linear" | "logarithmic")
									}
									variant="outline"
									className="w-full grid grid-cols-2"
								>
									<ToggleGroupItem value="linear">
										Linear
									</ToggleGroupItem>
									<ToggleGroupItem value="logarithmic">
										Logarítmica
									</ToggleGroupItem>
								</ToggleGroup>
							</div>
						</div>
					</section>

					{/* Statistical Analysis */}
					<section className="space-y-4">
						<div className="flex items-center gap-2 pb-2 border-b">
							<BarChart className="h-4 w-4 text-muted-foreground" />
							<h4 className="text-sm font-medium">
								Análise Estatística
							</h4>
						</div>
						<div className="space-y-4 pl-6">
							<SwitchField
								id="show-confidence"
								label="Mostrar intervalos de confiança"
								checked={showConfidenceIntervals}
								onCheckedChange={setShowConfidenceIntervals}
							/>
							<SwitchField
								id="show-moving-avg"
								label="Mostrar média móvel"
								checked={showMovingAverage}
								onCheckedChange={setShowMovingAverage}
							/>
						</div>
					</section>
				</div>
			</CredenzaBody>
			<CredenzaFooter>
				<Button variant="outline" onClick={handleCancel}>
					Cancelar
				</Button>
				<Button onClick={handleApply}>
					Aplicar
				</Button>
			</CredenzaFooter>
		</>
	);
}

type SwitchFieldProps = {
	id: string;
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
};

function SwitchField({ id, label, checked, onCheckedChange }: SwitchFieldProps) {
	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id} className="text-sm font-normal cursor-pointer">
				{label}
			</Label>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}
