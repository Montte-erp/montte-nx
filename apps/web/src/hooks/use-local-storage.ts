import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useCallback, useState } from "react";

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

export function useSafeLocalStorage<T>(
   key: string,
   initialValue: T,
): [T, SetValue<T>] {
   const [storedValue, setStoredValue] = useState<T>(initialValue);

   useIsomorphicLayoutEffect(() => {
      try {
         const item = window.localStorage.getItem(key);
         if (item !== null) {
            setStoredValue(JSON.parse(item) as T);
         }
      } catch {}
   }, [key]);

   const setValue: SetValue<T> = useCallback(
      (value) => {
         setStoredValue((prev) => {
            const next =
               typeof value === "function"
                  ? (value as (p: T) => T)(prev)
                  : value;
            try {
               window.localStorage.setItem(key, JSON.stringify(next));
            } catch {}
            return next;
         });
      },
      [key],
   );

   return [storedValue, setValue];
}
