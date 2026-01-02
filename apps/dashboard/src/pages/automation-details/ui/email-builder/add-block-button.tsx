import { Button } from "@packages/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@packages/ui/components/popover";
import type { EmailBlock } from "@packages/transactional/schemas/email-builder.schema";
import {
	Heading1,
	Image,
	Link,
	Minus,
	MoveVertical,
	Plus,
	Table,
	Type,
} from "lucide-react";

type AddBlockButtonProps = {
	onAddBlock: (block: EmailBlock) => void;
};

const BLOCK_OPTIONS: {
	type: EmailBlock["type"];
	label: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	createBlock: () => EmailBlock;
}[] = [
	{
		type: "heading",
		label: "Título",
		description: "H1, H2 ou H3",
		icon: Heading1,
		createBlock: () => ({
			type: "heading",
			level: 1,
			text: "Novo Título",
			align: "left",
		}),
	},
	{
		type: "text",
		label: "Texto",
		description: "Parágrafo",
		icon: Type,
		createBlock: () => ({
			type: "text",
			content: "",
			align: "left",
		}),
	},
	{
		type: "button",
		label: "Botão",
		description: "Link clicável",
		icon: Link,
		createBlock: () => ({
			type: "button",
			text: "Clique aqui",
			url: "",
			align: "center",
			variant: "primary",
		}),
	},
	{
		type: "image",
		label: "Imagem",
		description: "URL externa",
		icon: Image,
		createBlock: () => ({
			type: "image",
			src: "",
			alt: "",
			align: "center",
		}),
	},
	{
		type: "divider",
		label: "Divisor",
		description: "Linha horizontal",
		icon: Minus,
		createBlock: () => ({
			type: "divider",
		}),
	},
	{
		type: "spacer",
		label: "Espaço",
		description: "Espaçamento vertical",
		icon: MoveVertical,
		createBlock: () => ({
			type: "spacer",
			height: 24,
		}),
	},
	{
		type: "table",
		label: "Tabela",
		description: "Dados de contas",
		icon: Table,
		createBlock: () => ({
			type: "table",
			dataSource: "bills_data",
		}),
	},
];

export function AddBlockButton({ onAddBlock }: AddBlockButtonProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" className="gap-2">
					<Plus className="size-4" />
					Adicionar Bloco
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-2" align="center">
				<div className="grid gap-1">
					{BLOCK_OPTIONS.map((option) => {
						const Icon = option.icon;
						return (
							<Button
								key={option.type}
								variant="ghost"
								className="justify-start gap-3 h-auto py-2"
								onClick={() => onAddBlock(option.createBlock())}
							>
								<div className="flex size-8 items-center justify-center rounded-md bg-muted">
									<Icon className="size-4" />
								</div>
								<div className="flex flex-col items-start">
									<span className="text-sm font-medium">{option.label}</span>
									<span className="text-xs text-muted-foreground">
										{option.description}
									</span>
								</div>
							</Button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
