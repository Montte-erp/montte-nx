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

const TYPE_ITEMS: { value: InsightType; label: string; icon: React.ElementType }[] =
	[
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
				<CredenzaBody className="h-[70vh] flex items-center justify-center">
					<InsightLoadingState />
				</CredenzaBody>
			</>
		);
	}

	return (
		<>
			<CredenzaHeader>
				<div>
					<CredenzaTitle>Configurar insight</CredenzaTitle>
					{insight?.name && (
						<p className="text-sm text-muted-foreground mt-0.5">
							{insight.name}
						</p>
					)}
				</div>
			</CredenzaHeader>

			<CredenzaBody className="p-0 overflow-hidden">
				<div className="flex h-[70vh]">
					{/* ── Left sidebar ── */}
					<aside className="w-[270px] shrink-0 border-r flex flex-col overflow-y-auto">
						<div className="p-4 space-y-5">
							{/* Name */}
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
									Nome
								</Label>
								<Input
									onChange={(e) => setName(e.target.value)}
									placeholder="Nome do insight"
									value={name}
								/>
							</div>

							{/* Type selector */}
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
									Tipo
								</Label>
								<div className="space-y-0.5">
									{TYPE_ITEMS.map((item) => {
										const Icon = item.icon;
										const isActive = type === item.value;
										return (
											<button
												className={cn(
													"w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
													isActive
														? "bg-primary/10 text-primary font-medium"
														: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
												)}
												key={item.value}
												onClick={() => setType(item.value)}
												type="button"
											>
												<Icon className="size-4 shrink-0" />
												{item.label}
											</button>
										);
									})}
								</div>
							</div>

							{/* Config builder */}
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
									Configuração
								</Label>
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
							</div>
						</div>
					</aside>

					{/* ── Right preview ── */}
					<div className="flex-1 min-w-0 overflow-y-auto bg-muted/20 p-5">
						<ErrorBoundary
							fallbackRender={({ error }) => (
								<InsightErrorState error={error as Error} />
							)}
						>
							<Suspense fallback={<InsightLoadingState />}>
								<InsightPreview config={config} />
							</Suspense>
						</ErrorBoundary>
					</div>
				</div>
			</CredenzaBody>

			<CredenzaFooter>
				<Button onClick={closeCredenza} variant="outline">
					Cancelar
				</Button>
				<Button disabled={updateMutation.isPending} onClick={handleSave}>
					{updateMutation.isPending && (
						<Loader2 className="mr-2 size-4 animate-spin" />
					)}
					Salvar
				</Button>
			</CredenzaFooter>
		</>
	);
}
