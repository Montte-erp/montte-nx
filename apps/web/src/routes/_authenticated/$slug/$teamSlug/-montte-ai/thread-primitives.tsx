import type { ComponentProps } from "react";
import { cn } from "@packages/ui/lib/utils";

export function ChatThreadRoot({ className, ...props }: ComponentProps<"div">) {
   return (
      <div
         className={cn(
            "flex h-full w-full max-w-5xl flex-col gap-4 self-center p-4",
            className,
         )}
         {...props}
      />
   );
}

export function ChatThreadBody({ className, ...props }: ComponentProps<"div">) {
   return (
      <div
         className={cn("flex min-h-0 flex-1 flex-col", className)}
         {...props}
      />
   );
}

export function ChatThreadFooter({
   className,
   ...props
}: ComponentProps<"div">) {
   return <div className={cn("shrink-0", className)} {...props} />;
}
