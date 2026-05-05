import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useCallback, useRef, useState } from "react";

const THRESHOLD_PX = 64;

export function useStickToBottom() {
   const scrollerRef = useRef<HTMLDivElement>(null);
   const isStuckRef = useRef(true);
   const [isAtBottom, setIsAtBottom] = useState(true);

   const onScroll = useCallback(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const stuck = distance < THRESHOLD_PX;
      isStuckRef.current = stuck;
      setIsAtBottom(stuck);
   }, []);

   const scrollToBottom = useCallback(() => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      isStuckRef.current = true;
      setIsAtBottom(true);
   }, []);

   useIsomorphicLayoutEffect(() => {
      const el = scrollerRef.current;
      const inner = el?.firstElementChild;
      if (!el || !inner) return;
      const ro = new ResizeObserver(() => {
         if (isStuckRef.current) el.scrollTop = el.scrollHeight;
      });
      ro.observe(inner);
      return () => ro.disconnect();
   }, []);

   return { scrollerRef, onScroll, scrollToBottom, isAtBottom };
}
