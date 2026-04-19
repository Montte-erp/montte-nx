import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ShieldCheck, Tags } from "lucide-react";
import { z } from "zod";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
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
   patch: { name?: string; description?: string | null },
) => Promise<void>;

export function buildTagColumns(options?: {
   onUpdate?: OnUpdate;
}): ColumnDef<TagRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            exportable: true,
            isEditable: true,
            cellComponent: "text",
            editSchema: tagNameSchema,
            isEditableForRow: (row: TagRow) =>
               !row.isDefault && !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId, value) => {
                    await options.onUpdate!(rowId, { name: String(value) });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) => {
            const { name, isDefault, isArchived } = row.original;
            if (isDefault) {
               return (
                  <Announcement className="cursor-default w-fit">
                     <AnnouncementTag>
                        <ShieldCheck aria-hidden="true" className="size-4" />
                        <span className="sr-only">Padrão</span>
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {name}
                        {isArchived && (
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
                        )}
                     </AnnouncementTitle>
                  </Announcement>
               );
            }
            return (
               <div className="flex items-center gap-2">
                  <span className="text-sm">{name}</span>
                  {isArchived && (
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
                  )}
               </div>
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
            cellComponent: "textarea",
            editSchema: tagDescriptionSchema,
            isEditableForRow: (row: TagRow) => !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId, value) => {
                    const trimmed = String(value).trim();
                    await options.onUpdate!(rowId, {
                       description: trimmed.length > 0 ? trimmed : null,
                    });
                 }
               : undefined,
         },
         enableSorting: false,
         cell: ({ row }) =>
            row.original.description ? (
               <span className="text-sm text-muted-foreground truncate">
                  {row.original.description}
               </span>
            ) : (
               <span className="text-sm text-muted-foreground/40">—</span>
            ),
      },
      {
         id: "keywords",
         header: "Palavras-chave",
         meta: { label: "Palavras-chave" },
         enableSorting: false,
         accessorFn: (row) => row.keywords?.join(", ") ?? "",
         cell: ({ row }) => {
            const keywords = row.original.keywords;
            const count = keywords?.length ?? 0;
            if (count === 0)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <Announcement className="cursor-default w-fit">
                        <AnnouncementTag>
                           <Tags className="size-4" />
                        </AnnouncementTag>
                        <AnnouncementTitle className="text-xs">
                           {count} {count === 1 ? "palavra" : "palavras"}
                        </AnnouncementTitle>
                     </Announcement>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">
                     <p className="font-semibold text-sm">Palavras-chave IA</p>
                     <p className="text-xs text-muted-foreground">
                        Geradas automaticamente com base no nome e descrição do
                        centro de custo.
                     </p>
                     <p className="text-xs">{keywords!.join(", ")}</p>
                  </TooltipContent>
               </Tooltip>
            );
         },
      },
   ];
}
