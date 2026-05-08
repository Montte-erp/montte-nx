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
      const inputRef = React.useRef<HTMLInputElement | null>(null);

      const displayValue = toDisplayValue(value, valueInCents);

      React.useEffect(() => {
         const el = inputRef.current;
         if (!el) return;
         if (document.activeElement === el) return;
         el.value = displayValue;
      }, [displayValue]);

      const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
         const el = e.currentTarget;
         if (document.activeElement !== el) return;
         const digits = el.value.replace(/\D/g, "");
         if (digits === "") {
            el.value = "";
            onChange?.(undefined);
            return;
         }

         const cents = Number.parseInt(digits, 10);
         if (cents === 0) {
            el.value = "";
            onChange?.(undefined);
            return;
         }

         const decimal = cents / 100;
         el.value = toDisplayValue(decimal, false);
         el.setSelectionRange(el.value.length, el.value.length);
         onChange?.(valueInCents ? cents : decimal);
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
               ref={mergeRefs(inputRef, ref)}
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
