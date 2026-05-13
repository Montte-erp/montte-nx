import type React from "react";

export interface PageFilterSelectOption {
   value: string;
   label: string;
}

export interface PageFilterSelectProps {
   id: string;
   group: string;
   label: string;
   value: string;
   options: PageFilterSelectOption[];
   onChange: (value: string) => void;
   icon?: React.ReactNode;
}

export function PageFilterSelect(_props: PageFilterSelectProps) {
   return null;
}

PageFilterSelect.displayName = "PageFilterSelect";
