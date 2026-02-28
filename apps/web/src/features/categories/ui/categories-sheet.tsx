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
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface CategorySheetProps {
	mode: "create" | "edit";
	category?: { id: string; name: string };
	onSuccess: () => void;
}

export function CategorySheet({
	mode,
	category,
	onSuccess,
}: CategorySheetProps) {
	const [name, setName] = useState(category?.name ?? "");

	const createMutation = useMutation(
		orpc.categories.create.mutationOptions({
			onSuccess: () => {
				toast.success("Categoria criada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao criar categoria.");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.categories.update.mutationOptions({
			onSuccess: () => {
				toast.success("Categoria atualizada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao atualizar categoria.");
			},
		}),
	);

	const isPending = createMutation.isPending || updateMutation.isPending;
	const isValid = name.trim().length > 0;
	const isCreate = mode === "create";

	function handleSubmit() {
		if (!isValid) return;

		if (mode === "create") {
			createMutation.mutate({ name: name.trim() });
		} else if (category) {
			updateMutation.mutate({ id: category.id, name: name.trim() });
		}
	}

	return (
		<div className="flex h-full flex-col">
			<SheetHeader>
				<SheetTitle>
					{isCreate ? "Nova Categoria" : "Editar Categoria"}
				</SheetTitle>
				<SheetDescription>
					{isCreate
						? "Adicione uma nova categoria para organizar suas transações."
						: "Atualize o nome da categoria."}
				</SheetDescription>
			</SheetHeader>

			<div className="flex-1 overflow-y-auto space-y-6 py-6">
				<div className="space-y-2 px-1">
					<Label htmlFor="category-name">Nome</Label>
					<Input
						id="category-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex: Alimentação, Transporte"
						value={name}
					/>
				</div>
			</div>

			<div className="border-t pt-4 pb-2">
				<Button
					className="w-full"
					disabled={!isValid || isPending}
					onClick={handleSubmit}
				>
					{isPending ? <Spinner className="size-4 mr-2" /> : null}
					{isCreate ? "Criar categoria" : "Salvar alterações"}
				</Button>
			</div>
		</div>
	);
}
