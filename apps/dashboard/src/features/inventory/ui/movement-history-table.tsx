import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@packages/ui/components/table";
import { formatDate } from "@packages/utils/date";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Settings } from "lucide-react";
import { useTRPC } from "@/integrations/clients";

type MovementHistoryTableProps = {
	itemId: string;
	page?: number;
	pageSize?: number;
};

type MovementType = "in" | "out" | "adjustment";
type MovementReason = "purchase" | "sale" | "return" | "damage" | "correction" | "production";

const movementTypeConfig: Record<MovementType, {
	icon: typeof ArrowDownLeft;
	className: string;
	label: string;
}> = {
	in: {
		icon: ArrowDownLeft,
		className: "bg-green-500/10 text-green-600 border-green-500/20",
		label: "Entrada",
	},
	out: {
		icon: ArrowUpRight,
		className: "bg-red-500/10 text-red-600 border-red-500/20",
		label: "Saída",
	},
	adjustment: {
		icon: Settings,
		className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
		label: "Ajuste",
	},
};

const reasonLabels: Record<MovementReason, string> = {
	purchase: "Compra",
	sale: "Venda",
	return: "Devolução",
	damage: "Dano",
	correction: "Correção",
	production: "Produção",
};

export function MovementHistoryTable({
	itemId,
	page = 1,
	pageSize = 10,
}: MovementHistoryTableProps) {
	const trpc = useTRPC();

	const { data: movements, isLoading } = useQuery(
		trpc.inventory.getMovements.queryOptions({
			itemId,
			page,
			pageSize,
		}),
	);

	if (isLoading) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				Carregando movimentações...
			</div>
		);
	}

	if (!movements || movements.data.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				Nenhuma movimentação registrada.
			</div>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Data</TableHead>
						<TableHead>Tipo</TableHead>
						<TableHead>Motivo</TableHead>
						<TableHead className="text-right">Quantidade</TableHead>
						<TableHead className="text-right">Custo Unitário</TableHead>
						<TableHead>Fornecedor/Cliente</TableHead>
						<TableHead>Observações</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{movements.data.map((movement) => {
						const typeConfig = movementTypeConfig[movement.type as MovementType];
						const Icon = typeConfig.icon;

						return (
							<TableRow key={movement.id}>
								<TableCell className="whitespace-nowrap">
									{formatDate(new Date(movement.date))}
								</TableCell>
								<TableCell>
									<Badge
										className={typeConfig.className}
										variant="outline"
									>
										<Icon className="size-3" />
										<span>{typeConfig.label}</span>
									</Badge>
								</TableCell>
								<TableCell>{reasonLabels[movement.reason as MovementReason]}</TableCell>
								<TableCell className="text-right">
									{movement.quantity}
								</TableCell>
								<TableCell className="text-right">
									{formatDecimalCurrency(Number.parseFloat(movement.unitCost), movement.currency)}
								</TableCell>
								<TableCell>
									{movement.counterparty?.name || "-"}
								</TableCell>
								<TableCell className="max-w-xs truncate">
									{movement.notes || "-"}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
