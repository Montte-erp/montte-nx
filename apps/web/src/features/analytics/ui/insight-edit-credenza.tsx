import type {
	BreakdownConfig,
	InsightConfig,
	KpiConfig,
	TimeSeriesConfig,
} from "@packages/analytics/types";
import { insightConfigSchema } from "@packages/analytics/types";
import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Hash, Loader2, TrendingUp } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import type { InsightType } from "@/features/analytics/hooks/use-insight-config";
import { useInsightConfig } from "@/features/analytics/hooks/use-insight-config";
import { BreakdownQueryBuilder } from "./breakdown-query-builder";
import {
	InsightErrorState,
	InsightLoadingState,
	InsightPreview,
} from "./insight-preview";
import { KpiQueryBuilder } from "./kpi-query-builder";
import { TimeSeriesQueryBuilder } from "./time-series-query-builder";
import { closeCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const TYPE_TABS: { value: InsightType; label: string; icon: React.ElementType }[] = [
	{ value: "kpi", label: "KPI", icon: Hash },
	{ value: "time_series", label: "Série Temporal", icon: TrendingUp },
	{ value: "breakdown", label: "Distribuição", icon: BarChart3 },
];

interface InsightEditCredenzaProps {
	insightId: string;
}

export function InsightEditCredenza({ insightId }: InsightEditCredenzaProps) {
	const queryClient = useQueryClient();

	const { data: insight, isLoading } = useQuery(
		orpc.insights.getById.queryOptions({ input: { id: insightId } }),
	);

	const { type, config, setType, updateConfigImmediate } = useInsightConfig();
	const [name, setName] = useState("");
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		if (insight && !initialized) {
			setName(insight.name);
			const parsed = insightConfigSchema.safeParse(insight.config);
			if (parsed.success) {
				setType(parsed.data.type as InsightType);
				queueMicrotask(() => {
					updateConfigImmediate(parsed.data);
				});
			}
			setInitialized(true);
		}
	}, [insight, initialized, setType, updateConfigImmediate]);

	const updateMutation = useMutation(
		orpc.insights.update.mutationOptions({
			onSuccess: () => {
				toast.success("Insight atualizado");
				queryClient.invalidateQueries({
					queryKey: orpc.insights.getById.queryOptions({
						input: { id: insightId },
					}).queryKey,
				});
				closeCredenza();
			},
			onError: () => toast.error("Erro ao atualizar insight"),
		}),
	);

	const handleSave = useCallback(() => {
		if (!name.trim()) {
			toast.error("O nome do insight é obrigatório");
			return;
		}
		updateMutation.mutate({
			id: insightId,
			name: name.trim(),
			config: config as InsightConfig,
		});
	}, [insightId, name, config, updateMutation]);

	if (isLoading) {
		return (
			<>
				<CredenzaHeader>
					<CredenzaTitle>Configurar insight</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<InsightLoadingState />
				</CredenzaBody>
			</>
		);
	}

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle>Configurar insight</CredenzaTitle>
			</CredenzaHeader>

			<CredenzaBody className="space-y-4 overflow-y-auto max-h-[70vh]">
				<div className="space-y-1.5">
					<Label htmlFor="insight-name">Nome</Label>
					<Input
						id="insight-name"
						onChange={(e) => setName(e.target.value)}
						value={name}
					/>
				</div>

				<div className="flex items-center border-t border-b py-1 -mx-6 px-6">
					{TYPE_TABS.map((tab) => {
						const Icon = tab.icon;
						return (
							<Button
								className={cn(
									"px-3 py-2 h-auto rounded-none border-b-2 text-sm font-medium gap-1.5",
									type === tab.value
										? "border-primary text-primary"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
								key={tab.value}
								onClick={() => setType(tab.value)}
								variant="ghost"
							>
								<Icon className="size-3.5" />
								{tab.label}
							</Button>
						);
					})}
				</div>

				{type === "kpi" && (
					<KpiQueryBuilder
						config={config as KpiConfig}
						onUpdate={updateConfigImmediate}
					/>
				)}
				{type === "time_series" && (
					<TimeSeriesQueryBuilder
						config={config as TimeSeriesConfig}
						onUpdate={updateConfigImmediate}
					/>
				)}
				{type === "breakdown" && (
					<BreakdownQueryBuilder
						config={config as BreakdownConfig}
						onUpdate={updateConfigImmediate}
					/>
				)}

				<ErrorBoundary
					fallbackRender={({ error }) => (
						<InsightErrorState error={error as Error} />
					)}
				>
					<Suspense fallback={<InsightLoadingState />}>
						<InsightPreview config={config} />
					</Suspense>
				</ErrorBoundary>
			</CredenzaBody>

			<CredenzaFooter>
				<Button onClick={closeCredenza} variant="outline">
					Cancelar
				</Button>
				<Button
					disabled={updateMutation.isPending}
					onClick={handleSave}
				>
					{updateMutation.isPending && (
						<Loader2 className="mr-2 size-4 animate-spin" />
					)}
					Salvar
				</Button>
			</CredenzaFooter>
		</>
	);
}
