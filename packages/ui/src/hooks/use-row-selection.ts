import type { RowSelectionState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

export function useRowSelection() {
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const selectedIds = useMemo(
      () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
      [rowSelection],
   );

   return {
      rowSelection,
      onRowSelectionChange: setRowSelection,
      selectedCount: selectedIds.length,
      selectedIds,
      onClear: () => setRowSelection({}),
   };
}
