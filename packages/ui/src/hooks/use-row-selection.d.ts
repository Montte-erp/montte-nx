import type { RowSelectionState } from "@tanstack/react-table";
export declare function useRowSelection(): {
   rowSelection: RowSelectionState;
   onRowSelectionChange: import("react").Dispatch<
      import("react").SetStateAction<RowSelectionState>
   >;
   selectedCount: number;
   selectedIds: string[];
   onClear: () => void;
};
//# sourceMappingURL=use-row-selection.d.ts.map
