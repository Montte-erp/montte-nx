"use client";

import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

const carouselItems = [
   {
      id: "dashboard",
      label: "Dashboards Personalizados",
      image: "https://placehold.co/875x609/1a1a2e/939DB8?text=Dashboards",
      imageSm: "https://placehold.co/390x448/1a1a2e/939DB8?text=Dashboards",
   },
   {
      id: "transactions",
      label: "Gestao de Transacoes",
      image: "https://placehold.co/875x609/1a1a2e/939DB8?text=Transacoes",
      imageSm: "https://placehold.co/390x448/1a1a2e/939DB8?text=Transacoes",
   },
   {
      id: "bills",
      label: "Contas a Pagar e Receber",
      image: "https://placehold.co/875x609/1a1a2e/939DB8?text=Contas",
      imageSm: "https://placehold.co/390x448/1a1a2e/939DB8?text=Contas",
   },
   {
      id: "budgets",
      label: "Orcamentos e Metas",
      image: "https://placehold.co/875x609/1a1a2e/939DB8?text=Orcamentos",
      imageSm: "https://placehold.co/390x448/1a1a2e/939DB8?text=Orcamentos",
   },
   {
      id: "insights",
      label: "Insights e Analises",
      image: "https://placehold.co/875x609/1a1a2e/939DB8?text=Insights",
      imageSm: "https://placehold.co/390x448/1a1a2e/939DB8?text=Insights",
   },
];

const AUTOPLAY_INTERVAL = 4000;

export default function HeroCarousel() {
   const [current, setCurrent] = useState(0);
   const [isPaused, setIsPaused] = useState(false);

   const next = useCallback(() => {
      setCurrent((prev) => (prev + 1) % carouselItems.length);
   }, []);

   const previous = useCallback(() => {
      setCurrent(
         (prev) => (prev - 1 + carouselItems.length) % carouselItems.length,
      );
   }, []);

   const goTo = useCallback((index: number) => {
      setCurrent(index);
   }, []);

   useEffect(() => {
      if (isPaused) return;

      const interval = setInterval(() => {
         next();
      }, AUTOPLAY_INTERVAL);

      return () => clearInterval(interval);
   }, [isPaused, next]);

   return (
      <section
         aria-label="Feature carousel"
         className="relative"
         onMouseEnter={() => setIsPaused(true)}
         onMouseLeave={() => setIsPaused(false)}
      >
         <div className="relative w-auto  h-96">
            <AnimatePresence mode="wait">
               {carouselItems.map(
                  (item, index) =>
                     current === index && (
                        <motion.div
                           animate={{ opacity: 1, scale: 1 }}
                           className="absolute inset-0"
                           exit={{ opacity: 0, scale: 0.98 }}
                           initial={{ opacity: 0, scale: 1.02 }}
                           key={item.id}
                           transition={{ duration: 0.5, ease: "easeInOut" }}
                        >
                           <img
                              alt={item.label}
                              className="hidden sm:block w-full h-full object-cover rounded-xl shadow-2xl border border-border/20"
                              draggable={false}
                              height={609}
                              src={item.image}
                              width={875}
                           />
                           <img
                              alt={item.label}
                              className="sm:hidden w-full h-full object-cover rounded-xl shadow-2xl border border-border/20"
                              draggable={false}
                              height={448}
                              src={item.imageSm}
                              width={390}
                           />
                        </motion.div>
                     ),
               )}
            </AnimatePresence>
         </div>

         <div className="relative z-10 mt-4">
            <div className="text-center text-muted-foreground text-sm relative h-8 sm:h-10">
               <AnimatePresence mode="wait">
                  {carouselItems[current] && (
                     <motion.span
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute left-0 right-0"
                        exit={{ opacity: 0, y: -10 }}
                        initial={{ opacity: 0, y: 10 }}
                        key={carouselItems[current].id}
                        transition={{ duration: 0.3 }}
                     >
                        {carouselItems[current].label}
                     </motion.span>
                  )}
               </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-x-4">
               <Button
                  className="size-7 rounded-full border-border/20 bg-background/50 backdrop-blur-sm"
                  onClick={previous}
                  size="icon"
                  variant="outline"
               >
                  <ChevronLeft className="size-4 text-muted-foreground" />
               </Button>

               <div className="flex items-center gap-x-0.5">
                  {carouselItems.map((item, index) => (
                     <button
                        className="group px-1.5 py-2"
                        key={item.id}
                        onClick={() => goTo(index)}
                        type="button"
                     >
                        <motion.div
                           animate={{
                              scale: current === index ? 1.2 : 1,
                              backgroundColor:
                                 current === index
                                    ? "hsl(var(--primary))"
                                    : "hsl(var(--background) / 0.5)",
                           }}
                           className={cn(
                              "rounded-full shrink-0 overflow-hidden border border-border/20 size-2 transition-colors",
                           )}
                           transition={{ duration: 0.2 }}
                        />
                     </button>
                  ))}
               </div>

               <Button
                  className="size-7 rounded-full border-border/20 bg-background/50 backdrop-blur-sm"
                  onClick={next}
                  size="icon"
                  variant="outline"
               >
                  <ChevronRight className="size-4 text-muted-foreground" />
               </Button>
            </div>
         </div>
      </section>
   );
}
