import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { RowData } from "@tanstack/react-table";
import type { ComponentType } from "react";

export interface DataTableOption {
   value: string;
   label: string;
}

declare module "@tanstack/react-table" {
   interface ColumnMeta<TData extends RowData, TValue> {
      align?: "left" | "center" | "right";
      bulkEditAction?: string;
      bulkEditIcon?: ComponentType<{ className?: string }>;
      cellComponent?:
         | "combobox"
         | "date"
         | "money"
         | "select"
         | "text"
         | "textarea";
      editMode?: "inline";
      editOptions?: DataTableOption[];
      editSchema?: StandardSchemaV1;
      exportable?: boolean;
      exportIgnore?: boolean;
      exportValue?: (row: TData, value: TValue) => string;
      filterVariant?: "date" | "range" | "select" | "text";
      importIgnore?: boolean;
      isEditable?: boolean;
      isEditableForRow?: (row: TData) => boolean;
      label?: string;
      onCreateOption?: (name: string) => Promise<string>;
      onSave?: (rowId: string, value: unknown) => Promise<void>;
      pinnable?: boolean;
      reorderable?: boolean;
      required?: boolean;
      resizable?: boolean;
   }
}
