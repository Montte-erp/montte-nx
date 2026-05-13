import type React from "react";

export interface PageFilterProps {
   id: string;
   label: string;
   group: string;
   active: boolean;
   onToggle: (active: boolean) => void;
   icon?: React.ReactNode;
}

export function PageFilter(_props: PageFilterProps) {
   return null;
}

PageFilter.displayName = "PageFilter";
