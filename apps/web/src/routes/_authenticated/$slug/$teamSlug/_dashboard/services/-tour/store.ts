import { createStore } from "@tanstack/react-store";
import { createIsomorphicFn } from "@tanstack/react-start";
import { fromThrowable } from "neverthrow";

export type TourId =
   | "services-overview"
   | "service-detail"
   | "meters-intro"
   | "benefits-intro"
   | "coupons-intro";

interface TourPersistedState {
   completed: TourId[];
   dismissed: TourId[];
}

const STORAGE_KEY = "montte:tour-state";
const INITIAL_STATE: TourPersistedState = { completed: [], dismissed: [] };

const safeParse = (raw: string) =>
   fromThrowable(
      () => JSON.parse(raw) as TourPersistedState,
      () => "parse-error",
   )();

export const tourStateStore = createStore<TourPersistedState>(INITIAL_STATE);

const hydrateTourState = createIsomorphicFn()
   .server(() => {})
   .client(() => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) safeParse(raw).map((v) => tourStateStore.setState(() => v));

      tourStateStore.subscribe(() => {
         fromThrowable(() =>
            localStorage.setItem(
               STORAGE_KEY,
               JSON.stringify(tourStateStore.state),
            ),
         )();
      });

      window.addEventListener("storage", (e) => {
         if (e.key !== STORAGE_KEY || !e.newValue) return;
         safeParse(e.newValue).map((v) => tourStateStore.setState(() => v));
      });
   });

hydrateTourState();

interface TourRequestState {
   requestedTourId: TourId | null;
   nonce: number;
}

export const tourRequestStore = createStore<TourRequestState>({
   requestedTourId: null,
   nonce: 0,
});

const requestTourClient = createIsomorphicFn()
   .server((_tourId: TourId, _force?: boolean) => {})
   .client((tourId: TourId, force?: boolean) => {
      if (!force) {
         const { completed, dismissed } = tourStateStore.state;
         if (completed.includes(tourId) || dismissed.includes(tourId)) return;
      }
      tourRequestStore.setState((prev) => ({
         requestedTourId: tourId,
         nonce: prev.nonce + 1,
      }));
   });

export function requestTour(tourId: TourId, force = false) {
   requestTourClient(tourId, force);
}

export function clearTourRequest() {
   tourRequestStore.setState((prev) => ({
      requestedTourId: null,
      nonce: prev.nonce,
   }));
}

export function markTourCompleted(tourId: TourId) {
   tourStateStore.setState((prev) =>
      prev.completed.includes(tourId)
         ? prev
         : { ...prev, completed: [...prev.completed, tourId] },
   );
}

export function markTourDismissed(tourId: TourId) {
   tourStateStore.setState((prev) =>
      prev.dismissed.includes(tourId)
         ? prev
         : { ...prev, dismissed: [...prev.dismissed, tourId] },
   );
}

export function resetTour(tourId: TourId) {
   tourStateStore.setState((prev) => ({
      completed: prev.completed.filter((id) => id !== tourId),
      dismissed: prev.dismissed.filter((id) => id !== tourId),
   }));
}
