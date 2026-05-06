import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { Search } from "lucide-react";
import type { ComponentProps } from "react";

export function SearchInput({
   className,
   placeholder = "Buscar...",
   ...props
}: ComponentProps<typeof InputGroupInput> & { className?: string }) {
   return (
      <InputGroup className={className}>
         <InputGroupAddon>
            <Search />
         </InputGroupAddon>
         <InputGroupInput placeholder={placeholder} type="search" {...props} />
      </InputGroup>
   );
}
