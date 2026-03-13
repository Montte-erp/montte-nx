import * as React from "react";
export interface ComboboxOption {
   value: string;
   label: string;
}
interface ComboboxProps {
   options: ComboboxOption[];
   value?: string;
   onValueChange?: (value: string) => void;
   placeholder?: string;
   searchPlaceholder?: string;
   emptyMessage?: string;
   className?: string;
   disabled?: boolean;
   onBlur?: React.FocusEventHandler<HTMLButtonElement>;
   onCreate?: (name: string) => void;
   createLabel?: string;
   renderOption?: (option: ComboboxOption) => React.ReactNode;
   renderSelected?: (option: ComboboxOption) => React.ReactNode;
}
export declare function Combobox({
   options,
   value,
   onValueChange,
   placeholder,
   searchPlaceholder,
   emptyMessage,
   className,
   disabled,
   onBlur,
   onCreate,
   createLabel,
   renderOption,
   renderSelected,
}: ComboboxProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=combobox.d.ts.map
