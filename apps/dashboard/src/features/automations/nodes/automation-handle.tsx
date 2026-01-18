import { cn } from "@packages/ui/lib/utils";
import { Handle, type HandleProps } from "@xyflow/react";

type AutomationHandleProps = HandleProps & {
	className?: string;
};

export function AutomationHandle({
	className,
	type,
	position,
	...props
}: AutomationHandleProps) {
	return (
		<Handle
			{...props}
			className={cn(
				"!size-3 rounded-full border-2 transition-all duration-200",
				"hover:!size-4 hover:!border-primary hover:!bg-primary/20",
				"dark:border-secondary dark:bg-secondary",
				"border-slate-300 bg-slate-100",
				className,
			)}
			position={position}
			type={type}
		/>
	);
}
