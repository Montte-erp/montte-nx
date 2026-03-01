import type { ReactNode } from "react";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

export interface ViewConfig<T extends string = string> {
   id: T;
   label: string;
   icon: ReactNode;
}

/**
 * Manages the active view for a list page, persisted in localStorage.
 * @param storageKey - unique key per route (e.g. "finance:categories:view")
 * @param views - non-empty array of available views; first entry is the default
 */
export function useViewSwitch<T extends string>(
   storageKey: string,
   views: [ViewConfig<T>, ...ViewConfig<T>[]],
): {
   currentView: T;
   setView: (id: T) => void;
   views: [ViewConfig<T>, ...ViewConfig<T>[]];
} {
   const [storedView, setView] = useSafeLocalStorage<T>(
      storageKey,
      views[0].id,
   );

   // If the stored value is no longer a valid view ID (e.g. a view was removed),
   // fall back to the first view.
   const currentView = views.some((v) => v.id === storedView)
      ? storedView
      : views[0].id;

   return { currentView, setView, views };
}
