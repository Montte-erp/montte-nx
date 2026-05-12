import { SearchInput } from "@packages/ui/components/search-input";

interface DataTableSearchProps {
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   className?: string;
}

export function DataTableSearch({
   value,
   onChange,
   placeholder = "Buscar...",
   className,
}: DataTableSearchProps) {
   return (
      <SearchInput
         aria-label={placeholder}
         className={className}
         onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder}
         value={value}
      />
   );
}
