import type { RefObject } from "react";
export declare function useEventListener<K extends keyof WindowEventMap>(
   eventName: K,
   handler: (event: WindowEventMap[K]) => void,
   target?:
      | Document
      | Window
      | HTMLElement
      | RefObject<HTMLElement | null>
      | null,
   options?: boolean | AddEventListenerOptions,
): void;
//# sourceMappingURL=use-event-listener.d.ts.map
