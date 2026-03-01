import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import {
	AlertCircle,
	Check,
	Clock,
	MoreHorizontal,
	Pencil,
	Trash2,
	XCircle,
} from "lucide-react";

export type BillRow = {
	id: string;
	teamId: string;
	name: string;
	type: "payable" | "receivable";
	status: "pending" | "paid" | "cancelled";
	amount: string;
	dueDate: string;
	paidAt: Date | string | null;
	installmentIndex: number | null;
	installmentTotal: number | null;
	bankAccount?: { id: string; name: string } | null;
	category?: { id: string; name: string; color: string | null } | null;
};

function computeDisplayStatus(
	row: BillRow,
): "pending" | "paid" | "overdue" | "cancelled" {
	if (row.status === "paid") return "paid";
	if (row.status === "cancelled") return "cancelled";
	const today = new Date().toISOString().substring(0, 10);
	if (row.dueDate < today) return "overdue";
	return "pending";
}

function formatBRL(value: string | number): string {
	return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split("-");
	return `${day}/${month}/${year}`;
}

const STATUS_CONFIG = {
	pending: { label: "Pendente", variant: "outline" as const, icon: Clock },
	overdue: {
		label: "Vencida",
		variant: "destructive" as const,
		icon: AlertCircle,
	},
	paid: { label: "Paga", variant: "secondary" as const, icon: Check },
	cancelled: { label: "Cancelada", variant: "outline" as const, icon: XCircle },
};

export function buildBillsColumns(
	onPay: (bill: BillRow) => void,
	onEdit: (bill: BillRow) => void,
	onCancel: (bill: BillRow) => void,
	onDelete: (bill: BillRow) => void,
): ColumnDef<BillRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Nome",
			cell: ({ row }) => {
				const { installmentIndex, installmentTotal } = row.original;
				const suffix =
					installmentIndex && installmentTotal
						? ` (${installmentIndex}/${installmentTotal})`
						: "";
				return (
					<span className="font-medium">
						{row.original.name}
						{suffix && (
							<span className="text-muted-foreground text-xs ml-1">{suffix}</span>
						)}
					</span>
				);
			},
		},
		{
			accessorKey: "category",
			header: "Categoria",
			cell: ({ row }) => {
				const cat = row.original.category;
				if (!cat)
					return <span className="text-muted-foreground text-sm">—</span>;
				return (
					<div className="flex items-center gap-1.5">
						{cat.color && (
							<span
								className="size-2.5 rounded-full shrink-0"
								style={{ backgroundColor: cat.color }}
							/>
						)}
						<span className="text-sm">{cat.name}</span>
					</div>
				);
			},
		},
		{
			accessorKey: "dueDate",
			header: "Vencimento",
			cell: ({ row }) => (
				<span className="text-sm text-muted-foreground">
					{formatDate(row.original.dueDate)}
				</span>
			),
		},
		{
			accessorKey: "amount",
			header: "Valor",
			cell: ({ row }) => (
				<span className="font-medium tabular-nums">
					{formatBRL(row.original.amount)}
				</span>
			),
		},
		{
			id: "status",
			header: "Status",
			cell: ({ row }) => {
				const displayStatus = computeDisplayStatus(row.original);
				const config = STATUS_CONFIG[displayStatus];
				const Icon = config.icon;
				return (
					<Badge className="flex items-center gap-1 w-fit" variant={config.variant}>
						<Icon className="size-3" />
						{config.label}
					</Badge>
				);
			},
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => {
				const bill = row.original;
				const displayStatus = computeDisplayStatus(bill);
				const isPaid = displayStatus === "paid";
				const isCancelled = displayStatus === "cancelled";
				const payLabel = bill.type === "payable" ? "Pagar" : "Receber";

				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper
					<div
						className="flex items-center justify-end gap-1"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{!isPaid && !isCancelled && (
							<Button
								className="gap-1.5"
								onClick={() => onPay(bill)}
								size="sm"
								variant="default"
							>
								<Check className="size-3.5" />
								{payLabel}
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="icon" variant="ghost">
									<MoreHorizontal className="size-4" />
									<span className="sr-only">Ações</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{!isPaid && !isCancelled && (
									<DropdownMenuItem onClick={() => onEdit(bill)}>
										<Pencil className="size-3.5 mr-2" />
										Editar
									</DropdownMenuItem>
								)}
								{!isPaid && !isCancelled && (
									<DropdownMenuItem onClick={() => onCancel(bill)}>
										<XCircle className="size-3.5 mr-2" />
										Cancelar
									</DropdownMenuItem>
								)}
								{!isPaid && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onClick={() => onDelete(bill)}
										>
											<Trash2 className="size-3.5 mr-2" />
											Excluir
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				);
			},
		},
	];
}

export { formatBRL, formatDate, computeDisplayStatus, STATUS_CONFIG };
