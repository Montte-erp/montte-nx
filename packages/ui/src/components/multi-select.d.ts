import * as React from "react";
export type Option = {
   label: string;
   value: string;
   icon?:
      | React.ComponentType<{
           className?: string;
        }>
      | React.ReactNode;
};
interface MultiSelectProps {
   options: Option[];
   selected: string[];
   onChange: (selected: string[]) => void;
   className?: string;
   placeholder?: string;
   emptyMessage?: string;
   onCreate?: (name: string) => void;
   createLabel?: string;
}
export declare function MultiSelect({
   options,
   selected,
   onChange,
   className,
   placeholder,
   onCreate,
   createLabel,
}: MultiSelectProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=multi-select.d.ts.map
