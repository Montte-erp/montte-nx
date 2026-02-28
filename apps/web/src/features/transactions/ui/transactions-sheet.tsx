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
import {
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@packages/ui/components/sheet";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { Checkbox } from "@packages/ui/components/checkbox";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";

// =============================================================================
// Types
// =============================================================================

type TransactionType = "income" | "expense" | "transfer";

interface TransactionSheetProps {
	mode: "create" | "edit";
	transaction?: TransactionRow;
	onSuccess: () => void;
}

// =============================================================================
// Tag Checkbox List
// =============================================================================

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

// =============================================================================
// Form Content (needs suspense for data fetching)
// =============================================================================

function TransactionFormContent({
	mode,
	transaction,
	onSuccess,
}: TransactionSheetProps) {
	const isCreate = mode === "create";

	const { data: bankAccounts } = useSuspenseQuery(
		orpc.bankAccounts.getAll.queryOptions({}),
	);
	const { data: categories } = useSuspenseQuery(
		orpc.categories.getAll.queryOptions({}),
	);

	// Form state
	const [type, setType] = useState<TransactionType>(
		transaction?.type ?? "income",
	);
	const [amount, setAmount] = useState(transaction?.amount ?? "");
	const [date, setDate] = useState(transaction?.date ?? "");
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
	// Derived: subcategories for selected category
	const selectedCategory = categories.find((c) => c.id === categoryId);
	const subcategoryOptions = selectedCategory?.subcategories ?? [];

	// When category changes, reset subcategory
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

	const isValid =
		type.length > 0 &&
		amount.length > 0 &&
		Number(amount) > 0 &&
		date.length > 0 &&
		bankAccountId.length > 0 &&
		(type !== "transfer" || destinationBankAccountId.length > 0);

	const handleSubmit = useCallback(() => {
		if (!isValid) return;

		const payload = {
			type,
			amount,
			date,
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
	}, [isValid, isCreate, type, amount, date, bankAccountId, destinationBankAccountId, categoryId, subcategoryId, tagIds, description, createMutation, updateMutation, transaction]);

	return (
		<div className="flex h-full flex-col">
			<SheetHeader>
				<SheetTitle>
					{isCreate ? "Nova Transação" : "Editar Transação"}
				</SheetTitle>
				<SheetDescription>
					{isCreate
						? "Registre uma nova transação financeira."
						: "Atualize os dados da transação."}
				</SheetDescription>
			</SheetHeader>

			<div className="flex-1 overflow-y-auto space-y-6 py-6">
				{/* Tipo */}
				<div className="space-y-2 px-1">
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
				<div className="space-y-2 px-1">
					<Label htmlFor="transaction-amount">Valor (R$)</Label>
					<Input
						id="transaction-amount"
						min="0.01"
						onChange={(e) => setAmount(e.target.value)}
						placeholder="0.00"
						step="0.01"
						type="number"
						value={amount}
					/>
				</div>

				{/* Data */}
				<div className="space-y-2 px-1">
					<Label htmlFor="transaction-date">Data</Label>
					<Input
						id="transaction-date"
						onChange={(e) => setDate(e.target.value)}
						type="date"
						value={date}
					/>
				</div>

				{/* Conta */}
				<div className="space-y-2 px-1">
					<Label htmlFor="transaction-account">Conta</Label>
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

				{/* Conta de Destino (only for transfer) */}
				{type === "transfer" && (
					<div className="space-y-2 px-1">
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
				<div className="space-y-2 px-1">
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

				{/* Subcategoria (only when category selected and has subcategories) */}
				{categoryId && subcategoryOptions.length > 0 && (
					<div className="space-y-2 px-1">
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
				<div className="space-y-2 px-1">
					<Label>Tags</Label>
					<Suspense
						fallback={<p className="text-sm text-muted-foreground">Carregando tags...</p>}
					>
						<TagCheckboxList selectedTagIds={tagIds} onToggle={handleTagToggle} />
					</Suspense>
				</div>

				{/* Observações */}
				<div className="space-y-2 px-1">
					<Label htmlFor="transaction-description">Observações</Label>
					<Textarea
						id="transaction-description"
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Observações sobre a transação (opcional)"
						rows={3}
						value={description}
					/>
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
					{isCreate ? "Criar transação" : "Salvar alterações"}
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Main Export (wrapped in Suspense)
// =============================================================================

export function TransactionSheet({
	mode,
	transaction,
	onSuccess,
}: TransactionSheetProps) {
	return (
		<Suspense
			fallback={
				<div className="flex h-full flex-col">
					<SheetHeader>
						<SheetTitle>
							{mode === "create" ? "Nova Transação" : "Editar Transação"}
						</SheetTitle>
					</SheetHeader>
					<div className="flex flex-1 items-center justify-center">
						<Spinner className="size-6" />
					</div>
				</div>
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
