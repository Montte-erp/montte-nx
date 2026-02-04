import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import {
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@packages/ui/components/sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useCallback, useMemo } from "react";
import { useCreateItem } from "@/features/inventory/hooks/use-create-item";
import { useUpdateItem } from "@/features/inventory/hooks/use-update-item";
import { useSheet } from "@/hooks/use-sheet";

type ItemFormSheetProps = {
	itemId?: string;
	item?: {
		id: string;
		name: string;
		sku?: string | null;
		type: "product" | "material" | "asset";
		description?: string | null;
		baseUnit: string;
		baseUnitScale: number;
		valuationMethod: "fifo" | "weighted_average";
		currency: string;
		reorderPoint?: string | null;
		defaultCounterpartyId?: string | null;
	};
};

const currencies = [
	{ label: "Real Brasileiro (BRL)", value: "BRL" },
	{ label: "US Dollar (USD)", value: "USD" },
	{ label: "Euro (EUR)", value: "EUR" },
	{ label: "British Pound (GBP)", value: "GBP" },
];

export function ItemFormSheet({ itemId, item }: ItemFormSheetProps) {
	const { closeSheet } = useSheet();
	const isEditMode = !!itemId;

	const createMutation = useCreateItem();
	const updateMutation = useUpdateItem();

	const modeTexts = useMemo(() => {
		const createTexts = {
			description: "Crie um novo item de inventário para rastrear estoque.",
			title: "Criar Item de Inventário",
		};

		const editTexts = {
			description: "Edite os detalhes do item de inventário.",
			title: "Editar Item de Inventário",
		};

		return isEditMode ? editTexts : createTexts;
	}, [isEditMode]);

	const form = useForm({
		defaultValues: {
			name: item?.name || "",
			sku: item?.sku || "",
			type: (item?.type || "") as "product" | "material" | "asset" | "",
			description: item?.description || "",
			baseUnit: item?.baseUnit || "",
			baseUnitScale: item?.baseUnitScale || 0,
			valuationMethod: item?.valuationMethod || "fifo",
			currency: item?.currency || "BRL",
			reorderPoint: item?.reorderPoint || "",
			defaultCounterpartyId: item?.defaultCounterpartyId || "",
		},
		onSubmit: async ({ value, formApi }) => {
			if (!value.type || !value.currency) {
				return;
			}
			try {
				if (isEditMode && itemId) {
					await updateMutation.mutateAsync({
						id: itemId,
						name: value.name,
						sku: value.sku || undefined,
						type: value.type as "product" | "material" | "asset",
						description: value.description || undefined,
						baseUnit: value.baseUnit,
						baseUnitScale: value.baseUnitScale,
						valuationMethod: value.valuationMethod,
						currency: value.currency,
						reorderPoint: value.reorderPoint || undefined,
						defaultCounterpartyId: value.defaultCounterpartyId || undefined,
					});
				} else {
					await createMutation.mutateAsync({
						name: value.name,
						sku: value.sku || undefined,
						type: value.type as "product" | "material" | "asset",
						description: value.description || undefined,
						baseUnit: value.baseUnit,
						baseUnitScale: value.baseUnitScale,
						valuationMethod: value.valuationMethod,
						currency: value.currency,
						reorderPoint: value.reorderPoint || undefined,
						defaultCounterpartyId: value.defaultCounterpartyId || undefined,
					});
				}
				formApi.reset();
				closeSheet();
			} catch (error) {
				console.error(
					`Failed to ${isEditMode ? "update" : "create"} inventory item:`,
					error,
				);
			}
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

	const currencyOptions = currencies.map((c) => ({
		label: c.label,
		value: c.value,
	}));

	return (
		<form className="h-full flex flex-col" onSubmit={handleSubmit}>
			<SheetHeader>
				<SheetTitle>{modeTexts.title}</SheetTitle>
				<SheetDescription>{modeTexts.description}</SheetDescription>
			</SheetHeader>

			<div className="grid gap-4 px-4 overflow-y-auto">
				<FieldGroup>
					<form.Field name="name">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Nome</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: Notebook Dell XPS 15"
										value={field.state.value}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="sku">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>SKU</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: NB-DELL-XPS15-001"
										value={field.state.value}
									/>
									<FieldDescription>
										Código único para identificar o item (opcional)
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="type">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(
												value as "" | "product" | "material" | "asset",
											)
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o tipo" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="product">Produto</SelectItem>
											<SelectItem value="material">Material</SelectItem>
											<SelectItem value="asset">Ativo</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="description">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
									<Textarea
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Descreva o item (opcional)"
										rows={3}
										value={field.state.value}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="baseUnit">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Unidade Base de Medida
									</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: unidade, kg, litro"
										value={field.state.value}
									/>
									<FieldDescription>
										Unidade padrão para medir o estoque deste item
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="baseUnitScale">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Escala da Unidade Base
									</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(Number.parseInt(e.target.value) || 0)
										}
										placeholder="0"
										type="number"
										value={field.state.value}
									/>
									<FieldDescription>
										Escala para precisão decimal (padrão: 0)
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="valuationMethod">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Método de Avaliação
									</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as "fifo" | "weighted_average")
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o método" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="fifo">FIFO (Primeiro a Entrar, Primeiro a Sair)</SelectItem>
											<SelectItem value="weighted_average">
												Média Ponderada
											</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="currency">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Moeda</FieldLabel>
									<Combobox
										emptyMessage="Nenhuma moeda encontrada"
										onValueChange={field.handleChange}
										options={currencyOptions}
										placeholder="Selecione a moeda"
										searchPlaceholder="Pesquisar moeda"
										value={field.state.value}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="reorderPoint">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Ponto de Reabastecimento
									</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: 10"
										value={field.state.value}
									/>
									<FieldDescription>
										Nível mínimo de estoque antes de reabastecer (opcional)
									</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
			</div>

			<SheetFooter>
				<form.Subscribe>
					{(state) => (
						<Button
							className="w-full"
							disabled={
								!state.canSubmit ||
								state.isSubmitting ||
								createMutation.isPending ||
								updateMutation.isPending
							}
							type="submit"
						>
							{modeTexts.title}
						</Button>
					)}
				</form.Subscribe>
			</SheetFooter>
		</form>
	);
}
