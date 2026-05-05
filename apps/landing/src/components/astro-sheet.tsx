import {
   Sheet,
   SheetContent,
   SheetTitle,
   SheetTrigger,
} from "@packages/ui/components/sheet";
import { useState, type ReactNode } from "react";

interface AstroSheetProps {
   children: ReactNode;
   contentClassName?: string;
   title: string;
   trigger?: ReactNode;
}

export function AstroSheet({
   children,
   contentClassName,
   title,
   trigger,
}: AstroSheetProps) {
   const [open, setOpen] = useState(false);

   if (!trigger) return null;

   return (
      <Sheet open={open} onOpenChange={setOpen}>
         <SheetTrigger asChild>{trigger}</SheetTrigger>
         <SheetContent className={contentClassName}>
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <div
               className="flex flex-col gap-4"
               onClick={(event) => {
                  if (!(event.target instanceof Element)) return;
                  if (!event.target.closest("a")) return;
                  setOpen(false);
               }}
            >
               {children}
            </div>
         </SheetContent>
      </Sheet>
   );
}
