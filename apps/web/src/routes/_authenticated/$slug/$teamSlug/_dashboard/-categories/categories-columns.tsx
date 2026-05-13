import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import {
   ColorPicker,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import type { Outputs } from "@/integrations/orpc/client";
import { z } from "zod";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Archive,
   ArrowUpDown,
   Check,
   CornerDownRight,
   Tags,
   TextCursorInput,
   TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { CATEGORY_ICON_MAP, CATEGORY_ICON_OPTIONS } from "./category-icons";

const TYPE_OPTIONS = [
   { value: "income", label: "Receita" },
   { value: "expense", label: "Despesa" },
   { value: "transfer", label: "Transferência" },
];

export type CategoryRow = Outputs["categories"]["getPaginated"]["data"][number];
type CategoryType = "income" | "expense" | "transfer";
type CategoryUpdateData = {
   name?: string;
   type?: CategoryType;
   parentId?: string | null;
   icon?: string | null;
   color?: string | null;
};

function isCategoryType(value: unknown): value is CategoryType {
   return value === "income" || value === "expense" || value === "transfer";
}

function getCategoryParentChain(
   category: CategoryRow,
   categoriesById: Map<string, CategoryRow>,
) {
   const chain: CategoryRow[] = [];
   const visited = new Set<string>();
   let current = category;

   while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parent = categoriesById.get(current.parentId);
      if (!parent) return chain;
      chain.push(parent);
      current = parent;
   }

   return chain;
}

function getInheritedVisual(
   category: CategoryRow,
   categoriesById: Map<string, CategoryRow>,
) {
   if (!category.parentId) {
      return { color: category.color, icon: category.icon };
   }

   const chain = getCategoryParentChain(category, categoriesById);
   const root = chain[chain.length - 1];
   return {
      color: root && !root.parentId ? root.color : null,
      icon: root && !root.parentId ? root.icon : null,
   };
}

function rgbaToHex(rgba: [number, number, number, number]) {
   const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
   return `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}`;
}

function CategoryIconPreview({
   color,
   icon,
}: {
   color: string | null;
   icon: string | null;
}) {
   const IconComponent = icon
      ? (CATEGORY_ICON_MAP[icon] ?? CATEGORY_ICON_MAP.briefcase)
      : CATEGORY_ICON_MAP.briefcase;

   const tint = color ?? "#71717a";
   return (
      <span
         className="flex size-7 items-center justify-center rounded-full"
         style={{ backgroundColor: `${tint}1f`, color: tint }}
      >
         <IconComponent className="size-3.5" />
      </span>
   );
}

function CategoryVisualCell({
   category,
   color,
   icon,
   onUpdate,
}: {
   category: CategoryRow;
   color: string | null;
   icon: string | null;
   onUpdate?: (rowId: string, data: CategoryUpdateData) => Promise<void>;
}) {
   const canEdit =
      !category.isArchived && category.parentId === null && Boolean(onUpdate);
   const [open, setOpen] = useState(false);
   const [draftIcon, setDraftIcon] = useState(icon ?? "briefcase");
   const [draftColor, setDraftColor] = useState(color ?? "#22c55e");

   if (!canEdit) return <CategoryIconPreview color={color} icon={icon} />;

   return (
      <Popover
         open={open}
         onOpenChange={(nextOpen) => {
            if (nextOpen) {
               setDraftIcon(icon ?? "briefcase");
               setDraftColor(color ?? "#22c55e");
            }
            setOpen(nextOpen);
         }}
      >
         <PopoverTrigger asChild>
            <Button
               aria-label="Abrir seletor de ícone e cor"
               className="h-8 justify-start px-2"
               type="button"
               variant="ghost"
            >
               <CategoryIconPreview color={color} icon={icon} />
            </Button>
         </PopoverTrigger>
         <PopoverContent align="start" className="w-80 p-0">
            <div className="flex flex-col gap-4 p-4">
               <ColorPicker
                  onChange={(rgba) => setDraftColor(rgbaToHex(rgba))}
                  value={draftColor}
               >
                  <ColorPickerSelection className="h-28" />
                  <div className="flex items-center gap-4">
                     <ColorPickerEyeDropper />
                     <div className="flex w-full flex-col gap-4">
                        <ColorPickerHue />
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <ColorPickerOutput />
                     <ColorPickerFormat />
                  </div>
               </ColorPicker>
               <Command>
                  <CommandInput placeholder="Buscar ícone..." />
                  <CommandList className="max-h-56">
                     <CommandEmpty>Nenhum ícone encontrado.</CommandEmpty>
                     <CommandGroup>
                        {CATEGORY_ICON_OPTIONS.map((option) => {
                           const Icon = option.icon;
                           const checked = draftIcon === option.value;
                           return (
                              <CommandItem
                                 className="flex items-center gap-2"
                                 key={option.value}
                                 onSelect={() => setDraftIcon(option.value)}
                                 value={option.label}
                              >
                                 <Icon
                                    className="size-4"
                                    style={{ color: draftColor }}
                                 />
                                 <span>{option.label}</span>
                                 {checked && <Check className="size-4" />}
                              </CommandItem>
                           );
                        })}
                     </CommandGroup>
                  </CommandList>
               </Command>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
               <Button
                  onClick={() => setOpen(false)}
                  type="button"
                  variant="outline"
               >
                  Cancelar
               </Button>
               <Button
                  onClick={async () => {
                     await onUpdate?.(category.id, {
                        icon: draftIcon,
                        color: draftColor,
                     });
                     setOpen(false);
                  }}
                  type="button"
               >
                  Salvar
               </Button>
            </div>
         </PopoverContent>
      </Popover>
   );
}

