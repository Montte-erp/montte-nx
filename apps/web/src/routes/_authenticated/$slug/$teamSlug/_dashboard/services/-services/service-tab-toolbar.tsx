import type { ReactNode } from "react";

interface ServiceTabToolbarProps {
   children?: ReactNode;
}

export function ServiceTabToolbar({ children }: ServiceTabToolbarProps) {
   return (
      <div className="flex flex-wrap items-center gap-2 justify-between">
         <div />
         <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
   );
}
