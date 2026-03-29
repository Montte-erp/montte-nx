import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useMediaQuery } from "foxact/use-media-query";
import { useState } from "react";

export function useIsStandalone() {
   const isStandaloneMedia = useMediaQuery("(display-mode: standalone)");
   const isWindowControlsOverlay = useMediaQuery(
      "(display-mode: window-controls-overlay)",
   );
   const [isIOSStandalone, setIsIOSStandalone] = useState(false);

   useIsomorphicLayoutEffect(() => {
      setIsIOSStandalone(
         (navigator as unknown as { standalone?: boolean }).standalone === true,
      );
   }, []);

   return isIOSStandalone || isStandaloneMedia || isWindowControlsOverlay;
}