export function buildCategoryColumns(options?: {
   categories?: CategoryRow[];
   onUpdate?: (rowId: string, data: CategoryUpdateData) => Promise<void>;
}): ColumnDef<CategoryRow>[] {
   const onUpdate = options?.onUpdate;
   const categoriesById = new Map(
      (options?.categories ?? []).map((category) => [category.id, category]),
   );

   return [
      {
         id: "icon",
         header: "Ícone",
         size: 140,
         meta: {
            label: "Ícone",
            exportValue: (row) => {
               const visual = getInheritedVisual(row, categoriesById);
               return visual.icon ?? "";
            },
         },
         cell: ({ row }) => {
            if (row.original.parentId !== null)
               return <span className="text-sm text-muted-foreground">—</span>;
            const visual = getInheritedVisual(row.original, categoriesById);
            return (
               <CategoryVisualCell
                  category={row.original}
                  color={visual.color}
                  icon={visual.icon}
                  onUpdate={onUpdate}
               />
            );
         },
      },
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            isEditable: true,
            required: true,
            bulkEditIcon: TextCursorInput,
            bulkEditAction: "Renomear",
            editSchema: z.string().min(1, "Nome é obrigatório.").max(80),
            isEditableForRow: (row: CategoryRow) => !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId: string, value: unknown) => {
                    await options.onUpdate!(rowId, { name: String(value) });
                 }
               : undefined,
         },
         cell: ({ row }) => {
            const { name, id, isArchived } = row.original;
            const editable = !isArchived && Boolean(onUpdate);
            const nameNode = editable ? (
               <InlineEditText
                  ariaLabel="Nome"
                  onSave={async (value) => {
                     const trimmed = value.trim();
                     if (!trimmed || trimmed === name) return;
                     await onUpdate!(id, { name: trimmed });
                  }}
                  placeholder="Nome"
                  value={name}
               />
            ) : null;

            const archivedIndicator = isArchived ? (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span
                        className="inline-flex shrink-0 cursor-default"
                        tabIndex={0}
                     >
                        <Archive className="size-3.5 text-muted-foreground" />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>Arquivada</TooltipContent>
               </Tooltip>
            ) : null;

            const isSub = row.original.parentId !== null;

            return (
               <div className="flex items-center gap-2 min-w-0">
                  {isSub && (
                     <CornerDownRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground/60"
                     />
                  )}
                  {nameNode ? (
                     <div
                        className={
                           isSub
                              ? "min-w-0 flex-1 text-muted-foreground"
                              : "min-w-0 flex-1 font-medium"
                        }
                     >
                        {nameNode}
                     </div>
                  ) : (
                     <span
                        className={
                           isSub
                              ? "truncate text-muted-foreground"
                              : "font-medium truncate"
                        }
                     >
                        {name}
                     </span>
                  )}
                  {archivedIndicator}
               </div>
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
         cell: ({ row }) => {
            if (!row.original.isDefault)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span className="inline-flex cursor-default" tabIndex={0}>
                        <Check className="size-3.5 text-muted-foreground" />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>Padrão</TooltipContent>
               </Tooltip>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         meta: {
            label: "Tipo",
            cellComponent: "select" as const,
            isEditable: true,
            required: true,
            bulkEditIcon: ArrowUpDown,
            bulkEditAction: "Alterar tipo",
            editOptions: TYPE_OPTIONS,
            editSchema: z.enum(["income", "expense", "transfer"]),
            isEditableForRow: (row: CategoryRow) =>
               !row.isArchived && row.parentId === null,
            onSave: onUpdate
               ? async (rowId: string, value: unknown) => {
                    const typeValue = String(value);
                    if (!isCategoryType(typeValue)) return;
                    await onUpdate(rowId, { type: typeValue });
                 }
               : undefined,
            exportValue: (row) => {
               if (row.type === "income") return "Receita";
               if (row.type === "expense") return "Despesa";
               if (row.type === "transfer") return "Transferência";
               return "";
            },
         },
         cell: ({ row }) => {
            const { type, parentId, isArchived } = row.original;
            const isRoot = parentId === null;
            if (isRoot && !isArchived && onUpdate) {
               return (
                  <InlineEditSelect
                     ariaLabel="Tipo"
                     onSave={async (value) => {
                        if (!isCategoryType(value)) return;
                        await onUpdate(row.original.id, { type: value });
                     }}
                     options={TYPE_OPTIONS}
                     value={type}
                  />
               );
            }
            if (type === "income")
               return (
                  <Badge
                     className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
                     variant="outline"
                  >
                     Receita
                  </Badge>
               );
            if (type === "expense")
               return <Badge variant="destructive">Despesa</Badge>;
            if (type === "transfer")
               return <Badge variant="secondary">Transferência</Badge>;
            return <span className="text-sm text-muted-foreground">—</span>;
         },
      },
      {
         id: "keywords",
         header: "Palavras-chave",
         meta: {
            label: "Palavras-chave",
            exportValue: (row) => row.keywords?.join(", ") ?? "",
         },
         cell: ({ row }) => {
            if (row.original.parentId !== null)
               return <span className="text-sm text-muted-foreground">—</span>;
            const { keywords, keywordsUpdatedAt, updatedAt } = row.original;
            const count = keywords?.length ?? 0;
            const isStale =
               !keywordsUpdatedAt ||
               new Date(updatedAt) > new Date(keywordsUpdatedAt);

            if (count === 0) {
               if (isStale) {
                  return (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <span className="inline-flex items-center gap-2 text-sm text-amber-500 cursor-default">
                              <TriangleAlert className="size-3.5" />
                              Não geradas
                           </span>
                        </TooltipTrigger>
                        <TooltipContent>
                           Palavras-chave ainda não foram geradas para esta
                           categoria. Use "Regerar palavras-chave" para gerar.
                        </TooltipContent>
                     </Tooltip>
                  );
               }
               return <span className="text-sm text-muted-foreground">—</span>;
            }

            return (
               <div className="flex items-center gap-2">
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <Announcement className="cursor-default w-fit">
                           <AnnouncementTag>
                              <Tags className="size-3" />
                           </AnnouncementTag>
                           <AnnouncementTitle className="text-xs">
                              {count} {count === 1 ? "palavra" : "palavras"}
                           </AnnouncementTitle>
                        </Announcement>
                     </TooltipTrigger>
                     <TooltipContent className="max-w-72">
                        <p className="font-semibold text-sm">
                           Palavras-chave IA
                        </p>
                        <p className="text-xs text-muted-foreground">
                           Geradas automaticamente com base no nome e descrição
                           da categoria.
                        </p>
                        <p className="text-xs">{keywords!.join(", ")}</p>
                     </TooltipContent>
                  </Tooltip>
                  {isStale && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <span
                              className="inline-flex cursor-default"
                              tabIndex={0}
                           >
                              <TriangleAlert className="size-3.5 text-amber-500" />
                           </span>
                        </TooltipTrigger>
                        <TooltipContent>
                           Categoria foi atualizada desde a última geração de
                           palavras-chave. Use "Regerar palavras-chave" para
                           atualizar.
                        </TooltipContent>
                     </Tooltip>
                  )}
               </div>
            );
         },
      },
   ];
}
