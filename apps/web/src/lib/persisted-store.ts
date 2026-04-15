import { Store } from "@tanstack/react-store";

export function createPersistedStore<T>(
   key: string,
   initialState: T,
): Store<T> {
   let hydrated: T = initialState;
   try {
      const raw = localStorage.getItem(key);
      if (raw) hydrated = { ...initialState, ...JSON.parse(raw) };
   } catch {}

   const store = new Store<T>(hydrated);
   store.subscribe(() => {
      try {
         localStorage.setItem(key, JSON.stringify(store.state));
      } catch {}
   });
   return store;
}
