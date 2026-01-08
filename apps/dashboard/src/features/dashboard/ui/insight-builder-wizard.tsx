import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { defineStepper } from "@packages/ui/components/stepper";
import type {
	InsightConfig,
	WidgetPosition,
} from "@packages/database/schemas/dashboards";
import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";
import { useTRPC } from "@/integrations/clients";

import { StepChooseType } from "./wizard-steps/step-choose-type";
import { StepSelectData } from "./wizard-steps/step-select-data";
import { StepConfigureMetrics } from "./wizard-steps/step-configure-metrics";
import { StepAddDimensions } from "./wizard-steps/step-add-dimensions";
import { StepAddFilters } from "./wizard-steps/step-add-filters";
import { StepReview } from "./wizard-steps/step-review";

type Widget = {
	id: string;
	dashboardId: string;
	type: "insight" | "text_card";
	name: string;
	position: WidgetPosition;
	config: unknown;
};

type InsightBuilderWizardProps = {
	dashboardId: string;
	editWidget?: Widget;
	initialChartType?: InsightConfig["chartType"];
	onSuccess: () => void;
	onCancel: () => void;
};

// Define the stepper steps
const { Stepper, useStepper } = defineStepper(
	{ id: "type", title: "Choose Type" },
	{ id: "source", title: "Select Data" },
	{ id: "metrics", title: "Configure Metrics" },
	{ id: "dimensions", title: "Add Dimensions" },
	{ id: "filters", title: "Add Filters" },
	{ id: "review", title: "Review" },
);

export function InsightBuilderWizard({
	dashboardId,
	editWidget,
	initialChartType,
	onSuccess,
	onCancel,
}: InsightBuilderWizardProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const initialConfig = editWidget?.config as InsightConfig | undefined;

	const [name, setName] = useState(editWidget?.name ?? "New Insight");
	const [config, setConfig] = useState<Partial<InsightConfig>>({
		type: "insight",
		chartType: initialConfig?.chartType ?? initialChartType,
		dataSource: initialConfig?.dataSource ?? "transactions",
		aggregation: initialConfig?.aggregation ?? "sum",
		aggregateField: initialConfig?.aggregateField ?? "amount",
		timeGrouping: initialConfig?.timeGrouping,
		breakdown: initialConfig?.breakdown,
		filters: initialConfig?.filters ?? [],
		comparison: initialConfig?.comparison,
	});

	const addWidgetMutation = useMutation(
		trpc.dashboards.addWidget.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
				toast.success("Insight added");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to add insight");
			},
		}),
	);

	const updateWidgetMutation = useMutation(
		trpc.dashboards.updateWidget.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
				toast.success("Insight updated");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to update insight");
			},
		}),
	);

	const isLoading = addWidgetMutation.isPending || updateWidgetMutation.isPending;

	const handleSave = useCallback(() => {
		const finalConfig: InsightConfig = {
			type: "insight",
			dataSource: config.dataSource!,
			aggregation: config.aggregation!,
			aggregateField: config.aggregateField!,
			timeGrouping: config.timeGrouping,
			breakdown: config.breakdown,
			filters: config.filters ?? [],
			chartType: config.chartType!,
			comparison: config.comparison,
		};

		if (editWidget) {
			updateWidgetMutation.mutate({
				widgetId: editWidget.id,
				name,
				config: finalConfig,
			});
		} else {
			addWidgetMutation.mutate({
				dashboardId,
				name,
				type: "insight",
				position: { x: 0, y: 100, w: 6, h: 3 },
				config: finalConfig,
			});
		}
	}, [config, name, editWidget, dashboardId, addWidgetMutation, updateWidgetMutation]);

	const updateConfig = useCallback((updates: Partial<InsightConfig>) => {
		setConfig((prev) => ({ ...prev, ...updates }));
	}, []);

	return (
		<Stepper.Provider className="h-full flex flex-col">
			{({ methods }) => (
				<WizardContent
					methods={methods}
					name={name}
					setName={setName}
					config={config}
					updateConfig={updateConfig}
					isLoading={isLoading}
					editWidget={editWidget}
					onCancel={onCancel}
					onSave={handleSave}
				/>
			)}
		</Stepper.Provider>
	);
}

