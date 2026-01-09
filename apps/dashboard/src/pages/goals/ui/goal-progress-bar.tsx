"use client";

import { cn } from "@packages/ui/lib/utils";

type GoalProgressBarProps = {
	currentAmount: number;
	targetAmount: number;
	className?: string;
	showPercentage?: boolean;
	size?: "sm" | "md" | "lg";
};

export function GoalProgressBar({
	currentAmount,
	targetAmount,
	className,
	showPercentage = true,
	size = "md",
}: GoalProgressBarProps) {
	const percentage = targetAmount > 0
		? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
		: 0;

	const getProgressColor = () => {
		if (percentage >= 100) return "bg-green-500";
		if (percentage >= 75) return "bg-green-400";
		if (percentage >= 50) return "bg-yellow-400";
		if (percentage >= 25) return "bg-orange-400";
		return "bg-red-400";
	};

	const heightClass = {
		sm: "h-1.5",
		md: "h-2.5",
		lg: "h-4",
	}[size];

	return (
		<div className={cn("w-full", className)}>
			<div className={cn("w-full bg-muted rounded-full overflow-hidden", heightClass)}>
				<div
					className={cn(
						"h-full rounded-full transition-all duration-500",
						getProgressColor(),
					)}
					style={{ width: `${percentage}%` }}
				/>
			</div>
			{showPercentage && (
				<div className="flex justify-between mt-1 text-xs text-muted-foreground">
					<span>{percentage}% concluido</span>
					{percentage >= 100 && (
						<span className="text-green-500 font-medium">Meta atingida!</span>
					)}
				</div>
			)}
		</div>
	);
}
