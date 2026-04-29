import { Button } from "@packages/ui/components/button";
import { CircleHelp } from "lucide-react";
import { requestTour, resetTour, type TourId } from "./store";

export function TourHelpButton({ tourId }: { tourId: TourId }) {
   return (
      <Button
         onClick={() => {
            resetTour(tourId);
            requestTour(tourId, true);
         }}
         size="icon"
         tooltip="Refazer tour desta tela"
         variant="ghost"
      >
         <CircleHelp className="size-4" />
         <span className="sr-only">Refazer tour</span>
      </Button>
   );
}
