import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { AlertCircle, FilterX, Inbox } from "lucide-react";
import type React from "react";
import { useDataTableContext } from "./data-table-root";

type EmptyKind = "no-data" | "no-results" | "error";

interface DataTableEmptyStateProps {
   kind?: EmptyKind;
   children?: React.ReactNode;
}

const DEFAULTS: Record<
   EmptyKind,
   { icon: React.ReactNode; title: string; description: string }
> = {
   "no-data": {
      icon: <Inbox className="size-8 text-muted-foreground" />,
      title: "Nenhum registro ainda",
      description: "Adicione o primeiro registro para começar.",
   },
   "no-results": {
      icon: <FilterX className="size-8 text-muted-foreground" />,
      title: "Nenhum resultado",
      description: "Tente ajustar os filtros aplicados.",
   },
   error: {
      icon: <AlertCircle className="size-8 text-destructive" />,
      title: "Erro ao carregar",
      description: "Não foi possível carregar os registros.",
   },
};

export function DataTableEmptyState({
   kind,
   children,
}: DataTableEmptyStateProps) {
   const { table } = useDataTableContext();
   const total = table.getRowCount();
   const hasFilters = table.getState().columnFilters.length > 0;

   if (total > 0) return null;

   const resolved = kind ?? (hasFilters ? "no-results" : "no-data");
   const preset = DEFAULTS[resolved];

   return (
      <Empty className="py-12">
         <EmptyHeader>
            <EmptyMedia>{preset.icon}</EmptyMedia>
            <EmptyTitle>{preset.title}</EmptyTitle>
            <EmptyDescription>{preset.description}</EmptyDescription>
         </EmptyHeader>
         {children && <EmptyContent>{children}</EmptyContent>}
      </Empty>
   );
}
