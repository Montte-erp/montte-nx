import { Button } from "@packages/ui/components/button";
import {
   Carousel,
   type CarouselApi,
   CarouselContent,
   CarouselItem,
} from "@packages/ui/components/carousel";
import { cn } from "@packages/ui/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface HeroSlide {
   id: string;
   label: string;
   imageLightUrl: string;
   imageDarkUrl: string;
}

interface HeroCarouselProps {
   items: HeroSlide[];
   autoplayInterval?: number;
   showNavigation?: boolean;
   showDots?: boolean;
   showLabels?: boolean;
   className?: string;
}

export function HeroCarousel({
   items,
   autoplayInterval = 4000,
   showNavigation = true,
   showDots = true,
   showLabels = true,
   className,
}: HeroCarouselProps) {
   const [api, setApi] = useState<CarouselApi>();
   const [current, setCurrent] = useState(0);
   const autoplayRef = useRef(
      Autoplay({
         delay: autoplayInterval,
         stopOnMouseEnter: true,
         stopOnInteraction: false,
      }),
   );

   useEffect(() => {
      if (!api) return;

      const updateState = () => {
         setCurrent(api.selectedScrollSnap());
      };

      updateState();
      api.on("select", updateState);
      api.on("reInit", updateState);

      return () => {
         api.off("select", updateState);
         api.off("reInit", updateState);
      };
   }, [api]);

   const scrollTo = (index: number) => {
      api?.scrollTo(index);
   };

   return (
      <section aria-label="Carousel" className={cn("relative", className)}>
         <Carousel
            opts={{ loop: true }}
            plugins={[autoplayRef.current]}
            setApi={setApi}
         >
            <CarouselContent>
               {items.map((item) => (
                  <CarouselItem key={item.id}>
                     <div className="relative h-96">
                        <img
                           alt={item.label}
                           className="dark:hidden w-full h-full object-cover rounded-xl shadow-2xl border border-border/20"
                           draggable={false}
                           src={item.imageLightUrl}
                        />
                        <img
                           alt={item.label}
                           className="hidden dark:block w-full h-full object-cover rounded-xl shadow-2xl border border-border/20"
                           draggable={false}
                           src={item.imageDarkUrl}
                        />
                     </div>
                  </CarouselItem>
               ))}
            </CarouselContent>
         </Carousel>

         {/* Labels + Navigation */}
         {(showLabels || showNavigation || showDots) && (
            <div className="relative z-10 mt-4">
               {showLabels && items.length > 0 && (
                  <div className="text-center text-muted-foreground text-sm relative h-8 sm:h-10">
                     {items.map((item, index) => (
                        <span
                           className={cn(
                              "absolute left-0 right-0 transition-all duration-300",
                              index === current
                                 ? "opacity-100 translate-y-0"
                                 : "opacity-0 translate-y-2.5",
                           )}
                           key={`label-${item.id}`}
                        >
                           {item.label}
                        </span>
                     ))}
                  </div>
               )}

               {(showNavigation || showDots) && (
                  <div className="flex items-center justify-center gap-x-4">
                     {showNavigation && (
                        <Button
                           className="size-7 rounded-full border-border/20 bg-background/50 backdrop-blur-sm"
                           onClick={() => api?.scrollPrev()}
                           size="icon"
                           variant="outline"
                        >
                           <ChevronLeft className="size-4 text-muted-foreground" />
                        </Button>
                     )}

                     {showDots && (
                        <div className="flex items-center gap-x-0.5">
                           {items.map((item, index) => (
                              <Button
                                 className="px-1.5 py-2 h-auto"
                                 key={`dot-${item.id}`}
                                 onClick={() => scrollTo(index)}
                                 size="icon"
                                 variant="ghost"
                              >
                                 <div
                                    className={cn(
                                       "rounded-full shrink-0 overflow-hidden border border-border/20 size-2 transition-all duration-200",
                                       index === current
                                          ? "scale-125 bg-primary"
                                          : "scale-100 bg-background/50",
                                    )}
                                 />
                              </Button>
                           ))}
                        </div>
                     )}

                     {showNavigation && (
                        <Button
                           className="size-7 rounded-full border-border/20 bg-background/50 backdrop-blur-sm"
                           onClick={() => api?.scrollNext()}
                           size="icon"
                           variant="outline"
                        >
                           <ChevronRight className="size-4 text-muted-foreground" />
                        </Button>
                     )}
                  </div>
               )}
            </div>
         )}
      </section>
   );
}
