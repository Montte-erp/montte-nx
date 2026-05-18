import { motion, type Variants, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const fadeUp: Variants = {
   hidden: { opacity: 0, y: 24 },
   visible: { opacity: 1, y: 0 },
};

const fadeIn: Variants = {
   hidden: { opacity: 0 },
   visible: { opacity: 1 },
};

interface RevealProps {
   children: ReactNode;
   delay?: number;
   duration?: number;
   variant?: "fade-up" | "fade-in";
   className?: string;
}

export function Reveal({
   children,
   delay = 0,
   duration = 0.5,
   variant = "fade-up",
   className,
}: RevealProps) {
   const variants = variant === "fade-up" ? fadeUp : fadeIn;
   const shouldReduceMotion = useReducedMotion();

   return (
      <motion.div
         className={className}
         variants={variants}
         initial={shouldReduceMotion ? false : "hidden"}
         whileInView="visible"
         viewport={{ once: true, margin: "-80px" }}
         transition={{
            duration: shouldReduceMotion ? 0 : duration,
            delay: shouldReduceMotion ? 0 : delay,
            ease: [0.32, 0.72, 0, 1],
         }}
      >
         {children}
      </motion.div>
   );
}

interface StaggerProps {
   children: ReactNode;
   stagger?: number;
   delay?: number;
   className?: string;
}

export function Stagger({
   children,
   stagger = 0.08,
   delay = 0,
   className,
}: StaggerProps) {
   const shouldReduceMotion = useReducedMotion();

   return (
      <motion.div
         className={className}
         initial={shouldReduceMotion ? false : "hidden"}
         whileInView="visible"
         viewport={{ once: true, margin: "-80px" }}
         variants={{
            hidden: {},
            visible: {
               transition: {
                  staggerChildren: shouldReduceMotion ? 0 : stagger,
                  delayChildren: shouldReduceMotion ? 0 : delay,
               },
            },
         }}
      >
         {children}
      </motion.div>
   );
}

export function StaggerItem({
   children,
   className,
}: {
   children: ReactNode;
   className?: string;
}) {
   const shouldReduceMotion = useReducedMotion();

   return (
      <motion.div
         className={className}
         variants={{
            hidden: shouldReduceMotion ? {} : { opacity: 0, y: 16 },
            visible: {
               opacity: 1,
               y: 0,
               transition: {
                  duration: shouldReduceMotion ? 0 : 0.45,
                  ease: [0.32, 0.72, 0, 1],
               },
            },
         }}
      >
         {children}
      </motion.div>
   );
}
