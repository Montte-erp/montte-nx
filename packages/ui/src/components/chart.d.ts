import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type {
   NameType,
   ValueType,
} from "recharts/types/component/DefaultTooltipContent";
declare const THEMES: {
   readonly light: "";
   readonly dark: ".dark";
};
export type ChartConfig = Record<
   string,
   {
      label?: React.ReactNode;
      icon?: React.ComponentType;
   } & (
      | {
           color?: string;
           theme?: never;
        }
      | {
           color?: never;
           theme: Record<keyof typeof THEMES, string>;
        }
   )
>;
declare function ChartContainer({
   id,
   className,
   children,
   config,
   ...props
}: React.ComponentProps<"div"> & {
   config: ChartConfig;
   children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
   >["children"];
}): import("react/jsx-runtime").JSX.Element;
declare const ChartStyle: ({
   id,
   config,
}: {
   id: string;
   config: ChartConfig;
}) => import("react/jsx-runtime").JSX.Element | null;
declare const ChartTooltip: typeof RechartsPrimitive.Tooltip;
declare function ChartTooltipContent({
   active,
   className,
   indicator,
   hideLabel,
   hideIndicator,
   labelFormatter,
   labelClassName,
   formatter,
   color,
   nameKey,
   labelKey,
   payload,
   label,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
   React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
   } & Omit<
      RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>,
      "accessibilityLayer"
   >): import("react/jsx-runtime").JSX.Element | null;
declare const ChartLegend: React.MemoExoticComponent<
   (outsideProps: RechartsPrimitive.LegendProps) => React.ReactPortal | null
>;
declare function ChartLegendContent({
   className,
   hideIcon,
   nameKey,
   payload,
   verticalAlign,
}: React.ComponentProps<"div"> & {
   hideIcon?: boolean;
   nameKey?: string;
} & RechartsPrimitive.DefaultLegendContentProps):
   | import("react/jsx-runtime").JSX.Element
   | null;
export {
   ChartContainer,
   ChartTooltip,
   ChartTooltipContent,
   ChartLegend,
   ChartLegendContent,
   ChartStyle,
};
//# sourceMappingURL=chart.d.ts.map
