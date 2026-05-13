import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, Check, FileText, Type } from "lucide-react";
import { z } from "zod";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";

import type { Outputs } from "@/integrations/orpc/client";

const tagNameSchema = z
   .string()
   .min(2, "Mínimo 2 caracteres")
   .max(120, "Máximo 120 caracteres");

const tagDescriptionSchema = z
   .string()
   .max(255, "Máximo 255 caracteres")
   .optional();

export type TagRow = Outputs["tags"]["getAll"]["data"][number];

type OnUpdate = (
   id: string,
   patch: {
      name?: string;
      description?: string | null;
   },
) => Promise<void>;

export function buildTagColumns(options?: {
   onUpdate?: OnUpdate;
}): ColumnDef<TagRow>[] {
   const onUpdate = options?.onUpdate;

   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            exportable: true,
            isEditable: true,
            editMode: "inline",
            cellComponent: "text",
            editSchema: tagNameSchema,
            required: true,
            bulkEditIcon: Type,
            bulkEditAction: "Alterar nome",
            isEditableForRow: (row: TagRow) =>
               !row.isDefault && !row.isArchived,
            onSave: onUpdate
               ? async (rowId, value) => {
                    await onUpdate(rowId, { name: String(value) });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) => {
            const { id, name, isDefault, isArchived } = row.original;
            const editable = !isDefault && !isArchived && Boolean(onUpdate);
            const archivedIndicator = isArchived ? (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span
                        aria-label="Arquivado"
                        className="inline-flex shrink-0 cursor-default"
                        tabIndex={0}
                     >
                        <Archive
                           aria-hidden="true"
                           className="size-4 text-muted-foreground"
                        />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>Arquivado</TooltipContent>
               </Tooltip>
            ) : null;
            if (!editable) {
               return (
                  <div className="flex items-center gap-2 min-w-0">
                     <span className="truncate font-medium">{name}</span>
                     {archivedIndicator}
                  </div>
               );
            }
            return (
               <InlineEditText
                  ariaLabel="Nome"
                  onSave={async (v) => {
                     await onUpdate?.(id, { name: v });
                  }}
                  placeholder="Nome do centro de custo"
                  value={name}
               />
            );
         },
      },
      {
         id: "isDefault",
         header: "Padrão",
         size: 90,
         meta: {
            label: "Padrão",
            exportValue: (row) => (row.isDefault ? "Sim" : ""),
         },
         enableSorting: false,
         cell: ({ row }) => {
            if (!row.original.isDefault)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <button
                        aria-label="Centro de custo padrão"
                        className="inline-flex cursor-default border-0 bg-transparent p-0"
                        type="button"
                     >
                        <Check className="size-4 text-muted-foreground" />
                     </button>
                  </TooltipTrigger>
                  <TooltipContent>Padrão</TooltipContent>
               </Tooltip>
            );
         },
      },
      {
         accessorKey: "description",
         header: "Descrição",
         meta: {
            label: "Descrição",
            exportable: true,
            isEditable: true,
            editMode: "inline",
            cellComponent: "textarea",
            editSchema: tagDescriptionSchema,
            bulkEditIcon: FileText,
            bulkEditAction: "Alterar descrição",
            isEditableForRow: (row: TagRow) => !row.isArchived,
            onSave: onUpdate
               ? async (rowId, value) => {
                    const trimmed = String(value).trim();
                    await onUpdate(rowId, {
                       description: trimmed.length > 0 ? trimmed : null,
                    });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) => {
            const { id, description, isArchived } = row.original;
            if (isArchived || !onUpdate) {
               return description ? (
                  <span className="text-sm text-muted-foreground truncate">
                     {description}
                  </span>
               ) : (
                  <span className="text-sm text-muted-foreground/40">—</span>
               );
            }
            return (
               <InlineEditText
                  ariaLabel="Descrição"
                  onSave={async (v) => {
                     await onUpdate(id, {
                        description: v.trim() ? v.trim() : null,
                     });
                  }}
                  placeholder="—"
                  value={description ?? ""}
               />
            );
         },
      },
   ];
}
