import { Badge } from "@packages/ui/components/badge";
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
   CornerDownRight,
   ShieldCheck,
   Star,
   Tags,
   TriangleAlert,
} from "lucide-react";
import { CATEGORY_ICON_MAP } from "./category-icons";

export type CategoryRow = Outputs["categories"]["getPaginated"]["data"][number];
type CategoryType = "income" | "expense" | "transfer";

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

export function buildCategoryColumns(options?: {
   categories?: CategoryRow[];
   onUpdate?: (
      rowId: string,
      data: { name?: string; type?: CategoryType; parentId?: string | null },
   ) => Promise<void>;
}): ColumnDef<CategoryRow>[] {
   const onUpdate = options?.onUpdate;
   const categoriesById = new Map(
      (options?.categories ?? []).map((category) => [category.id, category]),
   );

   return [
      {
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            cellComponent: "text" as const,
            isEditable: true,
            editSchema: z.string().min(1, "Nome é obrigatório.").max(80),
            isEditableForRow: (row: CategoryRow) => !row.isArchived,
            onSave: options?.onUpdate
               ? async (rowId: string, value: unknown) => {
                    await options.onUpdate!(rowId, { name: String(value) });
                 }
               : undefined,
         },
         cell: ({ row }) => {
            const { name, isDefault } = row.original;
            const { color, icon } = getInheritedVisual(
               row.original,
               categoriesById,
            );
            const IconComponent = icon ? CATEGORY_ICON_MAP[icon] : null;

            const archivedIndicator = row.original.isArchived ? (
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

            if (!isSub && (color || IconComponent)) {
               return (
                  <Announcement>
                     <AnnouncementTag>
                        {IconComponent && (
                           <IconComponent
                              className="size-4"
                              style={{ color: color ?? undefined }}
                           />
                        )}
                     </AnnouncementTag>
                     <AnnouncementTitle>
                        {name}
                        {isDefault && (
                           <Tooltip>
                              <TooltipTrigger asChild>
                                 <span
                                    className="inline-flex cursor-default"
                                    tabIndex={0}
                                 >
                                    <ShieldCheck className="size-4 text-muted-foreground" />
                                 </span>
                              </TooltipTrigger>
                              <TooltipContent>Padrão</TooltipContent>
                           </Tooltip>
                        )}
                        {archivedIndicator}
                     </AnnouncementTitle>
                  </Announcement>
               );
            }

            return (
               <div className="flex items-center gap-2 min-w-0">
                  {isSub && (
                     <CornerDownRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground/60"
                     />
                  )}
                  {IconComponent && (
                     <IconComponent
                        className="size-4 shrink-0 text-muted-foreground"
                        style={{ color: color ?? undefined }}
                     />
                  )}
                  <span
                     className={
                        isSub
                           ? "truncate text-muted-foreground"
                           : "font-medium truncate"
                     }
                  >
                     {name}
                  </span>
                  {isDefault && !isSub && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <span
                              className="inline-flex cursor-default"
                              tabIndex={0}
                           >
                              <Star className="size-3 text-muted-foreground" />
                           </span>
                        </TooltipTrigger>
                        <TooltipContent>Padrão</TooltipContent>
                     </Tooltip>
                  )}
                  {archivedIndicator}
               </div>
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
            editOptions: [
               { value: "income", label: "Receita" },
               { value: "expense", label: "Despesa" },
               { value: "transfer", label: "Transferência" },
            ],
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
            const { type } = row.original;
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
