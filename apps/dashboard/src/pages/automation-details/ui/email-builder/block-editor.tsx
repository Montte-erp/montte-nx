import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Slider } from "@packages/ui/components/slider";
import { Textarea } from "@packages/ui/components/textarea";
import type { EmailBlock } from "@packages/transactional/schemas/email-builder.schema";
import {
	GripVertical,
	Heading1,
	Image,
	Link,
	Minus,
	MoveVertical,
	Table,
	Trash2,
	Type,
} from "lucide-react";
import { useRef } from "react";
import { VariableSelect } from "./variable-select";

type BlockEditorProps = {
	block: EmailBlock;
	onChange: (block: EmailBlock) => void;
	onDelete: () => void;
};

const BLOCK_LABELS: Record<EmailBlock["type"], { label: string; icon: React.ComponentType<{ className?: string }> }> = {
	heading: { label: "Título", icon: Heading1 },
	text: { label: "Texto", icon: Type },
	button: { label: "Botão", icon: Link },
	divider: { label: "Divisor", icon: Minus },
	image: { label: "Imagem", icon: Image },
	spacer: { label: "Espaço", icon: MoveVertical },
	table: { label: "Tabela", icon: Table },
};

export function BlockEditor({ block, onChange, onDelete }: BlockEditorProps) {
	const blockInfo = BLOCK_LABELS[block.type];
	const Icon = blockInfo.icon;

	return (
		<div className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-muted-foreground/20 overflow-hidden">
			<div className="shrink-0 mt-1 cursor-grab opacity-40 group-hover:opacity-70">
				<GripVertical className="size-4" />
			</div>

			<div className="shrink-0">
				<Badge variant="secondary" className="gap-1.5 font-normal">
					<Icon className="size-3" />
					{blockInfo.label}
				</Badge>
			</div>

			<div className="flex-1 min-w-0 space-y-3">
				{block.type === "heading" && (
					<HeadingBlockEditor block={block} onChange={onChange} />
				)}
				{block.type === "text" && (
					<TextBlockEditor block={block} onChange={onChange} />
				)}
				{block.type === "button" && (
					<ButtonBlockEditor block={block} onChange={onChange} />
				)}
				{block.type === "divider" && (
					<div className="text-xs text-muted-foreground py-1">
						Linha divisória horizontal
					</div>
				)}
				{block.type === "image" && (
					<ImageBlockEditor block={block} onChange={onChange} />
				)}
				{block.type === "spacer" && (
					<SpacerBlockEditor block={block} onChange={onChange} />
				)}
				{block.type === "table" && (
					<div className="text-xs text-muted-foreground py-1">
						Tabela de dados (preenchida automaticamente com dados de contas)
					</div>
				)}
			</div>

			<Button
				variant="ghost"
				size="icon"
				className="shrink-0 size-8 opacity-0 group-hover:opacity-100"
				onClick={onDelete}
			>
				<Trash2 className="size-4 text-destructive" />
			</Button>
		</div>
	);
}

// Individual block editors

function HeadingBlockEditor({
	block,
	onChange,
}: {
	block: Extract<EmailBlock, { type: "heading" }>;
	onChange: (block: EmailBlock) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);

	const insertVariable = (variable: string) => {
		if (inputRef.current) {
			const start = inputRef.current.selectionStart ?? block.text.length;
			const end = inputRef.current.selectionEnd ?? block.text.length;
			const newText = block.text.slice(0, start) + variable + block.text.slice(end);
			onChange({ ...block, text: newText });
		}
	};

	return (
		<div className="space-y-2">
			<Input
				ref={inputRef}
				value={block.text}
				onChange={(e) => onChange({ ...block, text: e.target.value })}
				placeholder="Texto do título"
				className="font-medium"
			/>
			<div className="flex flex-wrap gap-2 items-center">
				<Select
					value={String(block.level)}
					onValueChange={(v) =>
						onChange({ ...block, level: Number(v) as 1 | 2 | 3 })
					}
				>
					<SelectTrigger className="w-16">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="1">H1</SelectItem>
						<SelectItem value="2">H2</SelectItem>
						<SelectItem value="3">H3</SelectItem>
					</SelectContent>
				</Select>
				<AlignSelect
					value={block.align ?? "left"}
					onChange={(align) => onChange({ ...block, align })}
				/>
				<VariableSelect onSelect={insertVariable} />
			</div>
		</div>
	);
}

