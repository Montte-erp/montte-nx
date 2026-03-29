import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useState } from "react";

export function useSafeMediaQuery(query: string): boolean {
   const [matches, setMatches] = useState(false);

   useIsomorphicLayoutEffect(() => {
      const media = window.matchMedia(query);
      setMatches(media.matches);

      const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
   }, [query]);

   return matches;
}
