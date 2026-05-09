import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";

export function Navbar() {
   const { scrollY } = useScroll();
   const [scrolled, setScrolled] = useState(false);

   useMotionValueEvent(scrollY, "change", (latest) => {
      setScrolled(latest > 64);
   });

   return (
      <motion.header
         initial={{ y: -64, opacity: 0 }}
         animate={{
            y: scrolled ? 0 : -64,
            opacity: scrolled ? 1 : 0,
         }}
         transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
         className="fixed inset-x-0 top-4 z-40"
         style={{ pointerEvents: scrolled ? "auto" : "none" }}
      >
         <nav
            className="mx-auto flex max-w-7xl items-center justify-center px-4 sm:px-4"
            aria-label="Principal"
         >
            <motion.a
               href="/"
               aria-label="Montte"
               whileHover={{ scale: 1.06 }}
               whileTap={{ scale: 0.94 }}
               transition={{ type: "spring", stiffness: 400, damping: 24 }}
               className="inline-flex size-12 items-center justify-center rounded-full border border-border/40 bg-background/70 shadow-lg shadow-background/30 backdrop-blur-xl"
            >
               <img
                  src="/favicon.svg"
                  alt=""
                  width={28}
                  height={28}
                  loading="eager"
                  decoding="async"
                  className="size-7"
               />
            </motion.a>
         </nav>
      </motion.header>
   );
}
