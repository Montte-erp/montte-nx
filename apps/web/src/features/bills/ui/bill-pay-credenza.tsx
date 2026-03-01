import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@packages/ui/components/field";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { BillRow } from "./bills-columns";

interface BillPayCredenzaProps {
	bill: BillRow;
	onSuccess: () => void;
}

function BillPayCredenzaInner({ bill, onSuccess }: BillPayCredenzaProps) {
	const { data: accounts } = useSuspenseQuery(
		orpc.bankAccounts.getAll.queryOptions({}),
	);

	const payMutation = useMutation(
		orpc.bills.pay.mutationOptions({
			onSuccess: () => {
				toast.success(
					bill.type === "payable"
						? "Conta paga com sucesso!"
						: "Recebimento registrado!",
				);
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao registrar pagamento.");
			},
		}),
	);

	const today = new Date().toISOString().substring(0, 10);
	const defaultBankAccountId = bill.bankAccount?.id ?? "";

	const form = useForm({
		defaultValues: {
			amount: bill.amount,
			date: today,
			bankAccountId: defaultBankAccountId,
		},
		onSubmit: async ({ value }) => {
			await payMutation.mutateAsync({
				id: bill.id,
				amount: value.amount,
				date: value.date,
				bankAccountId: value.bankAccountId || undefined,
			});
		},
	});

	const title =
		bill.type === "payable" ? "Registrar Pagamento" : "Registrar Recebimento";

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle>{title}</CredenzaTitle>
				<CredenzaDescription>{bill.name}</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody>
				<form
					id="bill-pay-form"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="amount">
							{(field) => (
								<Field>
									<FieldLabel>Valor</FieldLabel>
									<MoneyInput
										onChange={(v) =>
											field.handleChange(v !== undefined ? String(v / 100) : "")
										}
										value={
											field.state.value
												? Math.round(Number(field.state.value) * 100)
												: 0
										}
										valueInCents={true}
									/>
									<FieldError errors={field.state.meta.errors} />
								</Field>
							)}
						</form.Field>
						<form.Field name="date">
							{(field) => (
								<Field>
									<FieldLabel>Data do Pagamento</FieldLabel>
									<DatePicker
										date={
											field.state.value
												? new Date(`${field.state.value}T00:00:00`)
												: undefined
										}
										onSelect={(d) =>
											field.handleChange(
												d?.toISOString().substring(0, 10) ?? today,
											)
										}
									/>
								</Field>
							)}
						</form.Field>
						{accounts.length > 0 && (
							<form.Field name="bankAccountId">
								{(field) => (
									<Field>
										<FieldLabel>Conta Bancária</FieldLabel>
										<Select
											onValueChange={field.handleChange}
											value={field.state.value}
										>
											<SelectTrigger>
												<SelectValue placeholder="Selecione uma conta" />
											</SelectTrigger>
											<SelectContent>
												{accounts.map((acc) => (
													<SelectItem key={acc.id} value={acc.id}>
														{acc.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								)}
							</form.Field>
						)}
					</FieldGroup>
				</form>
			</CredenzaBody>
			<CredenzaFooter>
				<form.Subscribe>
					{(state) => (
						<Button
							disabled={!state.canSubmit || payMutation.isPending}
							form="bill-pay-form"
							type="submit"
						>
							{payMutation.isPending && <Spinner className="size-4 mr-2" />}
							Confirmar
						</Button>
					)}
				</form.Subscribe>
			</CredenzaFooter>
		</>
	);
}

export function BillPayCredenza(props: BillPayCredenzaProps) {
	return (
		<Suspense fallback={null}>
			<BillPayCredenzaInner {...props} />
		</Suspense>
	);
}
