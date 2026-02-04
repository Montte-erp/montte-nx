import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@packages/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Unlink } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

type ItemCounterpartyTableProps = {
	itemId: string;
};

type CounterpartyRole = "supplier" | "client";

const roleLabels: Record<CounterpartyRole, string> = {
	supplier: "Fornecedor",
	client: "Cliente",
};

const roleConfig: Record<CounterpartyRole, {
	className: string;
}> = {
	supplier: {
		className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	},
	client: {
		className: "bg-purple-500/10 text-purple-600 border-purple-500/20",
	},
};

export function ItemCounterpartyTable({ itemId }: ItemCounterpartyTableProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { openAlertDialog } = useAlertDialog();

	const { data: counterparties, isLoading } = useQuery(
		trpc.inventory.getCounterparties.queryOptions({ itemId }),
	);

	const unlinkMutation = useMutation(
		trpc.inventory.unlinkCounterparty.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getCounterparties.queryKey(),
				});
				toast.success("Vínculo removido com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao remover vínculo";
				toast.error(errorMessage);
			},
		}),
	);

	const handleUnlink = useCallback(
		(linkId: string, counterpartyName: string) => {
			openAlertDialog({
				title: "Remover Vínculo",
				description: `Tem certeza que deseja remover o vínculo com "${counterpartyName}"?`,
				actionLabel: "Remover",
				cancelLabel: "Cancelar",
				variant: "destructive",
				onAction: async () => {
					await unlinkMutation.mutateAsync({ id: linkId });
				},
			});
		},
		[openAlertDialog, unlinkMutation],
	);

	if (isLoading) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				Carregando fornecedores/clientes...
			</div>
		);
	}

	if (!counterparties || counterparties.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				Nenhum fornecedor/cliente vinculado.
			</div>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Nome</TableHead>
						<TableHead>Papel</TableHead>
						<TableHead className="text-right">Preço Unitário</TableHead>
						<TableHead className="text-right">Quantidade Mínima</TableHead>
						<TableHead className="text-right">Prazo de Entrega</TableHead>
						<TableHead className="w-[100px]">Ações</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{counterparties.map((link) => {
						const roleStyle = roleConfig[link.role as CounterpartyRole];

						return (
							<TableRow key={link.id}>
								<TableCell className="font-medium">
									{link.counterparty.name}
								</TableCell>
								<TableCell>
									<Badge className={roleStyle.className} variant="outline">
										{roleLabels[link.role as CounterpartyRole]}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									{formatDecimalCurrency(Number.parseFloat(link.unitPrice), link.currency)}
								</TableCell>
								<TableCell className="text-right">
									{link.minOrderQuantity || "-"}
								</TableCell>
								<TableCell className="text-right">
									{link.leadTimeDays !== null && link.leadTimeDays !== undefined
										? `${link.leadTimeDays} dias`
										: "-"}
								</TableCell>
								<TableCell>
									<Button
										onClick={() =>
											handleUnlink(link.id, link.counterparty.name)
										}
										size="icon"
										variant="ghost"
									>
										<Unlink className="size-4" />
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
