import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupButton,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { cn } from "@packages/ui/lib/utils";

type NativeInputProps = Omit<
   React.ComponentProps<"input">,
   "type" | "onChange" | "value" | "defaultValue"
>;

interface NumberInputProps extends NativeInputProps {
   value?: number;
   defaultValue?: number;
   onChange?: (value: number) => void;
   min?: number;
   max?: number;
   step?: number;
}

export function NumberInput({
   value,
   defaultValue = 0,
   onChange,
   min,
   max,
   step = 1,
   disabled,
   className,
   inputClassName,
   ...props
}: NumberInputProps & { inputClassName?: string }) {
   const [internal, setInternal] = useState(defaultValue);
   const isControlled = value !== undefined;
   const current = isControlled ? value : internal;

   const commit = (next: number) => {
      const clamped = Math.min(
         Math.max(next, min ?? Number.NEGATIVE_INFINITY),
         max ?? Number.POSITIVE_INFINITY,
      );
      if (!isControlled) setInternal(clamped);
      onChange?.(clamped);
   };

   const atMin = min !== undefined && current <= min;
   const atMax = max !== undefined && current >= max;

   return (
      <InputGroup className={className}>
         <InputGroupAddon align="inline-start">
            <InputGroupButton
               aria-label="Diminuir"
               disabled={disabled || atMin}
               onClick={() => commit(current - step)}
               className="text-foreground border-0 bg-transparent shadow-none hover:bg-transparent"
               size="icon-sm"
               type="button"
               variant="ghost"
            >
               <Minus />
            </InputGroupButton>
         </InputGroupAddon>
         <InputGroupInput
            className={cn(
               "text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
               inputClassName,
            )}
            disabled={disabled}
            inputMode="decimal"
            max={max}
            min={min}
            onChange={(e) => {
               const n = Number(e.target.value);
               if (Number.isFinite(n)) commit(n);
            }}
            step={step}
            type="number"
            value={current}
            {...props}
         />
         <InputGroupAddon align="inline-end">
            <InputGroupButton
               aria-label="Aumentar"
               disabled={disabled || atMax}
               onClick={() => commit(current + step)}
               className="text-foreground border-0 bg-transparent shadow-none hover:bg-transparent"
               size="icon-sm"
               type="button"
               variant="ghost"
            >
               <Plus />
            </InputGroupButton>
         </InputGroupAddon>
      </InputGroup>
   );
}
