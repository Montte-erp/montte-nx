import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import type {
   ColumnDef,
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import {
   GitBranch,
   Lightbulb,
   Pencil,
   Plus,
   RotateCcw,
   Trash2,
   TrendingUp,
} from "lucide-react";

export interface InsightRow {
   id: string;
   name: string;
   description?: string | null;
   type: string;
   updatedAt: string | Date;
}

const TYPE_LABELS: Record<string, string> = {
   trends: "Tendências",
   funnels: "Funis",
   retention: "Retenção",
};

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
   trends: "default",
   funnels: "secondary",
   retention: "outline",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
   trends: TrendingUp,
   funnels: GitBranch,
   retention: RotateCcw,
};

function formatDate(date: string | Date): string {
   return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
   });
}

const columns: ColumnDef<InsightRow>[] = [
   {
      id: "name",
      header: "Nome",
      cell: ({ row }) => {
         const insight = row.original;
         const TypeIcon = TYPE_ICONS[insight.type] ?? Lightbulb;
         return (
            <div className="flex items-center gap-3">
               <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <TypeIcon className="size-4 text-primary" />
               </div>
               <div className="min-w-0">
                  <p className="font-medium truncate">{insight.name}</p>
                  {insight.description && (
                     <p className="text-xs text-muted-foreground truncate">
                        {insight.description}
                     </p>
                  )}
               </div>
            </div>
         );
      },
   },
   {
      id: "type",
      header: "Tipo",
      cell: ({ row }) => (
         <Badge variant={TYPE_VARIANTS[row.original.type] ?? "default"}>
            {TYPE_LABELS[row.original.type] ?? row.original.type}
         </Badge>
      ),
   },
   {
      id: "updatedAt",
      header: "Atualizado",
      cell: ({ row }) => (
         <span className="text-muted-foreground text-sm">
            {formatDate(row.original.updatedAt)}
         </span>
      ),
   },
];

interface InsightsTableProps {
   data: InsightRow[];
   sorting: SortingState;
   onSortingChange: OnChangeFn<SortingState>;
   columnFilters: ColumnFiltersState;
   onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
   tableState: DataTableStoredState | null;
   onTableStateChange: (state: DataTableStoredState) => void;
   onEdit: (id: string) => void;
   onDelete: (insight: { id: string; name: string }) => void;
   onCreate: () => void;
}

export function InsightsTable({
   data,
   sorting,
   onSortingChange,
   columnFilters,
   onColumnFiltersChange,
   tableState,
   onTableStateChange,
   onEdit,
   onDelete,
   onCreate,
}: InsightsTableProps) {
   if (data.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Lightbulb />
               </EmptyMedia>
               <EmptyTitle>Nenhum insight ainda</EmptyTitle>
               <EmptyDescription>
                  Crie seu primeiro insight para visualizar dados de eventos,
                  funis de conversão ou retenção de usuários.
               </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
               <Button onClick={onCreate}>
                  <Plus className="size-4" />
                  Criar primeiro insight
               </Button>
            </EmptyContent>
         </Empty>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={data}
         getRowId={(row) => row.id}
         sorting={sorting}
         onSortingChange={onSortingChange}
         columnFilters={columnFilters}
         onColumnFiltersChange={onColumnFiltersChange}
         tableState={tableState}
         onTableStateChange={onTableStateChange}
         renderActions={({ row }) => {
            const insight = row.original;
            return (
               <>
                  <Button
                     onClick={() => onEdit(insight.id)}
                     tooltip="Editar"
                     variant="outline"
                  >
                     <Pencil className="size-4" />
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() =>
                        onDelete({ id: insight.id, name: insight.name })
                     }
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
               </>
            );
         }}
      />
   );
}
