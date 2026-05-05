import { Button } from "@packages/ui/components/button";
import type { ReactNode } from "react";

interface LandingNavButtonProps {
   children: ReactNode;
   href: string;
   variant?: "default" | "link";
}

export function LandingNavButton({
   children,
   href,
   variant = "link",
}: LandingNavButtonProps) {
   return (
      <Button asChild variant={variant}>
         <a href={href}>{children}</a>
      </Button>
   );
}
