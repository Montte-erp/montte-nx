import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@packages/ui/components/sheet";
import { Spinner } from "@packages/ui/components/spinner";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface TagSheetProps {
	mode: "create" | "edit";
	tag?: {
		id: string;
		name: string;
		color: string;
	};
	onSuccess: () => void;
}

export function TagSheet({ mode, tag, onSuccess }: TagSheetProps) {
	const [name, setName] = useState(tag?.name ?? "");
	const [color, setColor] = useState(tag?.color ?? "#6366f1");
	const [colorHex, setColorHex] = useState(tag?.color ?? "#6366f1");

	const createMutation = useMutation(
		orpc.tags.create.mutationOptions({
			onSuccess: () => {
				toast.success("Tag criada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao criar tag.");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.tags.update.mutationOptions({
			onSuccess: () => {
				toast.success("Tag atualizada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao atualizar tag.");
			},
		}),
	);

	const isPending = createMutation.isPending || updateMutation.isPending;
	const isValid = name.trim().length > 0;

	const handleColorPickerChange = useCallback((value: string) => {
		setColor(value);
		setColorHex(value);
	}, []);

	const handleColorHexChange = useCallback((value: string) => {
		setColorHex(value);
		if (/^#[0-9a-fA-F]{6}$/.test(value)) {
			setColor(value);
		}
	}, []);

	const handleSubmit = useCallback(() => {
		if (!isValid) return;

		if (mode === "create") {
			createMutation.mutate({
				name: name.trim(),
				color,
			});
		} else if (tag) {
			updateMutation.mutate({
				id: tag.id,
				name: name.trim(),
				color,
			});
		}
	}, [isValid, mode, name, color, tag, createMutation, updateMutation]);

	const isCreate = mode === "create";

	return (
		<div className="flex h-full flex-col">
			<SheetHeader>
				<SheetTitle>{isCreate ? "Nova Tag" : "Editar Tag"}</SheetTitle>
				<SheetDescription>
					{isCreate
						? "Adicione uma nova tag para categorizar suas transações."
						: "Atualize as informações da tag."}
				</SheetDescription>
			</SheetHeader>

			<div className="flex-1 overflow-y-auto space-y-6 py-6">
				{/* Nome */}
				<div className="space-y-2 px-1">
					<Label htmlFor="tag-name">Nome</Label>
					<Input
						id="tag-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex: Alimentação, Transporte"
						value={name}
					/>
				</div>

				{/* Cor */}
				<div className="space-y-2 px-1">
					<Label htmlFor="tag-color-hex">Cor</Label>
					<div className="flex items-center gap-2">
						<input
							className="size-10 rounded-md border cursor-pointer p-0.5"
							id="tag-color"
							onChange={(e) => handleColorPickerChange(e.target.value)}
							type="color"
							value={color}
						/>
						<Input
							className="flex-1 font-mono"
							id="tag-color-hex"
							maxLength={7}
							onChange={(e) => handleColorHexChange(e.target.value)}
							placeholder="#6366f1"
							value={colorHex}
						/>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="border-t pt-4 pb-2">
				<Button
					className="w-full"
					disabled={!isValid || isPending}
					onClick={handleSubmit}
				>
					{isPending ? <Spinner className="size-4 mr-2" /> : null}
					{isCreate ? "Criar tag" : "Salvar alterações"}
				</Button>
			</div>
		</div>
	);
}
