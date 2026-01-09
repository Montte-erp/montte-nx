"use client";

import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@packages/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Badge } from "@packages/ui/components/badge";
import { formatDecimalCurrency } from "@packages/money";
import { useQuery } from "@tanstack/react-query";
import {
	Calendar,
	CreditCard,
	Edit,
	MoreHorizontal,
	PiggyBank,
	Target,
	Trash2,
	TrendingDown,
	Wallet,
} from "lucide-react";
import { useTRPC } from "@/integrations/clients";
import { useSheet } from "@/hooks/use-sheet";
import { useGoalList } from "../features/goal-list-context";
import { useDeleteGoal } from "../features/use-delete-goal";
import { ManageGoalForm } from "../features/manage-goal-form";
import { GoalProgressBar } from "./goal-progress-bar";
import type { RouterOutput } from "@packages/api/client";

type Goal = RouterOutput["goals"]["getAll"][0];

const GOAL_TYPE_CONFIG = {
	savings: {
		label: "Poupanca",
		icon: PiggyBank,
		color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	},
	debt_payoff: {
		label: "Quitar Divida",
		icon: CreditCard,
		color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	},
	spending_limit: {
		label: "Limite de Gastos",
		icon: TrendingDown,
		color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	},
	income_target: {
		label: "Meta de Receita",
		icon: Wallet,
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	},
};

const STATUS_CONFIG = {
	active: { label: "Ativa", color: "bg-green-500" },
	completed: { label: "Concluida", color: "bg-blue-500" },
	paused: { label: "Pausada", color: "bg-yellow-500" },
	cancelled: { label: "Cancelada", color: "bg-gray-500" },
};

export function GoalsListSection() {
	const trpc = useTRPC();
	const { openSheet } = useSheet();
	const { deleteGoal } = useDeleteGoal();
	const { typeFilter, statusFilter } = useGoalList();

	const { data: goals, isLoading } = useQuery(
		trpc.goals.getAll.queryOptions({
			type: typeFilter ?? undefined,
			status: statusFilter ?? undefined,
		}),
	);

	if (isLoading) {
		return <GoalsListSkeleton />;
	}

	if (!goals || goals.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-12">
					<Target className="h-12 w-12 text-muted-foreground mb-4" />
					<h3 className="text-lg font-medium mb-2">Nenhuma meta encontrada</h3>
					<p className="text-sm text-muted-foreground text-center max-w-md">
						{statusFilter
							? "Nenhuma meta com o status selecionado."
							: "Crie sua primeira meta para comecar a acompanhar seu progresso financeiro."}
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{goals.map((goal) => (
				<GoalCard
					key={goal.id}
					goal={goal}
					onEdit={() => openSheet({ children: <ManageGoalForm goal={goal} /> })}
					onDelete={() => deleteGoal(goal.id, goal.name)}
				/>
			))}
		</div>
	);
}

type GoalCardProps = {
	goal: Goal;
	onEdit: () => void;
	onDelete: () => void;
};

function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
	const typeConfig = GOAL_TYPE_CONFIG[goal.type];
	const statusConfig = STATUS_CONFIG[goal.status];
	const TypeIcon = typeConfig.icon;

	const currentAmount = Number(goal.currentAmount);
	const targetAmount = Number(goal.targetAmount);
	const remaining = targetAmount - currentAmount;

	const daysRemaining = goal.targetDate
		? Math.ceil(
				(new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
			)
		: null;

	return (
		<Card className="overflow-hidden">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<div className={`p-2 rounded-lg ${typeConfig.color}`}>
							<TypeIcon className="h-4 w-4" />
						</div>
						<div>
							<CardTitle className="text-base">{goal.name}</CardTitle>
							<Badge variant="outline" className="text-xs mt-1">
								{typeConfig.label}
							</Badge>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-8 w-8">
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onEdit}>
								<Edit className="mr-2 h-4 w-4" />
								Editar
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Excluir
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{goal.description && (
					<p className="text-sm text-muted-foreground line-clamp-2">
						{goal.description}
					</p>
				)}

				<div className="space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Progresso</span>
						<span className="font-medium">
							{formatDecimalCurrency(currentAmount)} / {formatDecimalCurrency(targetAmount)}
						</span>
					</div>
					<GoalProgressBar
						currentAmount={currentAmount}
						targetAmount={targetAmount}
						size="md"
					/>
				</div>

				<div className="flex items-center justify-between text-sm">
					<div className="flex items-center gap-1.5">
						<div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
						<span className="text-muted-foreground">{statusConfig.label}</span>
					</div>
					{daysRemaining !== null && goal.status === "active" && (
						<div className="flex items-center gap-1 text-muted-foreground">
							<Calendar className="h-3.5 w-3.5" />
							<span>
								{daysRemaining > 0
									? `${daysRemaining} dias restantes`
									: daysRemaining === 0
										? "Vence hoje"
										: `Venceu ha ${Math.abs(daysRemaining)} dias`}
							</span>
						</div>
					)}
				</div>

				{remaining > 0 && goal.status === "active" && (
					<p className="text-xs text-muted-foreground">
						Faltam {formatDecimalCurrency(remaining)} para atingir a meta
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function GoalsListSkeleton() {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<Card key={`goal-skeleton-${i + 1}`}>
					<CardHeader className="pb-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-10 w-10 rounded-lg" />
							<div className="space-y-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-4 w-20" />
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<Skeleton className="h-3 w-full" />
						<div className="space-y-2">
							<div className="flex justify-between">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-2.5 w-full rounded-full" />
						</div>
						<div className="flex justify-between">
							<Skeleton className="h-3 w-16" />
							<Skeleton className="h-3 w-28" />
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}
