import { TourProvider } from "@packages/ui/components/tour";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";
import {
   handleTourComplete,
   handleTourSkip,
   TourBridge,
} from "./services/-tour/tour-bridge";
import { servicesTours } from "./services/-tour/tours";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services",
)({
   component: ServicesLayout,
});

function ServicesLayout() {
   const posthog = usePostHog();

   const onComplete = useCallback(
      (tourId: string) => {
         handleTourComplete(tourId);
         posthog.capture("tour_completed", { tour_id: tourId });
      },
      [posthog],
   );

   const onSkip = useCallback(
      (tourId: string, step: number) => {
         handleTourSkip(tourId);
         posthog.capture("tour_dismissed", { tour_id: tourId, step });
      },
      [posthog],
   );

   const onStepChange = useCallback(
      (tourId: string, step: number) => {
         posthog.capture("tour_step_viewed", { tour_id: tourId, step });
      },
      [posthog],
   );

   return (
      <TourProvider
         closeable
         onComplete={onComplete}
         onSkip={onSkip}
         onStepChange={onStepChange}
         tours={servicesTours}
      >
         <TourBridge />
         <Outlet />
      </TourProvider>
   );
}
