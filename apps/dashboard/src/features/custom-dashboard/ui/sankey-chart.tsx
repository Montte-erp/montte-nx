"use client";

import { formatDecimalCurrency } from "@packages/money";
import { cn } from "@packages/ui/lib/utils";
import { useMemo } from "react";

export type SankeyNode = {
   id: string;
   name: string;
   value: number;
   type: "source" | "target";
   color?: string;
};

export type SankeyLink = {
   source: string;
   target: string;
   value: number;
};

export type SankeyData = {
   nodes: SankeyNode[];
   links: SankeyLink[];
};

type SankeyChartProps = {
   data: SankeyData;
   height?: number;
   className?: string;
};

const DEFAULT_COLORS = [
   "hsl(var(--chart-1))",
   "hsl(var(--chart-2))",
   "hsl(var(--chart-3))",
   "hsl(var(--chart-4))",
   "hsl(var(--chart-5))",
   "hsl(var(--chart-6))",
   "hsl(var(--chart-7))",
   "hsl(var(--chart-8))",
   "hsl(var(--chart-9))",
   "hsl(var(--chart-10))",
];

export function SankeyChart({
   data,
   height = 400,
   className,
}: SankeyChartProps) {
   const { nodes, positions, paths } = useMemo(() => {
      if (!data.nodes.length || !data.links.length) {
         return { nodes: [], positions: new Map(), paths: [] };
      }

      const sourceNodes = data.nodes.filter((n) => n.type === "source");
      const targetNodes = data.nodes.filter((n) => n.type === "target");

      const totalSourceValue = sourceNodes.reduce((sum, n) => sum + n.value, 0);
      const totalTargetValue = targetNodes.reduce((sum, n) => sum + n.value, 0);

      // Calculate positions
      const padding = 40;
      const nodeWidth = 20;
      const chartWidth = 600;
      const availableHeight = height - padding * 2;

      const positions = new Map<
         string,
         { x: number; y: number; height: number }
      >();

      // Position source nodes on the left
      let sourceY = padding;
      for (const node of sourceNodes) {
         const nodeHeight = Math.max(
            20,
            (node.value / totalSourceValue) * availableHeight,
         );
         positions.set(node.id, {
            x: padding,
            y: sourceY,
            height: nodeHeight,
         });
         sourceY += nodeHeight + 10;
      }

      // Position target nodes on the right
      let targetY = padding;
      for (const node of targetNodes) {
         const nodeHeight = Math.max(
            20,
            (node.value / totalTargetValue) * availableHeight,
         );
         positions.set(node.id, {
            x: chartWidth - padding - nodeWidth,
            y: targetY,
            height: nodeHeight,
         });
         targetY += nodeHeight + 10;
      }

      // Generate curved paths for links
      const paths = data.links
         .map((link, index) => {
            const sourcePos = positions.get(link.source);
            const targetPos = positions.get(link.target);

            if (!sourcePos || !targetPos) return null;

            const sourceNode = data.nodes.find((n) => n.id === link.source);
            const targetNode = data.nodes.find((n) => n.id === link.target);

            if (!sourceNode || !targetNode) return null;

            // Calculate link thickness based on value
            const linkHeight = Math.max(
               4,
               Math.min(
                  sourcePos.height * 0.8,
                  (link.value / sourceNode.value) * sourcePos.height,
               ),
            );

            const x1 = sourcePos.x + nodeWidth;
            const y1 = sourcePos.y + sourcePos.height / 2;
            const x2 = targetPos.x;
            const y2 = targetPos.y + targetPos.height / 2;

            // Bezier curve control points
            const cx1 = x1 + (x2 - x1) * 0.5;
            const cx2 = x1 + (x2 - x1) * 0.5;

            const path = `M ${x1} ${y1 - linkHeight / 2}
				C ${cx1} ${y1 - linkHeight / 2}, ${cx2} ${y2 - linkHeight / 2}, ${x2} ${y2 - linkHeight / 2}
				L ${x2} ${y2 + linkHeight / 2}
				C ${cx2} ${y2 + linkHeight / 2}, ${cx1} ${y1 + linkHeight / 2}, ${x1} ${y1 + linkHeight / 2}
				Z`;

            return {
               id: `${link.source}-${link.target}`,
               path,
               value: link.value,
               color:
                  sourceNode.color ??
                  DEFAULT_COLORS[index % DEFAULT_COLORS.length],
               sourceName: sourceNode.name,
               targetName: targetNode.name,
            };
         })
         .filter(Boolean);

      return { nodes: data.nodes, positions, paths };
   }, [data, height]);

   if (!nodes.length) {
      return (
         <div
            className={cn(
               "flex items-center justify-center text-muted-foreground text-sm",
               className,
            )}
            style={{ height }}
         >
            Sem dados para exibir fluxo
         </div>
      );
   }

   return (
      <div className={cn("w-full overflow-hidden", className)}>
         <svg
            height={height}
            preserveAspectRatio="xMidYMid meet"
            viewBox="0 0 600 400"
            width="100%"
         >
            {/* Links */}
            <g className="links">
               {paths.map((link) => (
                  <g key={link?.id}>
                     <path
                        className="transition-opacity hover:opacity-70"
                        d={link?.path}
                        fill={link?.color}
                        opacity={0.4}
                     />
                     <title>
                        {link?.sourceName} → {link?.targetName}:{" "}
                        {formatDecimalCurrency(link?.value ?? 0)}
                     </title>
                  </g>
               ))}
            </g>

            {/* Source Nodes */}
            <g className="source-nodes">
               {data.nodes
                  .filter((n) => n.type === "source")
                  .map((node, index) => {
                     const pos = positions.get(node.id);
                     if (!pos) return null;
                     const color =
                        node.color ??
                        DEFAULT_COLORS[index % DEFAULT_COLORS.length];

                     return (
                        <g key={node.id}>
                           <rect
                              fill={color}
                              height={pos.height}
                              rx={4}
                              width={20}
                              x={pos.x}
                              y={pos.y}
                           />
                           <text
                              className="text-xs fill-foreground"
                              dominantBaseline="middle"
                              textAnchor="end"
                              x={pos.x - 8}
                              y={pos.y + pos.height / 2}
                           >
                              {node.name}
                           </text>
                           <text
                              className="text-[10px] fill-muted-foreground"
                              dominantBaseline="middle"
                              textAnchor="end"
                              x={pos.x - 8}
                              y={pos.y + pos.height / 2 + 14}
                           >
                              {formatDecimalCurrency(node.value)}
                           </text>
                        </g>
                     );
                  })}
            </g>

            {/* Target Nodes */}
            <g className="target-nodes">
               {data.nodes
                  .filter((n) => n.type === "target")
                  .map((node, index) => {
                     const pos = positions.get(node.id);
                     if (!pos) return null;
                     const color =
                        node.color ??
                        DEFAULT_COLORS[(index + 3) % DEFAULT_COLORS.length];

                     return (
                        <g key={node.id}>
                           <rect
                              fill={color}
                              height={pos.height}
                              rx={4}
                              width={20}
                              x={pos.x}
                              y={pos.y}
                           />
                           <text
                              className="text-xs fill-foreground"
                              dominantBaseline="middle"
                              textAnchor="start"
                              x={pos.x + 28}
                              y={pos.y + pos.height / 2}
                           >
                              {node.name}
                           </text>
                           <text
                              className="text-[10px] fill-muted-foreground"
                              dominantBaseline="middle"
                              textAnchor="start"
                              x={pos.x + 28}
                              y={pos.y + pos.height / 2 + 14}
                           >
                              {formatDecimalCurrency(node.value)}
                           </text>
                        </g>
                     );
                  })}
            </g>
         </svg>
      </div>
   );
}

