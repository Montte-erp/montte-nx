import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
	Baby,
	BookOpen,
	Briefcase,
	Car,
	Coffee,
	CreditCard,
	Dumbbell,
	Fuel,
	Gift,
	Heart,
	Home,
	type LucideIcon,
	Music,
	Package,
	Pencil,
	Plane,
	ShoppingCart,
	Smartphone,
	Trash2,
	Utensils,
	Wallet,
	Zap,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
	wallet: Wallet,
	"credit-card": CreditCard,
	home: Home,
	car: Car,
	"shopping-cart": ShoppingCart,
	utensils: Utensils,
	plane: Plane,
	heart: Heart,
	"book-open": BookOpen,
	briefcase: Briefcase,
	package: Package,
	music: Music,
	coffee: Coffee,
	smartphone: Smartphone,
	dumbbell: Dumbbell,
	baby: Baby,
	gift: Gift,
	zap: Zap,
	fuel: Fuel,
};

export type CategoryRow = {
	id: string;
	name: string;
	isDefault: boolean;
	color: string | null;
	icon: string | null;
	type: string | null;
	subcategories: { id: string; name: string }[];
};

export function buildCategoryColumns(
	onEdit: (category: CategoryRow) => void,
	onDelete: (category: CategoryRow) => void,
): ColumnDef<CategoryRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Nome",
			cell: ({ row }) => {
				const { name, color, icon, isDefault } = row.original;
				const IconComponent = icon ? ICON_MAP[icon] : null;
				return (
					<div className="flex items-center gap-2 min-w-0">
						{color || IconComponent ? (
							<span
								className="size-7 rounded-md flex items-center justify-center shrink-0"
								style={{ backgroundColor: color ?? "#6366f1" }}
							>
								{IconComponent && (
									<IconComponent className="size-3.5 text-white" />
								)}
							</span>
						) : null}
						<span className="font-medium truncate">{name}</span>
						{isDefault && <Badge variant="outline">Padrão</Badge>}
					</div>
				);
			},
		},
		{
			accessorKey: "type",
			header: "Tipo",
			cell: ({ row }) => {
				const { type } = row.original;
				if (type === "income")
					return (
						<Badge
							variant="outline"
							className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
						>
							Receita
						</Badge>
					);
				if (type === "expense")
					return <Badge variant="destructive">Despesa</Badge>;
				return <span className="text-sm text-muted-foreground">—</span>;
			},
		},
		{
			id: "subcategories",
			header: "Subcategorias",
			cell: ({ row }) => {
				const subs = row.original.subcategories;
				if (subs.length === 0) {
					return (
						<span className="text-sm text-muted-foreground">Nenhuma</span>
					);
				}
				return (
					<span className="text-sm text-muted-foreground">
						{subs.map((s) => s.name).join(", ")}
					</span>
				);
			},
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => {
				if (row.original.isDefault) return null;
				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
					<div
						className="flex items-center justify-end gap-1"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						<Button
							onClick={() => onEdit(row.original)}
							size="icon"
							variant="ghost"
						>
							<Pencil className="size-4" />
							<span className="sr-only">Editar</span>
						</Button>
						<Button
							className="text-destructive hover:text-destructive"
							onClick={() => onDelete(row.original)}
							size="icon"
							variant="ghost"
						>
							<Trash2 className="size-4" />
							<span className="sr-only">Excluir</span>
						</Button>
					</div>
				);
			},
		},
	];
}
