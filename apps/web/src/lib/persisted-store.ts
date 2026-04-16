import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { createStore } from "@tanstack/react-store";
import { useEffect } from "react";

export function createPersistedStore<T>(
   key: string,
   initialState: NonNullable<T>,
) {
   const [useStoredState] = createLocalStorageState<NonNullable<T>>(
      key,
      initialState,
   );
   const store = createStore<NonNullable<T>>(initialState);

   function useStorePersistence() {
      const [storedValue, setStoredValue] = useStoredState();

      useIsomorphicLayoutEffect(() => {
         if (storedValue != null) store.setState(() => storedValue);
      }, []);

      useEffect(() => {
         const subscription = store.subscribe(() =>
            setStoredValue(store.state),
         );
         return () => subscription.unsubscribe();
      }, [setStoredValue]);
   }

   return { store, useStorePersistence };
}
