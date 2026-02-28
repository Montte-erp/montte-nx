import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type CategoryRow = {
	id: string;
	name: string;
	isDefault: boolean;
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
			cell: ({ row }) => (
				<div className="flex items-center gap-2 min-w-0">
					<span className="font-medium truncate">{row.original.name}</span>
					{row.original.isDefault && (
						<Badge variant="outline">Padrão</Badge>
					)}
				</div>
			),
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
				if (row.original.isDefault) {
					return null;
				}
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
