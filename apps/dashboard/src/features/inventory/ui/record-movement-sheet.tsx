import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
	Field,
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
import { type FormEvent, useCallback } from "react";
import { useRecordMovement } from "@/features/inventory/hooks/use-record-movement";
import { useSheet } from "@/hooks/use-sheet";

type RecordMovementSheetProps = {
	itemId: string;
};

const currencies = [
	{ label: "Real Brasileiro (BRL)", value: "BRL" },
	{ label: "US Dollar (USD)", value: "USD" },
	{ label: "Euro (EUR)", value: "EUR" },
	{ label: "British Pound (GBP)", value: "GBP" },
];

export function RecordMovementSheet({ itemId }: RecordMovementSheetProps) {
	const { closeSheet } = useSheet();
	const recordMovementMutation = useRecordMovement();

	const form = useForm({
		defaultValues: {
			type: "" as "in" | "out" | "adjustment" | "",
			reason: "" as
				| "purchase"
				| "sale"
				| "return"
				| "damage"
				| "correction"
				| "production"
				| "",
			quantity: "",
			unitCost: "",
			currency: "BRL",
			counterpartyId: "",
			transactionId: "",
			date: new Date(),
			notes: "",
		},
		onSubmit: async ({ value, formApi }) => {
			if (!value.type || !value.reason || !value.currency) {
				return;
			}
			try {
				await recordMovementMutation.mutateAsync({
					itemId,
					type: value.type as "in" | "out" | "adjustment",
					reason: value.reason as
						| "purchase"
						| "sale"
						| "return"
						| "damage"
						| "correction"
						| "production",
					quantity: value.quantity,
					unitCost: value.unitCost,
					currency: value.currency,
					date: value.date,
					notes: value.notes || undefined,
					counterpartyId: value.counterpartyId || undefined,
					transactionId: value.transactionId || undefined,
				});
				formApi.reset();
				closeSheet();
			} catch (error) {
				console.error("Failed to record stock movement:", error);
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
				<SheetTitle>Registrar Movimentação de Estoque</SheetTitle>
				<SheetDescription>
					Registre entrada, saída ou ajuste de estoque para este item.
				</SheetDescription>
			</SheetHeader>

			<div className="grid gap-4 px-4 overflow-y-auto">
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
											field.handleChange(value as "" | "in" | "out" | "adjustment")
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o tipo" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="in">Entrada</SelectItem>
											<SelectItem value="out">Saída</SelectItem>
											<SelectItem value="adjustment">Ajuste</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="reason">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Motivo</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(
												value as
													| ""
													| "purchase"
													| "sale"
													| "return"
													| "damage"
													| "correction"
													| "production",
											)
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o motivo" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="purchase">Compra</SelectItem>
											<SelectItem value="sale">Venda</SelectItem>
											<SelectItem value="return">Devolução</SelectItem>
											<SelectItem value="damage">Dano</SelectItem>
											<SelectItem value="correction">Correção</SelectItem>
											<SelectItem value="production">Produção</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="quantity">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Quantidade</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: 10"
										value={field.state.value}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="unitCost">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Custo Unitário</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: 100.00"
										value={field.state.value}
									/>
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
					<form.Field name="date">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Data</FieldLabel>
									<DatePicker
										date={field.state.value}
										onSelect={(date) => field.handleChange(date || new Date())}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="notes">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Observações</FieldLabel>
									<Textarea
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Observações adicionais (opcional)"
										rows={3}
										value={field.state.value}
									/>
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
								recordMovementMutation.isPending
							}
							type="submit"
						>
							Registrar Movimentação
						</Button>
					)}
				</form.Subscribe>
			</SheetFooter>
		</form>
	);
}
