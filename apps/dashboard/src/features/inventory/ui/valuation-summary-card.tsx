import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@packages/ui/components/card";
import { TrendingUp } from "lucide-react";

type ValuationSummaryCardProps = {
	valuation: string;
	method: "fifo" | "weighted_average";
	currency: string;
	className?: string;
};

const methodLabels = {
	fifo: "FIFO",
	weighted_average: "Média Ponderada",
};

export function ValuationSummaryCard({
	valuation,
	method,
	currency,
	className,
}: ValuationSummaryCardProps) {
	const formattedValue = formatDecimalCurrency(Number.parseFloat(valuation), currency);

	return (
		<Card className={className}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">
					Valor Total em Estoque
				</CardTitle>
				<TrendingUp className="size-4 text-muted-foreground" />
			</CardHeader>
			<CardContent>
				<div className="flex items-baseline justify-between">
					<div className="text-2xl font-bold">{formattedValue}</div>
					<Badge variant="outline" className="ml-2">
						{methodLabels[method]}
					</Badge>
				</div>
				<p className="text-xs text-muted-foreground mt-1">
					Método de avaliação: {methodLabels[method]}
				</p>
			</CardContent>
		</Card>
	);
}
