import { Badge } from "@packages/ui/components/badge";
import { cn } from "@packages/ui/lib/utils";
import type * as React from "react";

function Announcement({
   className,
   themed = false,
   ...props
}: React.ComponentProps<typeof Badge> & { themed?: boolean }) {
   return (
      <Badge
         variant="outline"
         className={cn(
            "group max-w-full gap-2 rounded-full bg-background px-3 py-0.5 font-medium shadow-sm transition-all",
            themed && "border-foreground/5",
            className,
         )}
         {...props}
      />
   );
}

function AnnouncementTag({
   className,
   ...props
}: React.ComponentProps<typeof Badge>) {
   return (
      <Badge
         variant="secondary"
         className={cn(
            "-ml-2.5 shrink-0 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium",
            className,
         )}
         {...props}
      />
   );
}

function AnnouncementTitle({
   className,
   ...props
}: React.ComponentProps<"div">) {
   return (
      <div
         className={cn("flex items-center gap-1 truncate py-1", className)}
         {...props}
      />
   );
}

export { Announcement, AnnouncementTag, AnnouncementTitle };
