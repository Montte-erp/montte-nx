import { useMediaQuery } from "foxact/use-media-query";

export function useIsMobile() {
   return useMediaQuery("(max-width: 767px)");
}
