import type { ReactNode } from "react";
interface QuickAccessCardProps {
   icon: ReactNode;
   title: string;
   description: string;
   onClick?: () => void;
   disabled?: boolean;
   content?: ReactNode;
}
export declare function QuickAccessCard({
   content,
   icon,
   title,
   description,
   onClick,
   disabled,
}: QuickAccessCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=quick-access-card.d.ts.map
