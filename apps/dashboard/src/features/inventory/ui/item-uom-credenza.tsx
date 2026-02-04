import { Button } from "@packages/ui/components/button";
import {
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@packages/ui/components/table";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type FormEvent, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useTRPC } from "@/integrations/clients";

type ItemUomCredenzaProps = {
	itemId: string;
};

export function ItemUomCredenza({ itemId }: ItemUomCredenzaProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: item } = useQuery(
		trpc.inventory.getItem.queryOptions({ id: itemId }),
	);

	const addUomMutation = useMutation(
		trpc.inventory.addUom.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getItem.queryKey(),
				});
				toast.success("Unidade de medida adicionada com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao adicionar unidade de medida";
				toast.error(errorMessage);
			},
		}),
	);

	const removeUomMutation = useMutation(
		trpc.inventory.removeUom.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getItem.queryKey(),
				});
				toast.success("Unidade de medida removida com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao remover unidade de medida";
				toast.error(errorMessage);
			},
		}),
	);

	const schema = z.object({
		unit: z.string().min(1, "Este campo é obrigatório."),
		conversionFactor: z.string().min(1, "Este campo é obrigatório."),
	});

	const form = useForm({
		defaultValues: {
			unit: "",
			conversionFactor: "",
		},
		onSubmit: async ({ value, formApi }) => {
			try {
				await addUomMutation.mutateAsync({
					inventoryItemId: itemId,
					unit: value.unit,
					conversionFactor: value.conversionFactor,
				});
				formApi.reset();
			} catch (error) {
				console.error("Failed to add UoM:", error);
			}
		},
		validators: {
			onBlur: schema,
		},
	});

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			e.stopPropagation();
			form.handleSubmit();
		},
		[form],
	);

	const handleRemoveUom = useCallback(
		async (uomId: string) => {
			try {
				await removeUomMutation.mutateAsync({ id: uomId });
			} catch (error) {
				console.error("Failed to remove UoM:", error);
			}
		},
		[removeUomMutation],
	);

	return (
		<div className="p-6 space-y-6">
			<CredenzaHeader>
				<CredenzaTitle>Unidades de Medida</CredenzaTitle>
				<CredenzaDescription>
					Gerencie as unidades de medida alternativas para este item.
				</CredenzaDescription>
			</CredenzaHeader>

			<div className="space-y-4">
				<div>
					<h3 className="text-sm font-medium mb-2">Unidades Cadastradas</h3>
					{item?.inventoryItemUoms && item.inventoryItemUoms.length > 0 ? (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Unidade</TableHead>
									<TableHead>Fator de Conversão</TableHead>
									<TableHead className="w-[100px]">Ações</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{item.inventoryItemUoms.map((uom: { id: string; unit: string; conversionFactor: string }) => (
									<TableRow key={uom.id}>
										<TableCell>{uom.unit}</TableCell>
										<TableCell>{uom.conversionFactor}</TableCell>
										<TableCell>
											<Button
												onClick={() => handleRemoveUom(uom.id)}
												size="icon"
												variant="ghost"
											>
												<Trash2 className="size-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					) : (
						<p className="text-sm text-muted-foreground">
							Nenhuma unidade de medida alternativa cadastrada.
						</p>
					)}
				</div>

				<form onSubmit={handleSubmit}>
					<h3 className="text-sm font-medium mb-3">
						Adicionar Nova Unidade de Medida
					</h3>
					<div className="grid gap-3">
						<FieldGroup>
							<form.Field name="unit">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>Unidade</FieldLabel>
											<Input
												aria-invalid={isInvalid}
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Ex: caixa, pacote"
												value={field.state.value}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</form.Field>
						</FieldGroup>

						<FieldGroup>
							<form.Field name="conversionFactor">
								{(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												Fator de Conversão
											</FieldLabel>
											<Input
												aria-invalid={isInvalid}
												id={field.name}
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												placeholder="Ex: 12 (1 caixa = 12 unidades)"
												value={field.state.value}
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							</form.Field>
						</FieldGroup>

						<form.Subscribe>
							{(state) => (
								<Button
									className="w-full"
									disabled={
										!state.canSubmit ||
										state.isSubmitting ||
										addUomMutation.isPending
									}
									type="submit"
								>
									Adicionar Unidade
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</div>
		</div>
	);
}
