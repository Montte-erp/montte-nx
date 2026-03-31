import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useMediaQuery } from "foxact/use-media-query";
import { useState } from "react";

function hasStandaloneProperty(
   nav: Navigator,
): nav is Navigator & { standalone: boolean } {
   return "standalone" in nav;
}

export function useIsStandalone() {
   const isStandaloneMedia = useMediaQuery("(display-mode: standalone)");
   const isWindowControlsOverlay = useMediaQuery(
      "(display-mode: window-controls-overlay)",
   );
   const [isIOSStandalone, setIsIOSStandalone] = useState(false);

   useIsomorphicLayoutEffect(() => {
      setIsIOSStandalone(
         hasStandaloneProperty(navigator) && navigator.standalone === true,
      );
   }, []);

   return isIOSStandalone || isStandaloneMedia || isWindowControlsOverlay;
}
