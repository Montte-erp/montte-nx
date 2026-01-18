import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine } from "lucide-react";

type DataFlowBadgeProps = {
	type: "input" | "output" | "both" | "optional";
	label?: string;
	className?: string;
};

const BADGE_STYLES = {
	input: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
	output:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
	both: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
	optional:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
} as const;

const BADGE_ICONS = {
	input: ArrowDownToLine,
	output: ArrowUpFromLine,
	both: ArrowLeftRight,
	optional: ArrowDownToLine,
} as const;

const BADGE_LABELS = {
	input: "Entrada",
	output: "Saída",
	both: "Entrada/Saída",
	optional: "Entrada Opcional",
} as const;

export function DataFlowBadge({ type, label, className }: DataFlowBadgeProps) {
	const Icon = BADGE_ICONS[type];
	const tooltipLabel = label ?? BADGE_LABELS[type];

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<div
					className={cn(
						"flex size-5 items-center justify-center rounded-full cursor-help",
						BADGE_STYLES[type],
						className,
					)}
				>
					<Icon className="size-3" />
				</div>
			</TooltipTrigger>
			<TooltipContent className="text-xs" side="bottom">
				{tooltipLabel}
			</TooltipContent>
		</Tooltip>
	);
}

type DataFlowIndicatorProps = {
	produces?: string;
	producesLabel?: string;
	requires?: string;
	requiresLabel?: string;
	optionalInputs?: string[];
	optionalInputsLabel?: string;
};

export function DataFlowIndicator({
	produces,
	producesLabel,
	requires,
	requiresLabel,
	optionalInputs,
	optionalInputsLabel,
}: DataFlowIndicatorProps) {
	const hasInput = !!requires;
	const hasOutput = !!produces;
	const hasOptional = optionalInputs && optionalInputs.length > 0;

	if (!hasInput && !hasOutput && !hasOptional) {
		return null;
	}

	return (
		<div className="flex flex-wrap gap-1 mt-1.5">
			{hasInput && (
				<DataFlowBadge label={requiresLabel ?? requires} type="input" />
			)}
			{hasOptional && (
				<DataFlowBadge
					label={optionalInputsLabel ?? "Entrada Opcional"}
					type="optional"
				/>
			)}
			{hasOutput && (
				<DataFlowBadge label={producesLabel ?? produces} type="output" />
			)}
		</div>
	);
}
