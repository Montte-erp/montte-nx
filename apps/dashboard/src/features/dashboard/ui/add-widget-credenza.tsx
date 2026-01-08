import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { BarChart3, FileText, Plus } from "lucide-react";
import { cn } from "@packages/ui/lib/utils";

type AddWidgetCredenzaProps = {
	onAddTextCard: () => void;
	onAddInsight: () => void;
};

export function AddWidgetCredenza({
	onAddTextCard,
	onAddInsight,
}: AddWidgetCredenzaProps) {
	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<Plus className="h-5 w-5" />
					Add to dashboard
				</CredenzaTitle>
				<CredenzaDescription>
					Choose the type of widget you want to add
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="pb-6">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<OptionCard
						icon={FileText}
						title="Text card"
						description="Add markdown text, notes, or documentation"
						onClick={onAddTextCard}
						color="blue"
					/>
					<OptionCard
						icon={BarChart3}
						title="Insight"
						description="Add charts and visualizations from your data"
						onClick={onAddInsight}
						color="purple"
					/>
				</div>
			</CredenzaBody>
		</>
	);
}

type OptionCardProps = {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	onClick: () => void;
	color: "blue" | "purple";
};

const colorClasses = {
	blue: {
		hover: "hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-950/30 dark:hover:border-blue-800",
		icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
	},
	purple: {
		hover: "hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/30 dark:hover:border-purple-800",
		icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
	},
};

function OptionCard({ icon: Icon, title, description, onClick, color }: OptionCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-border",
				"bg-card transition-all duration-200 ease-out",
				"hover:shadow-lg hover:scale-[1.02]",
				colorClasses[color].hover,
				"text-center cursor-pointer",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			)}
		>
			<div className={cn(
				"rounded-xl p-4 transition-all duration-200",
				"group-hover:scale-110",
				colorClasses[color].icon
			)}>
				<Icon className="h-8 w-8" />
			</div>
			<div className="space-y-1.5">
				<div className="font-semibold text-base">{title}</div>
				<div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
			</div>
		</button>
	);
}
