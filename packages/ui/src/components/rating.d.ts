import { type LucideProps } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";
export type RatingButtonProps = LucideProps & {
   index?: number;
   icon?: ReactElement<LucideProps>;
};
export declare const RatingButton: ({
   index: providedIndex,
   size,
   className,
   icon,
}: RatingButtonProps) => import("react/jsx-runtime").JSX.Element;
export type RatingProps = {
   defaultValue?: number;
   value?: number;
   onChange?: (
      event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
      value: number,
   ) => void;
   onValueChange?: (value: number) => void;
   readOnly?: boolean;
   className?: string;
   children?: ReactNode;
};
export declare const Rating: ({
   value: controlledValue,
   onValueChange: controlledOnValueChange,
   defaultValue,
   onChange,
   readOnly,
   className,
   children,
   ...props
}: RatingProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=rating.d.ts.map