/**
 * Transform transaction data into Sankey format
 * Shows flow from income sources (bank accounts) to expense categories
 */
export function transformToSankeyData(
   incomeBySource: Array<{ name: string; value: number }>,
   expensesByCategory: Array<{ name: string; value: number }>,
): SankeyData {
   const nodes: SankeyNode[] = [];
   const links: SankeyLink[] = [];

   // Add income sources as source nodes
   for (const source of incomeBySource) {
      if (source.value > 0) {
         nodes.push({
            id: `income-${source.name}`,
            name: source.name,
            value: source.value,
            type: "source",
         });
      }
   }

   // Add expense categories as target nodes
   for (const category of expensesByCategory) {
      if (category.value > 0) {
         nodes.push({
            id: `expense-${category.name}`,
            name: category.name,
            value: category.value,
            type: "target",
         });
      }
   }

   // Create links from each income source to each expense category
   // proportionally based on their relative values
   const totalIncome = incomeBySource.reduce((sum, s) => sum + s.value, 0);
   const totalExpenses = expensesByCategory.reduce(
      (sum, c) => sum + c.value,
      0,
   );

   if (totalIncome > 0 && totalExpenses > 0) {
      for (const source of incomeBySource) {
         if (source.value <= 0) continue;
         const sourceProportion = source.value / totalIncome;

         for (const category of expensesByCategory) {
            if (category.value <= 0) continue;
            // Link value is proportional to both source contribution and category size
            const linkValue = sourceProportion * category.value;

            if (linkValue > 0) {
               links.push({
                  source: `income-${source.name}`,
                  target: `expense-${category.name}`,
                  value: linkValue,
               });
            }
         }
      }
   }

   return { nodes, links };
}
