import type * as React from "react";
interface SelectionActionBarProps {
   selectedCount: number;
   summary?: React.ReactNode;
   onClear: () => void;
   children: React.ReactNode;
   className?: string;
}
declare function SelectionActionBar({
   selectedCount,
   summary,
   onClear,
   children,
   className,
}: SelectionActionBarProps): import("react/jsx-runtime").JSX.Element | null;
interface SelectionActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
   variant?: "default" | "destructive";
   icon?: React.ReactNode;
}
declare function SelectionActionButton({
   children,
   variant,
   icon,
   className,
   ...props
}: SelectionActionButtonProps): import("react/jsx-runtime").JSX.Element;
export { SelectionActionBar, SelectionActionButton };
//# sourceMappingURL=selection-action-bar.d.ts.map
