import { motion, type Variants } from "motion/react";
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

   return (
      <motion.div
         className={className}
         variants={variants}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, margin: "-80px" }}
         transition={{ duration, delay, ease: [0.32, 0.72, 0, 1] }}
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
   return (
      <motion.div
         className={className}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, margin: "-80px" }}
         variants={{
            hidden: {},
            visible: {
               transition: { staggerChildren: stagger, delayChildren: delay },
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
   return (
      <motion.div
         className={className}
         variants={{
            hidden: { opacity: 0, y: 16 },
            visible: {
               opacity: 1,
               y: 0,
               transition: { duration: 0.45, ease: [0.32, 0.72, 0, 1] },
            },
         }}
      >
         {children}
      </motion.div>
   );
}
