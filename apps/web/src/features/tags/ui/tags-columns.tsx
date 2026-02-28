import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type TagRow = {
	id: string;
	name: string;
	color: string;
};

export function buildTagColumns(
	onEdit: (tag: TagRow) => void,
	onDelete: (tag: TagRow) => void,
): ColumnDef<TagRow>[] {
	return [
		{
			accessorKey: "name",
			header: "Nome",
			cell: ({ row }) => (
				<div className="flex items-center gap-2 min-w-0">
					<span
						className="size-3 rounded-full shrink-0"
						style={{ backgroundColor: row.original.color }}
					/>
					<span className="font-medium truncate">{row.original.name}</span>
				</div>
			),
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
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
			),
		},
	];
}