function TextBlockEditor({
	block,
	onChange,
}: {
	block: Extract<EmailBlock, { type: "text" }>;
	onChange: (block: EmailBlock) => void;
}) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const insertVariable = (variable: string) => {
		if (textareaRef.current) {
			const start = textareaRef.current.selectionStart ?? block.content.length;
			const end = textareaRef.current.selectionEnd ?? block.content.length;
			const newContent = block.content.slice(0, start) + variable + block.content.slice(end);
			onChange({ ...block, content: newContent });
		}
	};

	return (
		<div className="space-y-2">
			<Textarea
				ref={textareaRef}
				value={block.content}
				onChange={(e) => onChange({ ...block, content: e.target.value })}
				placeholder="Conteúdo do texto..."
				rows={2}
			/>
			<div className="flex justify-between items-center">
				<VariableSelect onSelect={insertVariable} />
				<AlignSelect
					value={block.align ?? "left"}
					onChange={(align) => onChange({ ...block, align })}
				/>
			</div>
		</div>
	);
}

function ButtonBlockEditor({
	block,
	onChange,
}: {
	block: Extract<EmailBlock, { type: "button" }>;
	onChange: (block: EmailBlock) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="grid grid-cols-2 gap-2">
				<div>
					<Label className="text-xs text-muted-foreground">Texto</Label>
					<Input
						value={block.text}
						onChange={(e) => onChange({ ...block, text: e.target.value })}
						placeholder="Texto do botão"
					/>
				</div>
				<div>
					<Label className="text-xs text-muted-foreground">URL</Label>
					<Input
						value={block.url}
						onChange={(e) => onChange({ ...block, url: e.target.value })}
						placeholder="https://..."
					/>
				</div>
			</div>
			<div className="flex gap-2">
				<Select
					value={block.variant ?? "primary"}
					onValueChange={(v) =>
						onChange({
							...block,
							variant: v as "primary" | "secondary" | "outline",
						})
					}
				>
					<SelectTrigger className="w-32">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="primary">Primário</SelectItem>
						<SelectItem value="secondary">Secundário</SelectItem>
						<SelectItem value="outline">Contorno</SelectItem>
					</SelectContent>
				</Select>
				<AlignSelect
					value={block.align ?? "center"}
					onChange={(align) => onChange({ ...block, align })}
				/>
			</div>
		</div>
	);
}

function ImageBlockEditor({
	block,
	onChange,
}: {
	block: Extract<EmailBlock, { type: "image" }>;
	onChange: (block: EmailBlock) => void;
}) {
	return (
		<div className="space-y-2">
			<div className="grid grid-cols-2 gap-2">
				<div>
					<Label className="text-xs text-muted-foreground">URL da Imagem</Label>
					<Input
						value={block.src}
						onChange={(e) => onChange({ ...block, src: e.target.value })}
						placeholder="https://..."
					/>
				</div>
				<div>
					<Label className="text-xs text-muted-foreground">Texto Alt</Label>
					<Input
						value={block.alt}
						onChange={(e) => onChange({ ...block, alt: e.target.value })}
						placeholder="Descrição da imagem"
					/>
				</div>
			</div>
			<div className="flex gap-2 items-center">
				<div className="flex-1">
					<Label className="text-xs text-muted-foreground">Largura (px)</Label>
					<Input
						type="number"
						value={block.width ?? ""}
						onChange={(e) =>
							onChange({
								...block,
								width: e.target.value ? Number(e.target.value) : undefined,
							})
						}
						placeholder="Auto"
					/>
				</div>
				<div className="pt-5">
					<AlignSelect
						value={block.align ?? "center"}
						onChange={(align) => onChange({ ...block, align })}
					/>
				</div>
			</div>
		</div>
	);
}

function SpacerBlockEditor({
	block,
	onChange,
}: {
	block: Extract<EmailBlock, { type: "spacer" }>;
	onChange: (block: EmailBlock) => void;
}) {
	return (
		<div className="flex items-center gap-4">
			<Label className="text-xs text-muted-foreground min-w-16">
				{block.height}px
			</Label>
			<Slider
				value={[block.height]}
				onValueChange={([value]) => onChange({ ...block, height: value ?? 24 })}
				min={8}
				max={100}
				step={4}
				className="flex-1"
			/>
		</div>
	);
}

function AlignSelect({
	value,
	onChange,
}: {
	value: "left" | "center" | "right";
	onChange: (value: "left" | "center" | "right") => void;
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-24">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="left">Esquerda</SelectItem>
				<SelectItem value="center">Centro</SelectItem>
				<SelectItem value="right">Direita</SelectItem>
			</SelectContent>
		</Select>
	);
}
