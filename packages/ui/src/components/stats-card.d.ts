type Values = {
   title: string;
   description: string;
   value: number | string;
};
interface StatsCardProps {
   className?: string;
   title: Values["title"];
   description: Values["description"];
   value: Values["value"];
}
export declare function StatsCard({
   className,
   title,
   description,
   value,
}: StatsCardProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=stats-card.d.ts.map
