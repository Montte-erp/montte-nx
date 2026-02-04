import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useCallback } from "react";
import { useLinkCounterparty } from "@/features/inventory/hooks/use-link-counterparty";
import { useCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";

type LinkCounterpartyCredenzaProps = {
	itemId: string;
};

const currencies = [
	{ label: "Real Brasileiro (BRL)", value: "BRL" },
	{ label: "US Dollar (USD)", value: "USD" },
	{ label: "Euro (EUR)", value: "EUR" },
	{ label: "British Pound (GBP)", value: "GBP" },
];

export function LinkCounterpartyCredenza({
	itemId,
}: LinkCounterpartyCredenzaProps) {
	const trpc = useTRPC();
	const { closeCredenza } = useCredenza();
	const linkMutation = useLinkCounterparty();

	const { data: counterparties } = useQuery(
		trpc.counterparties.getAll.queryOptions(),
	);

	const form = useForm({
		defaultValues: {
			counterpartyId: "",
			role: "" as "supplier" | "client" | "",
			unitPrice: "",
			currency: "BRL",
			minOrderQuantity: "",
			leadTimeDays: 0,
			notes: "",
		},
		onSubmit: async ({ value, formApi }) => {
			if (!value.counterpartyId || !value.role || !value.currency) {
				return;
			}
			try {
				await linkMutation.mutateAsync({
					itemId,
					counterpartyId: value.counterpartyId,
					role: value.role as "supplier" | "client",
					unitPrice: value.unitPrice,
					currency: value.currency,
					minOrderQuantity: value.minOrderQuantity || undefined,
					leadTimeDays: value.leadTimeDays || undefined,
					notes: value.notes || undefined,
				});
				formApi.reset();
				closeCredenza();
			} catch (error) {
				console.error("Failed to link counterparty:", error);
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

	const counterpartyOptions = (counterparties || []).map((cp) => ({
		label: cp.name,
		value: cp.id,
	}));

	const currencyOptions = currencies.map((c) => ({
		label: c.label,
		value: c.value,
	}));

	return (
		<form className="p-6 space-y-6" onSubmit={handleSubmit}>
			<CredenzaHeader>
				<CredenzaTitle>Vincular Fornecedor/Cliente</CredenzaTitle>
				<CredenzaDescription>
					Vincule um fornecedor ou cliente a este item de inventário.
				</CredenzaDescription>
			</CredenzaHeader>

			<div className="grid gap-4">
				<FieldGroup>
					<form.Field name="counterpartyId">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Fornecedor/Cliente
									</FieldLabel>
									<Combobox
										emptyMessage="Nenhum fornecedor/cliente encontrado"
										onValueChange={field.handleChange}
										options={counterpartyOptions}
										placeholder="Selecione o fornecedor/cliente"
										searchPlaceholder="Pesquisar"
										value={field.state.value}
									/>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="role">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Papel</FieldLabel>
									<Select
										onValueChange={(value) =>
											field.handleChange(value as "" | "supplier" | "client")
										}
										value={field.state.value}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione o papel" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="supplier">Fornecedor</SelectItem>
											<SelectItem value="client">Cliente</SelectItem>
										</SelectContent>
									</Select>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="unitPrice">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>Preço Unitário</FieldLabel>
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
					<form.Field name="minOrderQuantity">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Quantidade Mínima de Pedido
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
									<FieldDescription>Opcional</FieldDescription>
									{isInvalid && <FieldError errors={field.state.meta.errors} />}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>

				<FieldGroup>
					<form.Field name="leadTimeDays">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel htmlFor={field.name}>
										Prazo de Entrega (dias)
									</FieldLabel>
									<Input
										aria-invalid={isInvalid}
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(Number.parseInt(e.target.value) || 0)
										}
										placeholder="Ex: 7"
										type="number"
										value={field.state.value}
									/>
									<FieldDescription>Opcional</FieldDescription>
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

			<form.Subscribe>
				{(state) => (
					<Button
						className="w-full"
						disabled={
							!state.canSubmit ||
							state.isSubmitting ||
							linkMutation.isPending
						}
						type="submit"
					>
						Vincular Fornecedor/Cliente
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
