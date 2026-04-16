import { createStore } from "@tanstack/react-store";
import { createClientOnlyFn } from "@tanstack/react-start";
import { fromThrowable } from "neverthrow";

const safeParse = <T>(raw: string) =>
   fromThrowable(
      () => JSON.parse(raw) as T,
      () => "parse-error",
   )();

const initClientPersistence = createClientOnlyFn(
   <T>(key: string, store: ReturnType<typeof createStore<NonNullable<T>>>) => {
      const raw = localStorage.getItem(key);
      if (raw)
         safeParse<NonNullable<T>>(raw).map((v) => store.setState(() => v));

      store.subscribe(() =>
         fromThrowable(() =>
            localStorage.setItem(key, JSON.stringify(store.state)),
         )(),
      );

      window.addEventListener("storage", (e) => {
         if (e.key !== key || !e.newValue) return;
         safeParse<NonNullable<T>>(e.newValue).map((v) =>
            store.setState(() => v),
         );
      });
   },
);

export function createPersistedStore<T>(
   key: string,
   initialState: NonNullable<T>,
) {
   const store = createStore<NonNullable<T>>(initialState);
   initClientPersistence(key, store);
   return store;
}

// --- Store Effects ---

type Cleanup = () => void;

interface Subscribable<T> {
   state: T;
   subscribe: (fn: () => void) => { unsubscribe: () => void };
}

export function createStoreEffect<T>(
   store: Subscribable<T>,
   effect: (state: T, prevState: T) => Cleanup | void,
) {
   let prevState = store.state;
   let cleanup: Cleanup | void;

   const { unsubscribe } = store.subscribe(() => {
      const nextState = store.state;
      cleanup?.();
      cleanup = effect(nextState, prevState);
      prevState = nextState;
   });

   return () => {
      cleanup?.();
      unsubscribe();
   };
}
