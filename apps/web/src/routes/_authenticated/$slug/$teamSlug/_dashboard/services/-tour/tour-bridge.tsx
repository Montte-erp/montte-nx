import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";
import { useTour } from "@packages/ui/components/tour";
import {
   clearTourRequest,
   markTourCompleted,
   markTourDismissed,
   tourRequestStore,
   type TourId,
} from "./store";

export function TourBridge() {
   const { startTour, setIsTourCompleted } = useTour();
   const posthog = usePostHog();
   const nonce = useStore(tourRequestStore, (s) => s.nonce);
   const requestedTourId = useStore(tourRequestStore, (s) => s.requestedTourId);

   useEffect(() => {
      if (!requestedTourId) return;
      setIsTourCompleted(false);
      startTour(requestedTourId);
      posthog.capture("tour_started", { tour_id: requestedTourId });
      clearTourRequest();
   }, [nonce, requestedTourId, startTour, setIsTourCompleted, posthog]);

   return null;
}

export function handleTourComplete(tourId: string) {
   markTourCompleted(tourId as TourId);
}

export function handleTourSkip(tourId: string) {
   markTourDismissed(tourId as TourId);
}
