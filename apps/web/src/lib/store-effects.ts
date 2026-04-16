import type { Store } from "@tanstack/react-store";

type Cleanup = () => void;

export function createStoreEffect<T>(
   store: Store<T>,
   effect: (state: T, prevState: T) => void,
): Cleanup {
   let prevState = store.state;

   const { unsubscribe } = store.subscribe(() => {
      const nextState = store.state;
      effect(nextState, prevState);
      prevState = nextState;
   });

   return unsubscribe;
}
