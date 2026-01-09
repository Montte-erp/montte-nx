"use client";

import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
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
import { Switch } from "@packages/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { RouterOutput } from "@packages/api/client";

type Goal = RouterOutput["goals"]["getAll"][0];

type ManageGoalFormProps = {
	goal?: Goal;
};

const goalSchema = z.object({
	name: z.string().min(1, "Nome e obrigatorio"),
	description: z.string().optional(),
	type: z.enum(["savings", "debt_payoff", "spending_limit", "income_target"]),
	targetAmount: z.number().positive("Valor deve ser maior que zero"),
	startingAmount: z.number().min(0).optional(),
	targetDate: z.string().optional(),
	isAutoTracked: z.boolean().optional(),
});

const GOAL_TYPES = [
	{ value: "savings", label: "Poupanca" },
	{ value: "debt_payoff", label: "Quitar Divida" },
	{ value: "spending_limit", label: "Limite de Gastos" },
	{ value: "income_target", label: "Meta de Receita" },
] as const;

export function ManageGoalForm({ goal }: ManageGoalFormProps) {
	const { closeSheet } = useSheet();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const isEditing = !!goal;

	const createMutation = useMutation(
		trpc.goals.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: [["goals"]] });
				toast.success("Meta criada com sucesso");
				closeSheet();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao criar meta");
			},
		}),
	);

	const updateMutation = useMutation(
		trpc.goals.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: [["goals"]] });
				toast.success("Meta atualizada com sucesso");
				closeSheet();
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao atualizar meta");
			},
		}),
	);

	const form = useForm({
		defaultValues: {
			name: goal?.name ?? "",
			description: goal?.description ?? "",
			type: goal?.type ?? ("savings" as const),
			targetAmount: goal ? Number(goal.targetAmount) : 0,
			startingAmount: goal ? Number(goal.startingAmount) : 0,
			targetDate: goal?.targetDate
				? new Date(goal.targetDate).toISOString().split("T")[0]
				: "",
			isAutoTracked: goal?.isAutoTracked ?? false,
		},
		validators: {
			onBlur: goalSchema,
		},
		onSubmit: async ({ value }) => {
			if (isEditing && goal) {
				updateMutation.mutate({
					id: goal.id,
					name: value.name,
					description: value.description || null,
					targetAmount: value.targetAmount,
					targetDate: value.targetDate || null,
					isAutoTracked: value.isAutoTracked,
				});
			} else {
				createMutation.mutate({
					name: value.name,
					description: value.description,
					type: value.type,
					targetAmount: value.targetAmount,
					startingAmount: value.startingAmount,
					targetDate: value.targetDate || undefined,
					isAutoTracked: value.isAutoTracked,
				});
			}
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	return (
		<>
			<SheetHeader>
				<SheetTitle>{isEditing ? "Editar Meta" : "Nova Meta"}</SheetTitle>
				<SheetDescription>
					{isEditing
						? "Atualize as informacoes da meta financeira"
						: "Crie uma nova meta para acompanhar seu progresso financeiro"}
				</SheetDescription>
			</SheetHeader>

			<form
				className="flex flex-col gap-4 py-4"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<Field>
							<FieldLabel>Nome da meta</FieldLabel>
							<Input
								placeholder="Ex: Reserva de emergencia"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							<FieldError errors={field.state.meta.errors} />
						</Field>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<Field>
							<FieldLabel>Descricao (opcional)</FieldLabel>
							<Textarea
								placeholder="Descreva o objetivo desta meta..."
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</Field>
					)}
				</form.Field>

				{!isEditing && (
					<form.Field name="type">
						{(field) => (
							<Field>
								<FieldLabel>Tipo de meta</FieldLabel>
								<Select
									value={field.state.value}
									onValueChange={(value) =>
										field.handleChange(
											value as
												| "savings"
												| "debt_payoff"
												| "spending_limit"
												| "income_target",
										)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Selecione o tipo" />
									</SelectTrigger>
									<SelectContent>
										{GOAL_TYPES.map((type) => (
											<SelectItem key={type.value} value={type.value}>
												{type.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>
				)}

				<div className="grid grid-cols-2 gap-4">
					<form.Field name="targetAmount">
						{(field) => (
							<Field>
								<FieldLabel>Valor alvo</FieldLabel>
								<Input
									type="number"
									step="0.01"
									placeholder="0,00"
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) =>
										field.handleChange(Number(e.target.value) || 0)
									}
								/>
								<FieldError errors={field.state.meta.errors} />
							</Field>
						)}
					</form.Field>

					{!isEditing && (
						<form.Field name="startingAmount">
							{(field) => (
								<Field>
									<FieldLabel>Valor inicial</FieldLabel>
									<Input
										type="number"
										step="0.01"
										placeholder="0,00"
										value={field.state.value || ""}
										onBlur={field.handleBlur}
										onChange={(e) =>
											field.handleChange(Number(e.target.value) || 0)
										}
									/>
								</Field>
							)}
						</form.Field>
					)}
				</div>

				<form.Field name="targetDate">
					{(field) => (
						<Field>
							<FieldLabel>Data limite (opcional)</FieldLabel>
							<Input
								type="date"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field name="isAutoTracked">
					{(field) => (
						<div className="flex items-center justify-between gap-4 py-2">
							<div className="space-y-0.5">
								<FieldLabel className="text-base">
									Rastreamento automatico
								</FieldLabel>
								<p className="text-sm text-muted-foreground">
									Atualizar progresso automaticamente com base nas transacoes
								</p>
							</div>
							<Switch
								checked={field.state.value}
								onCheckedChange={field.handleChange}
							/>
						</div>
					)}
				</form.Field>

				<SheetFooter className="pt-4">
					<Button type="button" variant="outline" onClick={closeSheet}>
						Cancelar
					</Button>
					<Button type="submit" disabled={isPending}>
						{isPending
							? "Salvando..."
							: isEditing
								? "Salvar alteracoes"
								: "Criar meta"}
					</Button>
				</SheetFooter>
			</form>
		</>
	);
}
