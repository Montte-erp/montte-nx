import { Input } from "@packages/ui/components/input";
import { useCallback, useRef } from "react";

interface MoneyInputProps {
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   disabled?: boolean;
   id?: string;
}

function formatBRL(raw: string): string {
   const num = Number(raw);
   if (Number.isNaN(num) || raw === "") return "";
   return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
   }).format(num);
}

function parseBRL(formatted: string): string {
   return formatted.replace(/\./g, "").replace(",", ".");
}

export function MoneyInput({
   value,
   onChange,
   placeholder = "0,00",
   disabled,
   id,
}: MoneyInputProps) {
   const inputRef = useRef<HTMLInputElement>(null);

   const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
         const cleaned = e.target.value.replace(/[^\d.,]/g, "");
         const decimal = parseBRL(cleaned);
         onChange(decimal);
      },
      [onChange],
   );

   const handleBlur = useCallback(() => {
      if (inputRef.current && value && !Number.isNaN(Number(value))) {
         inputRef.current.value = formatBRL(value);
      }
   }, [value]);

   const handleFocus = useCallback(() => {
      if (inputRef.current) {
         inputRef.current.value = value;
      }
   }, [value]);

   return (
      <div className="relative">
         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            R$
         </span>
         <Input
            className="pl-9"
            defaultValue={value ? formatBRL(value) : ""}
            disabled={disabled}
            id={id}
            inputMode="decimal"
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder={placeholder}
            ref={inputRef}
         />
      </div>
   );
}
