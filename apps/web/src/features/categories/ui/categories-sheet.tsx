import { SwatchColorPicker } from "@/components/swatch-color-picker";
import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { cn } from "@packages/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import {
	Baby,
	BookOpen,
	Briefcase,
	Car,
	Coffee,
	CreditCard,
	Dumbbell,
	Fuel,
	Gift,
	Heart,
	Home,
	type LucideIcon,
	Music,
	Package,
	Plane,
	ShoppingCart,
	Smartphone,
	Utensils,
	Wallet,
	Zap,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const CATEGORY_ICONS: { name: string; Icon: LucideIcon }[] = [
	{ name: "wallet", Icon: Wallet },
	{ name: "credit-card", Icon: CreditCard },
	{ name: "home", Icon: Home },
	{ name: "car", Icon: Car },
	{ name: "shopping-cart", Icon: ShoppingCart },
	{ name: "utensils", Icon: Utensils },
	{ name: "plane", Icon: Plane },
	{ name: "heart", Icon: Heart },
	{ name: "book-open", Icon: BookOpen },
	{ name: "briefcase", Icon: Briefcase },
	{ name: "package", Icon: Package },
	{ name: "music", Icon: Music },
	{ name: "coffee", Icon: Coffee },
	{ name: "smartphone", Icon: Smartphone },
	{ name: "dumbbell", Icon: Dumbbell },
	{ name: "baby", Icon: Baby },
	{ name: "gift", Icon: Gift },
	{ name: "zap", Icon: Zap },
	{ name: "fuel", Icon: Fuel },
];

interface CategoryFormProps {
	mode: "create" | "edit";
	category?: {
		id: string;
		name: string;
		color?: string | null;
		icon?: string | null;
		type?: string | null;
	};
	onSuccess: () => void;
}

export function CategorySheet({
	mode,
	category,
	onSuccess,
}: CategoryFormProps) {
	const [name, setName] = useState(category?.name ?? "");
	const [color, setColor] = useState(category?.color ?? "#6366f1");
	const [icon, setIcon] = useState(category?.icon ?? "");
	const [categoryType, setCategoryType] = useState<"income" | "expense" | "">(
		(category?.type as "income" | "expense") ?? "",
	);

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

	const handleSubmit = useCallback(() => {
		if (!isValid) return;

		const payload = {
			name: name.trim(),
			color: color || null,
			icon: icon || null,
			type: (categoryType || null) as "income" | "expense" | null | undefined,
		};

		if (mode === "create") {
			createMutation.mutate(payload);
		} else if (category) {
			updateMutation.mutate({ id: category.id, ...payload });
		}
	}, [isValid, mode, name, color, icon, categoryType, category, createMutation, updateMutation]);

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle>
					{isCreate ? "Nova Categoria" : "Editar Categoria"}
				</CredenzaTitle>
				<CredenzaDescription>
					{isCreate
						? "Adicione uma nova categoria para organizar suas transações."
						: "Atualize as informações da categoria."}
				</CredenzaDescription>
			</CredenzaHeader>

			<CredenzaBody className="space-y-4">
				{/* Nome */}
				<div className="space-y-2">
					<Label htmlFor="category-name">Nome</Label>
					<Input
						id="category-name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ex: Alimentação, Transporte"
						value={name}
					/>
				</div>

				{/* Tipo */}
				<div className="space-y-2">
					<Label htmlFor="category-type">Tipo</Label>
					<Select
						onValueChange={(v) =>
							setCategoryType(v as "income" | "expense" | "")
						}
						value={categoryType}
					>
						<SelectTrigger id="category-type">
							<SelectValue placeholder="Sem restrição" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">Sem restrição</SelectItem>
							<SelectItem value="income">Receita</SelectItem>
							<SelectItem value="expense">Despesa</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Ícone */}
				<div className="space-y-2">
					<Label>Ícone</Label>
					<div className="grid grid-cols-10 gap-1.5">
						{CATEGORY_ICONS.map(({ name: iconName, Icon }) => (
							<button
								className={cn(
									"flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent",
									icon === iconName && "border-primary bg-accent",
								)}
								key={iconName}
								onClick={() => setIcon(icon === iconName ? "" : iconName)}
								title={iconName}
								type="button"
							>
								<Icon className="size-4" />
							</button>
						))}
					</div>
				</div>

				{/* Cor */}
				<div className="space-y-2">
					<Label>Cor</Label>
					<SwatchColorPicker onChange={setColor} value={color} />
				</div>
			</CredenzaBody>

			<CredenzaFooter>
				<Button
					className="w-full"
					disabled={!isValid || isPending}
					onClick={handleSubmit}
				>
					{isPending ? <Spinner className="size-4 mr-2" /> : null}
					{isCreate ? "Criar categoria" : "Salvar alterações"}
				</Button>
			</CredenzaFooter>
		</>
	);
}
