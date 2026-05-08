import { useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import type { ReactNode } from "react";

export function RouteTransition({
   children,
   transitionKey,
}: {
   children: ReactNode;
   transitionKey?: string;
}) {
   const pathname = useRouterState({ select: (s) => s.location.pathname });
   const key = transitionKey ?? pathname;

   return (
      <motion.div
         animate={{ opacity: 1, x: 0 }}
         className="w-full"
         initial={{ opacity: 0, x: 24 }}
         key={key}
         transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      >
         {children}
      </motion.div>
   );
}
