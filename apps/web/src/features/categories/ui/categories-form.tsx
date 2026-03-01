import { Button } from "@packages/ui/components/button";
import {
	ColorPicker,
	ColorPickerAlpha,
	ColorPickerEyeDropper,
	ColorPickerFormat,
	ColorPickerHue,
	ColorPickerOutput,
	ColorPickerSelection,
} from "@packages/ui/components/color-picker";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
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
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@packages/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
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

export function CategoryForm({
	mode,
	category,
	onSuccess,
}: CategoryFormProps) {
	const isCreate = mode === "create";

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

	const form = useForm({
		defaultValues: {
			color: category?.color ?? "#6366f1",
			icon: category?.icon ?? "",
			name: category?.name ?? "",
			type: (category?.type ?? "") as "income" | "expense" | "",
		},
		onSubmit: async ({ value }) => {
			const payload = {
				color: value.color || null,
				icon: value.icon || null,
				name: value.name.trim(),
				type: (value.type || null) as "income" | "expense" | null | undefined,
			};

			if (isCreate) {
				createMutation.mutate(payload);
			} else if (category) {
				updateMutation.mutate({ id: category.id, ...payload });
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
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
				<FieldGroup>
					<form.Field name="name">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel>Nome</FieldLabel>
									<Input
										onBlur={field.handleBlur}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="Ex: Alimentação, Transporte"
										value={field.state.value}
									/>
									{isInvalid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							);
						}}
					</form.Field>

					<form.Field name="type">
						{(field) => (
							<Field>
								<FieldLabel>Tipo</FieldLabel>
								<Select
									onValueChange={(v) =>
										field.handleChange(v as "income" | "expense" | "")
									}
									value={field.state.value}
								>
									<SelectTrigger>
										<SelectValue placeholder="Sem restrição" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Sem restrição</SelectItem>
										<SelectItem value="income">Receita</SelectItem>
										<SelectItem value="expense">Despesa</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						)}
					</form.Field>

					<form.Field name="icon">
						{(field) => (
							<Field>
								<FieldLabel>Ícone</FieldLabel>
								<div className="grid grid-cols-10 gap-1.5">
									{CATEGORY_ICONS.map(({ name: iconName, Icon }) => (
										<button
											className={cn(
												"flex size-8 items-center justify-center rounded-md border transition-colors hover:bg-accent",
												field.state.value === iconName &&
													"border-primary bg-accent",
											)}
											key={iconName}
											onClick={() =>
												field.handleChange(
													field.state.value === iconName ? "" : iconName,
												)
											}
											title={iconName}
											type="button"
										>
											<Icon className="size-4" />
										</button>
									))}
								</div>
							</Field>
						)}
					</form.Field>

					<form.Field name="color">
						{(field) => {
							const isInvalid =
								field.state.meta.isTouched && !field.state.meta.isValid;
							return (
								<Field data-invalid={isInvalid}>
									<FieldLabel>Cor</FieldLabel>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												aria-invalid={isInvalid || undefined}
												className="w-full flex gap-2 justify-start"
												type="button"
												variant="outline"
											>
												<div
													className="w-4 h-4 rounded border border-border shrink-0"
													style={{ backgroundColor: field.state.value }}
												/>
												{field.state.value}
											</Button>
										</PopoverTrigger>
										<PopoverContent
											align="start"
											className="rounded-md border bg-background"
										>
											<ColorPicker
												className="flex flex-col gap-4"
												onChange={(rgba) => {
													if (Array.isArray(rgba)) {
														field.handleChange(
															Color.rgb(rgba[0], rgba[1], rgba[2]).hex(),
														);
													}
												}}
												value={field.state.value || "#000000"}
											>
												<div className="h-24">
													<ColorPickerSelection />
												</div>
												<div className="flex items-center gap-4">
													<ColorPickerEyeDropper />
													<div className="grid w-full gap-1">
														<ColorPickerHue />
														<ColorPickerAlpha />
													</div>
												</div>
												<div className="flex items-center gap-2">
													<ColorPickerOutput />
													<ColorPickerFormat />
												</div>
											</ColorPicker>
										</PopoverContent>
									</Popover>
									{isInvalid && (
										<FieldError errors={field.state.meta.errors} />
									)}
								</Field>
							);
						}}
					</form.Field>
				</FieldGroup>
			</CredenzaBody>

			<CredenzaFooter>
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
							{(state.isSubmitting ||
								createMutation.isPending ||
								updateMutation.isPending) && (
								<Spinner className="size-4 mr-2" />
							)}
							{isCreate ? "Criar categoria" : "Salvar alterações"}
						</Button>
					)}
				</form.Subscribe>
			</CredenzaFooter>
		</form>
	);
}
