import type { RefObject } from "react";
import { useEffect } from "react";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";

export function useEventListener<K extends keyof WindowEventMap>(
   eventName: K,
   handler: (event: WindowEventMap[K]) => void,
   target:
      | Document
      | Window
      | HTMLElement
      | RefObject<HTMLElement | null>
      | null = null,
   options?: boolean | AddEventListenerOptions,
): void {
   const resolved =
      typeof document !== "undefined" ? document : (null as Document | null);
   const defaultTarget = target ?? resolved;

   const stableHandler = useStableHandler(handler);

   useEffect(() => {
      const el =
         defaultTarget === null
            ? null
            : "current" in defaultTarget
              ? defaultTarget.current
              : defaultTarget;
      if (!el) return;
      el.addEventListener(eventName, stableHandler as EventListener, options);
      return () =>
         el.removeEventListener(
            eventName,
            stableHandler as EventListener,
            options,
         );
   }, [eventName, defaultTarget, options, stableHandler]);
}
