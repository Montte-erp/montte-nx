import { MoneyInput } from "@/components/money-input";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";

type TransactionType = "income" | "expense" | "transfer";

interface TransactionFormProps {
	mode: "create" | "edit";
	transaction?: TransactionRow;
	onSuccess: () => void;
}

interface TagCheckboxListProps {
	selectedTagIds: string[];
	onToggle: (tagId: string) => void;
}

function TagCheckboxList({ selectedTagIds, onToggle }: TagCheckboxListProps) {
	const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

	if (tags.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>
		);
	}

	return (
		<div className="space-y-2 max-h-36 overflow-y-auto pr-1">
			{tags.map((tag) => {
				const checked = selectedTagIds.includes(tag.id);
				return (
					<label
						key={tag.id}
						className="flex items-center gap-2 cursor-pointer select-none"
					>
						<Checkbox
							checked={checked}
							onCheckedChange={() => onToggle(tag.id)}
						/>
						{tag.color ? (
							<span
								className="size-2.5 rounded-full shrink-0"
								style={{ backgroundColor: tag.color }}
							/>
						) : null}
						<span className="text-sm">{tag.name}</span>
					</label>
				);
			})}
		</div>
	);
}

function TransactionFormContent({
	mode,
	transaction,
	onSuccess,
}: TransactionFormProps) {
	const isCreate = mode === "create";

	const { data: bankAccounts } = useSuspenseQuery(
		orpc.bankAccounts.getAll.queryOptions({}),
	);
	const { data: categories } = useSuspenseQuery(
		orpc.categories.getAll.queryOptions({}),
	);

	const [type, setType] = useState<TransactionType>(
		transaction?.type ?? "income",
	);
	const [name, setName] = useState<string>(
		(transaction as TransactionRow & { name?: string | null })?.name ?? "",
	);
	const [amount, setAmount] = useState(transaction?.amount ?? "");
	const [date, setDate] = useState<Date | undefined>(
		transaction?.date ? new Date(`${transaction.date}T12:00:00`) : undefined,
	);
	const [bankAccountId, setBankAccountId] = useState(
		transaction?.bankAccountId ?? "",
	);
	const [destinationBankAccountId, setDestinationBankAccountId] = useState(
		transaction?.destinationBankAccountId ?? "",
	);
	const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
	const [subcategoryId, setSubcategoryId] = useState(
		transaction?.subcategoryId ?? "",
	);
	const [tagIds, setTagIds] = useState<string[]>(transaction?.tagIds ?? []);
	const [description, setDescription] = useState(
		transaction?.description ?? "",
	);

	const selectedCategory = categories.find((c) => c.id === categoryId);
	const subcategoryOptions = selectedCategory?.subcategories ?? [];

	const handleCategoryChange = useCallback((value: string) => {
		setCategoryId(value);
		setSubcategoryId("");
	}, []);

	const handleTagToggle = useCallback((tagId: string) => {
		setTagIds((prev) =>
			prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
		);
	}, []);

	const createMutation = useMutation(
		orpc.transactions.create.mutationOptions({
			onSuccess: () => {
				toast.success("Transação criada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao criar transação.");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.transactions.update.mutationOptions({
			onSuccess: () => {
				toast.success("Transação atualizada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao atualizar transação.");
			},
		}),
	);

	const isPending = createMutation.isPending || updateMutation.isPending;
	const dateStr = date ? date.toISOString().split("T")[0] : "";

	const isValid =
		type.length > 0 &&
		amount.length > 0 &&
		Number(amount) > 0 &&
		dateStr.length > 0 &&
		bankAccountId.length > 0 &&
		(type !== "transfer" || destinationBankAccountId.length > 0);

	const handleSubmit = useCallback(() => {
		if (!isValid) return;

		const payload = {
			type,
			name: name.trim() || null,
			amount,
			date: dateStr,
			bankAccountId,
			destinationBankAccountId:
				type === "transfer" ? destinationBankAccountId : null,
			categoryId: categoryId || null,
			subcategoryId: subcategoryId || null,
			attachmentUrl: null as string | null,
			tagIds,
			description: description || null,
		};

		if (isCreate) {
			createMutation.mutate(payload);
		} else if (transaction) {
			updateMutation.mutate({ id: transaction.id, ...payload });
		}
	}, [isValid, isCreate, type, name, amount, dateStr, bankAccountId, destinationBankAccountId, categoryId, subcategoryId, tagIds, description, createMutation, updateMutation, transaction]);

	const accountLabel = type === "transfer" ? "Conta de Origem" : "Conta";

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle>
					{isCreate ? "Nova Transação" : "Editar Transação"}
				</CredenzaTitle>
				<CredenzaDescription>
					{isCreate
						? "Registre uma nova transação financeira."
						: "Atualize os dados da transação."}
				</CredenzaDescription>
			</CredenzaHeader>

			<CredenzaBody className="space-y-4">
				{/* Nome */}
				<div className="space-y-2">
					<Label htmlFor="transaction-name">Nome</Label>
					<Input
						id="transaction-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex: Almoço, Salário"
						value={name}
					/>
				</div>

				{/* Tipo */}
				<div className="space-y-2">
					<Label htmlFor="transaction-type">Tipo</Label>
					<Select
						onValueChange={(v) => setType(v as TransactionType)}
						value={type}
					>
						<SelectTrigger id="transaction-type">
							<SelectValue placeholder="Selecione o tipo" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="income">Receita</SelectItem>
							<SelectItem value="expense">Despesa</SelectItem>
							<SelectItem value="transfer">Transferência</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Valor */}
				<div className="space-y-2">
					<Label htmlFor="transaction-amount">Valor</Label>
					<MoneyInput
						disabled={isPending}
						id="transaction-amount"
						onChange={setAmount}
						value={amount}
					/>
				</div>

				{/* Data */}
				<div className="space-y-2">
					<Label>Data</Label>
					<DatePicker
						className="w-full"
						date={date}
						onSelect={setDate}
						placeholder="Selecione a data"
					/>
				</div>

				{/* Conta (Origem) */}
				<div className="space-y-2">
					<Label htmlFor="transaction-account">{accountLabel}</Label>
					<Select onValueChange={setBankAccountId} value={bankAccountId}>
						<SelectTrigger id="transaction-account">
							<SelectValue placeholder="Selecione a conta" />
						</SelectTrigger>
						<SelectContent>
							{bankAccounts.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Conta de Destino (transfer only) */}
				{type === "transfer" && (
					<div className="space-y-2">
						<Label htmlFor="transaction-dest-account">Conta de Destino</Label>
						<Select
							onValueChange={setDestinationBankAccountId}
							value={destinationBankAccountId}
						>
							<SelectTrigger id="transaction-dest-account">
								<SelectValue placeholder="Selecione a conta de destino" />
							</SelectTrigger>
							<SelectContent>
								{bankAccounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Categoria */}
				<div className="space-y-2">
					<Label htmlFor="transaction-category">Categoria</Label>
					<Select onValueChange={handleCategoryChange} value={categoryId}>
						<SelectTrigger id="transaction-category">
							<SelectValue placeholder="Selecione a categoria" />
						</SelectTrigger>
						<SelectContent>
							{categories.map((cat) => (
								<SelectItem key={cat.id} value={cat.id}>
									{cat.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Subcategoria */}
				{categoryId && subcategoryOptions.length > 0 && (
					<div className="space-y-2">
						<Label htmlFor="transaction-subcategory">Subcategoria</Label>
						<Select onValueChange={setSubcategoryId} value={subcategoryId}>
							<SelectTrigger id="transaction-subcategory">
								<SelectValue placeholder="Selecione a subcategoria" />
							</SelectTrigger>
							<SelectContent>
								{subcategoryOptions.map((sub) => (
									<SelectItem key={sub.id} value={sub.id}>
										{sub.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Tags */}
				<div className="space-y-2">
					<Label>Tags</Label>
					<Suspense
						fallback={<p className="text-sm text-muted-foreground">Carregando tags...</p>}
					>
						<TagCheckboxList selectedTagIds={tagIds} onToggle={handleTagToggle} />
					</Suspense>
				</div>

				{/* Observações */}
				<div className="space-y-2">
					<Label htmlFor="transaction-description">Observações</Label>
					<Textarea
						id="transaction-description"
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Observações sobre a transação (opcional)"
						rows={3}
						value={description}
					/>
				</div>
			</CredenzaBody>

			<CredenzaFooter>
				<Button
					className="w-full"
					disabled={!isValid || isPending}
					onClick={handleSubmit}
				>
					{isPending ? <Spinner className="size-4 mr-2" /> : null}
					{isCreate ? "Criar transação" : "Salvar alterações"}
				</Button>
			</CredenzaFooter>
		</>
	);
}

export function TransactionSheet({
	mode,
	transaction,
	onSuccess,
}: TransactionFormProps) {
	return (
		<Suspense
			fallback={
				<>
					<CredenzaHeader>
						<CredenzaTitle>
							{mode === "create" ? "Nova Transação" : "Editar Transação"}
						</CredenzaTitle>
					</CredenzaHeader>
					<CredenzaBody className="flex items-center justify-center py-8">
						<Spinner className="size-6" />
					</CredenzaBody>
				</>
			}
		>
			<TransactionFormContent
				mode={mode}
				transaction={transaction}
				onSuccess={onSuccess}
			/>
		</Suspense>
	);
}
