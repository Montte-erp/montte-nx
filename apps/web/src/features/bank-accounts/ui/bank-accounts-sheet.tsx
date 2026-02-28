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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface BankAccountSheetProps {
	mode: "create" | "edit";
	account?: {
		id: string;
		name: string;
		type: "checking" | "savings" | "credit_card" | "investment" | "cash" | "other";
		color: string;
		iconUrl?: string | null;
		initialBalance: string;
	};
	onSuccess: () => void;
}

const TYPE_OPTIONS = [
	{ value: "checking", label: "Conta Corrente" },
	{ value: "savings", label: "Poupança" },
	{ value: "credit_card", label: "Cartão de Crédito" },
	{ value: "investment", label: "Investimento" },
	{ value: "cash", label: "Dinheiro" },
	{ value: "other", label: "Outro" },
] as const;

export function BankAccountSheet({
	mode,
	account,
	onSuccess,
}: BankAccountSheetProps) {
	const queryClient = useQueryClient();

	const [name, setName] = useState(account?.name ?? "");
	const [type, setType] = useState<
		"checking" | "savings" | "credit_card" | "investment" | "cash" | "other"
	>(account?.type ?? "checking");
	const [color, setColor] = useState(account?.color ?? "#6366f1");
	const [colorHex, setColorHex] = useState(account?.color ?? "#6366f1");
	const [initialBalance, setInitialBalance] = useState(
		account?.initialBalance ?? "0",
	);

	const createMutation = useMutation(
		orpc.bankAccounts.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bankAccounts.getAll.queryOptions({}).queryKey,
				});
				toast.success("Conta bancária criada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao criar conta bancária.");
			},
		}),
	);

	const updateMutation = useMutation(
		orpc.bankAccounts.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.bankAccounts.getAll.queryOptions({}).queryKey,
				});
				toast.success("Conta bancária atualizada com sucesso.");
				onSuccess();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao atualizar conta bancária.");
			},
		}),
	);

	const isPending = createMutation.isPending || updateMutation.isPending;
	const isValid = name.trim().length > 0;

	function handleColorPickerChange(value: string) {
		setColor(value);
		setColorHex(value);
	}

	function handleColorHexChange(value: string) {
		setColorHex(value);
		if (/^#[0-9a-fA-F]{6}$/.test(value)) {
			setColor(value);
		}
	}

	function handleSubmit() {
		if (!isValid) return;

		if (mode === "create") {
			createMutation.mutate({
				name: name.trim(),
				type,
				color,
				initialBalance,
			});
		} else if (account) {
			updateMutation.mutate({
				id: account.id,
				name: name.trim(),
				type,
				color,
			});
		}
	}

	const isCreate = mode === "create";

	return (
		<div className="flex h-full flex-col">
			<SheetHeader>
				<SheetTitle>
					{isCreate ? "Nova Conta Bancária" : "Editar Conta Bancária"}
				</SheetTitle>
				<SheetDescription>
					{isCreate
						? "Adicione uma nova conta para organizar suas finanças."
						: "Atualize as informações da conta bancária."}
				</SheetDescription>
			</SheetHeader>

			<div className="flex-1 overflow-y-auto space-y-6 py-6">
				{/* Nome */}
				<div className="space-y-2 px-1">
					<Label htmlFor="account-name">Nome</Label>
					<Input
						id="account-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex: Nubank, Itaú Corrente"
						value={name}
					/>
				</div>

				{/* Tipo */}
				<div className="space-y-2 px-1">
					<Label htmlFor="account-type">Tipo</Label>
					<Select
						onValueChange={(v) =>
							setType(
								v as "checking" | "savings" | "credit_card" | "investment" | "cash" | "other",
							)
						}
						value={type}
					>
						<SelectTrigger id="account-type">
							<SelectValue placeholder="Selecione o tipo" />
						</SelectTrigger>
						<SelectContent>
							{TYPE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Cor */}
				<div className="space-y-2 px-1">
					<Label htmlFor="account-color-hex">Cor</Label>
					<div className="flex items-center gap-2">
						<input
							className="size-10 rounded-md border cursor-pointer p-0.5"
							id="account-color"
							onChange={(e) => handleColorPickerChange(e.target.value)}
							type="color"
							value={color}
						/>
						<Input
							className="flex-1 font-mono"
							id="account-color-hex"
							maxLength={7}
							onChange={(e) => handleColorHexChange(e.target.value)}
							placeholder="#6366f1"
							value={colorHex}
						/>
					</div>
				</div>

				{/* Saldo Inicial (create only) */}
				{isCreate && (
					<div className="space-y-2 px-1">
						<Label htmlFor="account-initial-balance">Saldo Inicial</Label>
						<Input
							id="account-initial-balance"
							min="0"
							onChange={(e) => setInitialBalance(e.target.value)}
							placeholder="0.00"
							step="0.01"
							type="number"
							value={initialBalance}
						/>
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="border-t pt-4 pb-2">
				<Button
					className="w-full"
					disabled={!isValid || isPending}
					onClick={handleSubmit}
				>
					{isPending ? <Spinner className="size-4 mr-2" /> : null}
					{isCreate ? "Criar conta" : "Salvar alterações"}
				</Button>
			</div>
		</div>
	);
}
