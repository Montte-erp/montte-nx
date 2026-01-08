import { cn } from "@packages/ui/lib/utils";
import type { LucideIcon } from "lucide-react";

interface CreateNewCardProps {
	icon: LucideIcon;
	title: string;
	description: string;
	onClick: () => void;
	iconColor?: string;
	iconBg?: string;
}

export function CreateNewCard({
	icon: Icon,
	title,
	description,
	onClick,
	iconColor = "text-primary",
	iconBg = "bg-primary/10",
}: CreateNewCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex items-start gap-3 p-3 rounded-lg border text-left w-full",
				"hover:bg-accent hover:border-accent-foreground/20",
				"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			)}
		>
			<div className={cn("p-2 rounded-md shrink-0", iconBg)}>
				<Icon className={cn("size-4", iconColor)} />
			</div>
			<div className="flex-1 min-w-0">
				<p className="font-medium text-sm">{title}</p>
				<p className="text-xs text-muted-foreground truncate">{description}</p>
			</div>
		</button>
	);
}
