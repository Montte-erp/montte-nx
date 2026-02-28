import type { ReactNode } from "react";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

export interface ViewConfig<T extends string = string> {
  id: T;
  label: string;
  icon: ReactNode;
}

export function useViewSwitch<T extends string>(
  storageKey: string,
  views: ViewConfig<T>[],
): { currentView: T; setView: (id: T) => void; views: ViewConfig<T>[] } {
  const [currentView, setView] = useSafeLocalStorage<T>(
    storageKey,
    views[0].id,
  );
  return { currentView, setView, views };
}
