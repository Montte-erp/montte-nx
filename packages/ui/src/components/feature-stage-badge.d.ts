import type * as React from "react";
import { Badge } from "./badge";
declare const STAGE_CONFIG: {
   readonly alpha: {
      readonly icon: React.ForwardRefExoticComponent<
         Omit<import("lucide-react").LucideProps, "ref"> &
            React.RefAttributes<SVGSVGElement>
      >;
      readonly label: "Alpha";
      readonly className: "border-chart-1 bg-chart-1/50 text-foreground";
   };
   readonly beta: {
      readonly icon: React.ForwardRefExoticComponent<
         Omit<import("lucide-react").LucideProps, "ref"> &
            React.RefAttributes<SVGSVGElement>
      >;
      readonly label: "Beta";
      readonly className: "border-chart-2 bg-chart-2/50 text-foreground";
   };
   readonly concept: {
      readonly icon: React.ForwardRefExoticComponent<
         Omit<import("lucide-react").LucideProps, "ref"> &
            React.RefAttributes<SVGSVGElement>
      >;
      readonly label: "Conceito";
      readonly className: "border-chart-3 bg-chart-3/50 text-foreground ";
   };
   readonly "general-availability": {
      readonly icon: React.ForwardRefExoticComponent<
         Omit<import("lucide-react").LucideProps, "ref"> &
            React.RefAttributes<SVGSVGElement>
      >;
      readonly label: "Disponível";
      readonly className: "border-chart-4 bg-chart-4/50 text-foreground ";
   };
};
export type FeatureStage = keyof typeof STAGE_CONFIG;
export type FeatureStageBadgeProps = Omit<
   React.ComponentProps<typeof Badge>,
   "children" | "variant"
> & {
   stage: FeatureStage;
   showIcon?: boolean;
   isTooltip?: boolean;
};
declare function FeatureStageBadge({
   stage,
   showIcon,
   isTooltip,
   className,
   ...props
}: FeatureStageBadgeProps): import("react/jsx-runtime").JSX.Element;
export type FeatureStageChipProps = {
   stage: FeatureStage;
   count?: number;
   isActive?: boolean;
   onClick?: () => void;
   className?: string;
};
/**
 * FeatureStageChip - Um chip clicável para usar como filtro de estágio
 * - Mostra a badge com o nome do estágio
 * - Opcionalmente mostra uma contagem
 * - Suporta estado ativo/inativo
 * - Pode ser clicável para alternar filtros
 */
declare function FeatureStageChip({
   stage,
   count,
   isActive,
   onClick,
   className,
}: FeatureStageChipProps): import("react/jsx-runtime").JSX.Element;
export { FeatureStageBadge, FeatureStageChip, STAGE_CONFIG };
//# sourceMappingURL=feature-stage-badge.d.ts.map