type WizardContentProps = {
	methods: ReturnType<typeof useStepper>;
	name: string;
	setName: (name: string) => void;
	config: Partial<InsightConfig>;
	updateConfig: (updates: Partial<InsightConfig>) => void;
	isLoading: boolean;
	editWidget?: Widget;
	onCancel: () => void;
	onSave: () => void;
};

function WizardContent({
	methods,
	name,
	setName,
	config,
	updateConfig,
	isLoading,
	editWidget,
	onCancel,
	onSave,
}: WizardContentProps) {
	const canProceed = validateStep(methods.current.id, config);

	return (
		<>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex items-center gap-4">
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="text-lg font-semibold w-64"
						placeholder="Insight name"
					/>
				</div>
				<Button variant="ghost" size="icon" onClick={onCancel}>
					<X className="size-5" />
				</Button>
			</div>

			{/* Progress Navigation */}
			<div className="px-6 py-4 border-b bg-muted/30">
				<Stepper.Navigation>
					<Stepper.Step of="type" />
					<Stepper.Step of="source" />
					<Stepper.Step of="metrics" />
					<Stepper.Step of="dimensions" />
					<Stepper.Step of="filters" />
					<Stepper.Step of="review" />
				</Stepper.Navigation>
			</div>

			{/* Step Content */}
			<div className="flex-1 overflow-y-auto p-6">
				{methods.current.id === "type" && (
					<StepChooseType
						value={config.chartType ?? null}
						onChange={(type) => updateConfig({ chartType: type })}
					/>
				)}
				{methods.current.id === "source" && (
					<StepSelectData
						value={config.dataSource ?? null}
						onChange={(source) =>
							updateConfig({
								dataSource: source,
								breakdown: undefined,
								filters: [],
							})
						}
					/>
				)}
				{methods.current.id === "metrics" && (
					<StepConfigureMetrics
						dataSource={config.dataSource!}
						aggregation={config.aggregation!}
						aggregateField={config.aggregateField!}
						onAggregationChange={(agg) => updateConfig({ aggregation: agg })}
						onFieldChange={(field) => updateConfig({ aggregateField: field })}
					/>
				)}
				{methods.current.id === "dimensions" && (
					<StepAddDimensions
						dataSource={config.dataSource!}
						timeGrouping={config.timeGrouping}
						breakdown={config.breakdown}
						comparison={config.comparison}
						onTimeGroupingChange={(tg) => updateConfig({ timeGrouping: tg })}
						onBreakdownChange={(bd) => updateConfig({ breakdown: bd })}
						onComparisonChange={(cmp) => updateConfig({ comparison: cmp })}
					/>
				)}
				{methods.current.id === "filters" && (
					<StepAddFilters
						dataSource={config.dataSource!}
						filters={config.filters ?? []}
						onFiltersChange={(filters) => updateConfig({ filters })}
					/>
				)}
				{methods.current.id === "review" && (
					<StepReview config={config as InsightConfig} name={name} />
				)}
			</div>

			{/* Footer Navigation */}
			<div className="flex items-center justify-between p-4 border-t">
				<Button
					variant="outline"
					onClick={methods.prev}
					disabled={methods.isFirst}
				>
					<ArrowLeft className="size-4 mr-2" />
					Back
				</Button>

				{methods.isLast ? (
					<Button onClick={onSave} disabled={isLoading}>
						{isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
						{editWidget ? "Update" : "Create"} Insight
					</Button>
				) : (
					<Button onClick={methods.next} disabled={!canProceed}>
						Next
						<ArrowRight className="size-4 ml-2" />
					</Button>
				)}
			</div>
		</>
	);
}

function validateStep(stepId: string, config: Partial<InsightConfig>): boolean {
	switch (stepId) {
		case "type":
			return !!config.chartType;
		case "source":
			return !!config.dataSource;
		case "metrics":
			return !!config.aggregation && !!config.aggregateField;
		case "dimensions":
			return true; // Optional
		case "filters":
			return true; // Optional
		case "review":
			return true;
		default:
			return false;
	}
}
