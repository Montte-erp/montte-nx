import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useCallback, useRef, useState } from "react";

const THRESHOLD = 64;

export function useStickToBottom() {
   const ref = useRef<HTMLDivElement>(null);
   const stuck = useRef(true);
   const [atBottom, setAtBottom] = useState(true);

   const onScroll = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      const next = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
      stuck.current = next;
      setAtBottom(next);
   }, []);

   const scrollToBottom = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      stuck.current = true;
      setAtBottom(true);
   }, []);

   useIsomorphicLayoutEffect(() => {
      const el = ref.current;
      const inner = el?.firstElementChild;
      if (!el || !inner) return;
      const ro = new ResizeObserver(() => {
         if (stuck.current) el.scrollTop = el.scrollHeight;
      });
      ro.observe(inner);
      return () => ro.disconnect();
   }, []);

   return { ref, onScroll, scrollToBottom, atBottom };
}
