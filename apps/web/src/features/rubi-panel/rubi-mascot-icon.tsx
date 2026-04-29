import type { ComponentProps } from "react";

export function RubiMascotIcon({ className, ...props }: ComponentProps<"img">) {
   return (
      <img
         alt=""
         aria-hidden="true"
         className={className}
         draggable={false}
         src="/mascot.svg"
         {...props}
      />
   );
}
