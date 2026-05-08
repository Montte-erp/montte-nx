import { useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function RouteTransition({ children }: { children: ReactNode }) {
   const pathname = useRouterState({ select: (s) => s.location.pathname });

   return (
      <motion.div
         animate={{ opacity: 1, x: 0 }}
         className="w-full"
         initial={{ opacity: 0, x: 24 }}
         key={pathname}
         transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
         {children}
      </motion.div>
   );
}
