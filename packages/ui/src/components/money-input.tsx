import {
   maskitoNumberOptionsGenerator,
   maskitoParseNumber,
} from "@maskito/kit";
import { useMaskito } from "@maskito/react";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
   InputGroupText,
} from "@packages/ui/components/input-group";
import * as React from "react";
import { mergeRefs } from "foxact/merge-refs";

interface MoneyInputProps extends Omit<
   React.InputHTMLAttributes<HTMLInputElement>,
   "onChange" | "value"
> {
   value?: number | string;
   onChange?: (value: number | undefined) => void;
   placeholder?: string;
   className?: string;
   valueInCents?: boolean;
}

const maskOptions = maskitoNumberOptionsGenerator({
   decimalSeparator: ",",
   thousandSeparator: ".",
   maximumFractionDigits: 2,
   minimumFractionDigits: 2,
   min: 0,
});

function toDisplayValue(
   value: number | string | undefined,
   valueInCents: boolean,
): string {
   if (value === undefined || value === "" || value === 0) return "";
   const num = typeof value === "string" ? Number.parseFloat(value) : value;
   if (Number.isNaN(num) || num === 0) return "";
   const decimal = valueInCents ? num / 100 : num;
   return decimal
      .toFixed(2)
      .replace(".", ",")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
   (
      {
         value,
         onChange,
         placeholder = "0,00",
         className,
         valueInCents = true,
         ...props
      },
      ref,
   ) => {
      const maskRef = useMaskito({ options: maskOptions });
      const inputRef = React.useRef<HTMLInputElement | null>(null);

      const displayValue = toDisplayValue(value, valueInCents);

      React.useEffect(() => {
         const el = inputRef.current;
         if (!el) return;
         if (document.activeElement === el) return;
         el.value = displayValue;
      }, [displayValue]);

      const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
         const el = e.target as HTMLInputElement;
         if (document.activeElement !== el) return;
         const raw = el.value;
         const parsed = maskitoParseNumber(raw, { decimalSeparator: "," });
         if (Number.isNaN(parsed)) {
            onChange?.(undefined);
            return;
         }
         const result = valueInCents ? Math.round(parsed * 100) : parsed;
         onChange?.(result === 0 ? undefined : result);
      };

      return (
         <InputGroup className={className}>
            <InputGroupAddon>
               <InputGroupText>R$</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
               data-slot="input-group-control"
               defaultValue={displayValue}
               inputMode="numeric"
               onInput={handleInput}
               placeholder={placeholder}
               ref={mergeRefs(maskRef, inputRef, ref)}
               type="text"
               {...props}
            />
            <InputGroupAddon align="inline-end">
               <InputGroupText>BRL</InputGroupText>
            </InputGroupAddon>
         </InputGroup>
      );
   },
);

MoneyInput.displayName = "MoneyInput";
