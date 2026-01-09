"use client";

import { cn } from "@packages/ui/lib/utils";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	Line,
	LineChart,
	ResponsiveContainer,
} from "recharts";

export type SparklineVariant = "line" | "area" | "bar";

type SparklineDataPoint = {
	value: number;
};

interface SparklineProps {
	data: SparklineDataPoint[];
	variant?: SparklineVariant;
	className?: string;
	color?: string;
	showGradient?: boolean;
	strokeWidth?: number;
	height?: number;
}

export function Sparkline({
	data,
	variant = "line",
	className,
	color = "currentColor",
	showGradient = true,
	strokeWidth = 1.5,
	height = 32,
}: SparklineProps) {
	if (!data || data.length === 0) {
		return null;
	}

	const gradientId = `sparkline-gradient-${Math.random().toString(36).slice(2, 9)}`;

	return (
		<div className={cn("w-full", className)} style={{ height }}>
			<ResponsiveContainer width="100%" height="100%">
				{variant === "bar" ? (
					<BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
						<Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
					</BarChart>
				) : variant === "area" ? (
					<AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={color} stopOpacity={0.3} />
								<stop offset="100%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
						<Area
							type="monotone"
							dataKey="value"
							stroke={color}
							strokeWidth={strokeWidth}
							fill={showGradient ? `url(#${gradientId})` : "transparent"}
						/>
					</AreaChart>
				) : (
					<LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
						<Line
							type="monotone"
							dataKey="value"
							stroke={color}
							strokeWidth={strokeWidth}
							dot={false}
						/>
					</LineChart>
				)}
			</ResponsiveContainer>
		</div>
	);
}

interface TrendSparklineProps extends Omit<SparklineProps, "color"> {
	trend?: "up" | "down" | "neutral";
}

export function TrendSparkline({
	data,
	trend,
	...props
}: TrendSparklineProps) {
	const computedTrend = (() => {
		if (trend) return trend;
		if (data.length < 2) return "neutral";
		const first = data[0];
		const last = data[data.length - 1];
		if (!first || !last) return "neutral";
		if (last.value > first.value) return "up";
		if (last.value < first.value) return "down";
		return "neutral";
	})();

	const trendColors = {
		up: "hsl(var(--chart-2))", // green
		down: "hsl(var(--destructive))", // red
		neutral: "hsl(var(--muted-foreground))",
	};

	return <Sparkline data={data} color={trendColors[computedTrend]} {...props} />;
}
