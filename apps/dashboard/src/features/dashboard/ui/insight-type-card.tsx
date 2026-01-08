import { cn } from "@packages/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface InsightTypeCardProps {
	icon: LucideIcon;
	title: string;
	description: string;
	onClick: () => void;
	isSelected?: boolean;
}

export function InsightTypeCard({
	icon: Icon,
	title,
	description,
	onClick,
	isSelected,
}: InsightTypeCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-all text-left",
				"hover:border-primary/50 hover:bg-accent/50",
				isSelected
					? "border-primary bg-primary/5"
					: "border-border bg-card",
			)}
		>
			<div className="flex items-center gap-2">
				<Icon className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm font-medium">{title}</span>
			</div>
			<p className="text-xs text-muted-foreground line-clamp-2">
				{description}
			</p>
		</button>
	);
}
