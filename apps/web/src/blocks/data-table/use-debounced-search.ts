import { useDebouncedCallback } from "@tanstack/react-pacer";
import { startTransition, useRef, useState } from "react";

interface UseDebouncedSearchOptions {
   value: string;
   onCommit: (value: string) => void;
   wait?: number;
}

export function useDebouncedSearch({
   value,
   onCommit,
   wait = 250,
}: UseDebouncedSearchOptions) {
   const [local, setLocal] = useState(value);
   const lastUrlValueRef = useRef(value);

   if (lastUrlValueRef.current !== value) {
      lastUrlValueRef.current = value;
      setLocal(value);
   }

   const commitDebounced = useDebouncedCallback(
      (next: string) => {
         startTransition(() => onCommit(next));
      },
      { wait },
   );

   const onChange = (next: string) => {
      setLocal(next);
      commitDebounced(next);
   };

   return { value: local, onChange };
}
