import * as React from "react";
interface MoneyInputProps extends Omit<
   React.InputHTMLAttributes<HTMLInputElement>,
   "onChange" | "value"
> {
   value?: number | string;
   onChange?: (value: number | undefined) => void;
   placeholder?: string;
   className?: string;
   valueInCents?: boolean;
   debounceMs?: number;
}
export declare const MoneyInput: React.ForwardRefExoticComponent<
   MoneyInputProps & React.RefAttributes<HTMLInputElement>
>;
export {};
//# sourceMappingURL=money-input.d.ts.map
