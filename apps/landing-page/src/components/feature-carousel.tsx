"use client";

import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CarouselItem {
   title: string;
   description: string;
   image: string;
   width: "narrow" | "wide";
   href?: string;
}

interface FeatureCarouselProps {
   label?: string;
   title: string;
   description?: string;
   ctaText: string;
   ctaHref: string;
   benefitStatement?: string;
   items: CarouselItem[];
}

export function FeatureCarousel({
   label,
   title,
   description,
   ctaText,
   ctaHref,
   benefitStatement,
   items,
}: FeatureCarouselProps) {
   const [emblaRef, emblaApi] = useEmblaCarousel(
      {
         align: "start",
         containScroll: "trimSnaps",
         dragFree: true,
      },
      [Autoplay({ delay: 4000, stopOnInteraction: false })],
   );

   const [canScrollPrev, setCanScrollPrev] = useState(false);
   const [canScrollNext, setCanScrollNext] = useState(true);

   const scrollPrev = useCallback(() => {
      emblaApi?.scrollPrev();
   }, [emblaApi]);

   const scrollNext = useCallback(() => {
      emblaApi?.scrollNext();
   }, [emblaApi]);

   const onSelect = useCallback(() => {
      if (!emblaApi) return;
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
   }, [emblaApi]);

   useEffect(() => {
      if (!emblaApi) return;
      onSelect();
      emblaApi.on("select", onSelect);
      emblaApi.on("reInit", onSelect);
      return () => {
         emblaApi.off("select", onSelect);
         emblaApi.off("reInit", onSelect);
      };
   }, [emblaApi, onSelect]);

   return (
      <div className="relative">
         <div className="relative z-30 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
               <div className="space-y-4">
                  {label && (
                     <span className=" text-primary text-sm  uppercase font-bold text-center tracking-widest">
                        {label}
                     </span>
                  )}
                  <h2 className="font-medium text-3xl md:text-4xl leading-tight tracking-tight">
                     {title}
                  </h2>
                  {description && (
                     <p
                        className="
      sm:text-xl  max-w-sm sm:max-w-xl text-foreground/70
"
                     >
                        {description}
                     </p>
                  )}
               </div>
               <div className="flex items-center">
                  <div className="hidden items-center md:flex">
                     <Button
                        className="mr-2 size-9 shrink-0 rounded-full"
                        disabled={!canScrollPrev}
                        onClick={scrollPrev}
                        size="icon"
                        variant="outline"
                     >
                        <ChevronLeft className="size-4" />
                        <span className="sr-only">Anterior</span>
                     </Button>
                     <Button
                        className="size-9 shrink-0 rounded-full"
                        disabled={!canScrollNext}
                        onClick={scrollNext}
                        size="icon"
                        variant="outline"
                     >
                        <ChevronRight className="size-4" />
                        <span className="sr-only">Proximo</span>
                     </Button>
                     <div className="mx-5 h-[18px] w-[1px] shrink-0 bg-border" />
                  </div>
                  <a href={ctaHref}>
                     <Button
                        className="shrink-0 rounded-full px-4 py-2 text-sm"
                        variant="outline"
                     >
                        {ctaText}
                        <ChevronRight className="size-4" />
                     </Button>
                  </a>
               </div>
            </div>
         </div>

         <div className="mt-9 w-full max-w-[100vw]">
            <div className="overflow-hidden" ref={emblaRef}>
               <div className="flex gap-5 py-1 pl-4 sm:pl-6 lg:pl-[max(calc((100vw-1280px)/2+2rem),2rem)]">
                  {items.map((item, index) => (
                     <CarouselCard item={item} key={index} />
                  ))}
                  <div className="w-4 shrink-0 sm:w-6 lg:w-[max(calc((100vw-1280px)/2),2rem)]" />
               </div>
            </div>
         </div>

         {benefitStatement && (
            <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
               <p className="text-lg font-medium italic text-muted-foreground">
                  "{benefitStatement}"
               </p>
            </div>
         )}

         <div className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-between lg:flex">
            <button
               aria-label="Anterior"
               className={cn(
                  "pointer-events-auto h-full w-[calc((100vw-1280px)/2)] bg-linear-to-r from-background via-background/70 to-transparent",
                  !canScrollPrev && "cursor-default opacity-0",
               )}
               disabled={!canScrollPrev}
               onClick={scrollPrev}
               type="button"
            />
            <div className="w-[1280px] shrink-0" />
            <button
               aria-label="Proximo"
               className={cn(
                  "pointer-events-auto h-full w-[calc((100vw-1280px)/2)] bg-gradient-to-l from-background via-background/70 to-transparent",
                  !canScrollNext && "cursor-default opacity-0",
               )}
               disabled={!canScrollNext}
               onClick={scrollNext}
               type="button"
            />
         </div>
      </div>
   );
}

function CarouselCard({ item }: { item: CarouselItem }) {
   const widthClass = item.width === "wide" ? "w-[725px]" : "w-[350px]";

   const content = (
      <div
         className={cn(
            "group relative z-10 shrink-0 overflow-hidden rounded-xl border border-border bg-card transition",
            "min-h-[420px] max-w-[85vw] select-none sm:max-w-none md:max-h-[478px] md:min-h-[478px]",
            "hover:scale-[1.01] hover:shadow-lg",
            widthClass,
         )}
      >
         <img
            alt={item.title}
            className="pointer-events-none h-auto w-full object-contain"
            draggable={false}
            loading="lazy"
            src={item.image}
         />
         <div className="absolute inset-x-6 bottom-8 md:inset-x-8">
            <h3 className="font-medium text-foreground">{item.title}</h3>
            <p className="mt-3 text-muted-foreground">{item.description}</p>
         </div>
      </div>
   );

   if (item.href) {
      return (
         <a className="block" draggable={false} href={item.href}>
            {content}
         </a>
      );
   }

   return content;
}
