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
import { useCallback, useEffect, useRef, useState } from "react";

export interface FeatureCard {
   id: string;
   title: string;
   description: string;
   image: string;
   width: "narrow" | "wide";
   href?: string;
}

interface FeatureCarouselHeaderProps {
   badge: string;
   title: string;
   subtitle: string;
   ctaText: string;
   ctaHref: string;
   benefitText: string;
}

interface FeatureCarouselProps extends FeatureCarouselHeaderProps {
   items: FeatureCard[];
   autoplayInterval?: number;
   className?: string;
}

export function FeatureCarousel({
   items,
   autoplayInterval = 4000,
   className,
   badge,
   title,
   subtitle,
   ctaText,
   ctaHref,
   benefitText,
}: FeatureCarouselProps) {
   const [api, setApi] = useState<CarouselApi>();
   const [canScrollPrev, setCanScrollPrev] = useState(false);
   const [canScrollNext, setCanScrollNext] = useState(true);
   const [selectedIndex, setSelectedIndex] = useState(0);
   const autoplayRef = useRef(
      Autoplay({
         delay: autoplayInterval,
         stopOnMouseEnter: true,
         stopOnInteraction: false,
      }),
   );

   // Last real item index (0-indexed, spacers are not CarouselItems)
   const lastItemIndex = items.length - 1;

   // Track scroll state
   const onSelect = useCallback(
      (api: CarouselApi) => {
         if (!api) return;
         const index = api.selectedScrollSnap();
         setSelectedIndex(index);
         setCanScrollPrev(index > 0);
         // Can scroll next only if not at the last item
         setCanScrollNext(index < lastItemIndex);
      },
      [lastItemIndex],
   );

   // Custom scroll next that rewinds at end
   const scrollNext = useCallback(() => {
      if (!api) return;
      const currentIndex = api.selectedScrollSnap();
      if (currentIndex >= lastItemIndex) {
         // At end, rewind to start
         api.scrollTo(0);
      } else {
         api.scrollNext();
      }
   }, [api, lastItemIndex]);

   // Custom scroll prev
   const scrollPrev = useCallback(() => {
      if (!api) return;
      api.scrollPrev();
   }, [api]);

   useEffect(() => {
      if (!api) return;
      onSelect(api);
      api.on("reInit", onSelect);
      api.on("select", onSelect);

      // Handle autoplay rewind when reaching the end
      const handleSettle = () => {
         const currentIndex = api.selectedScrollSnap();
         if (currentIndex >= lastItemIndex) {
            setTimeout(() => {
               api.scrollTo(0);
            }, autoplayInterval);
         }
      };
      api.on("settle", handleSettle);

      return () => {
         api.off("select", onSelect);
         api.off("reInit", onSelect);
         api.off("settle", handleSettle);
      };
   }, [api, onSelect, autoplayInterval, lastItemIndex]);

   return (
      <div className="relative">
         {/* Header */}
         <div className="container mx-auto mb-12 max-w-7xl px-4">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
               <div className="flex flex-col items-start space-y-4">
                  <span className="text-sm font-bold uppercase tracking-widest text-primary">
                     {badge}
                  </span>
                  <h2 className="inline-block max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
                     {title}
                  </h2>
                  <p className="max-w-sm text-foreground/70 sm:max-w-xl sm:text-xl">
                     {subtitle}
                  </p>
               </div>
               <div className="flex items-center gap-4">
                  <a href={ctaHref}>
                     <Button variant="outline">{ctaText}</Button>
                  </a>
                  <div className="hidden items-center gap-2 md:flex">
                     <Button
                        className="rounded-full"
                        disabled={!canScrollPrev}
                        onClick={scrollPrev}
                        size="icon"
                        variant="outline"
                     >
                        <ChevronLeft className="size-4" />
                     </Button>
                     <Button
                        className="rounded-full"
                        onClick={scrollNext}
                        size="icon"
                        variant="outline"
                     >
                        <ChevronRight className="size-4" />
                     </Button>
                  </div>
               </div>
            </div>
         </div>

         <Carousel
            className={cn("w-full", className)}
            opts={{
               align: "start",
               loop: false,
               skipSnaps: false,
               containScroll: "keepSnaps",
            }}
            plugins={[autoplayRef.current]}
            setApi={setApi}
         >
            <CarouselContent className="gap-4">
               {/* Spacer to align first card with header container */}
               <div className="min-w-[max(calc((100vw-1280px)/2),1rem)] shrink-0" />
               {items.map((item) => (
                  <CarouselItem
                     className={cn(
                        "basis-auto",
                        item.width === "wide"
                           ? "md:basis-[725px]"
                           : "md:basis-[350px]",
                     )}
                     key={item.id}
                  >
                     <a
                        className={cn(
                           "group relative z-10 block shrink-0 overflow-hidden rounded-xl border border-border bg-card transition hover:scale-[1.01] hover:shadow-lg",
                           "min-h-[420px] max-w-[85vw] select-none sm:max-w-none md:max-h-[478px] md:min-h-[478px]",
                           item.width === "wide" ? "w-[725px]" : "w-[350px]",
                        )}
                        href={item.href || "#"}
                     >
                        <img
                           alt={item.title}
                           className="pointer-events-none h-auto w-full object-contain"
                           draggable={false}
                           loading="lazy"
                           src={item.image}
                        />
                        <div className="absolute inset-x-6 bottom-8 md:inset-x-8">
                           <h3 className="font-medium text-foreground">
                              {item.title}
                           </h3>
                           <p className="mt-3 text-muted-foreground">
                              {item.description}
                           </p>
                        </div>
                     </a>
                  </CarouselItem>
               ))}
               {/* Trailing spacer to allow last item to scroll into view */}
               <div className="min-w-[max(calc((100vw-1280px)/2),1rem)] shrink-0" />
            </CarouselContent>
         </Carousel>

         {/* Gradient overlays */}
         <div className="pointer-events-none absolute bottom-0 top-[calc(theme(spacing.12)+1rem+100px)] z-20 flex w-full justify-center">
            {/* Left fade gradient */}
            <button
               aria-label="Previous"
               className="pointer-events-auto hidden h-full grow bg-gradient-to-r from-background from-0% via-background/70 via-50% to-transparent disabled:cursor-default not-disabled:cursor-pointer md:block"
               disabled={!canScrollPrev}
               onClick={scrollPrev}
               type="button"
            />
            {/* Center spacer - visible content area */}
            <div className="w-full shrink-0 md:w-[min(1126px,calc(100vw-8rem))]" />
            {/* Right fade gradient */}
            <button
               aria-label="Next"
               className="pointer-events-auto hidden h-full grow cursor-pointer bg-gradient-to-l from-background from-0% via-background/70 via-50% to-transparent md:block"
               onClick={scrollNext}
               type="button"
            />
         </div>

         {/* Benefit Statement */}
         <div className="container mx-auto mt-8 max-w-7xl px-4">
            <p className="text-sm text-muted-foreground">{benefitText}</p>
         </div>
      </div>
   );
}
