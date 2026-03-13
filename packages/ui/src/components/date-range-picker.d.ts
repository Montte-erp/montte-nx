import type { ReactNode } from "react";
export interface DateRangePreset {
   label: string;
   value: string;
}
export interface DateRangePickerProps {
   presets: readonly DateRangePreset[];
   selectedPreset?: string | null;
   selectedRange?: {
      from: Date;
      to?: Date;
   } | null;
   onPresetSelect: (value: string) => void;
   onRangeSelect: (range: { from: Date; to: Date }) => void;
   heading?: string;
   /** Trigger button label */
   label?: string;
   /** Extra className for the trigger button */
   triggerClassName?: string;
   /** Variant for the trigger button */
   triggerVariant?:
      | "default"
      | "outline"
      | "secondary"
      | "ghost"
      | "link"
      | "destructive";
   /** Popover alignment */
   align?: "start" | "center" | "end";
   /** If provided, renders a clear button in the footer */
   onClear?: () => void;
   clearLabel?: string;
   clearClassName?: string;
   clearIcon?: ReactNode;
}
export declare function DateRangePicker({
   presets,
   selectedPreset,
   selectedRange,
   onPresetSelect,
   onRangeSelect,
   heading,
   label,
   triggerClassName,
   triggerVariant,
   align,
   onClear,
   clearLabel,
   clearClassName,
   clearIcon,
}: DateRangePickerProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=date-range-picker.d.ts.map
