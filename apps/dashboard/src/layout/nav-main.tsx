import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@packages/ui/components/sidebar";
import { cn } from "@packages/ui/lib/utils";
import { Link, useLocation } from "@tanstack/react-router";
import {
	BarChart3,
	Building2,
	ChevronDown,
	CirclePlus,
	FileText,
	FolderKanban,
	Landmark,
	Percent,
	Receipt,
	Settings2,
	Sparkles,
	Tag,
	Target,
	TrendingUp,
	Users,
	Wallet,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { ManageTransactionForm } from "@/features/transaction/ui/manage-transaction-form";
import { usePlanFeatures } from "@/features/billing/lib/use-plan-features";
import { useSheet } from "@/hooks/use-sheet";

export function NavMain() {
	const { openSheet } = useSheet();
	const { pathname, searchStr } = useLocation();
	const { setOpenMobile, state } = useSidebar();
	const [reportsOpen, setReportsOpen] = useState(true);
	const [planningOpen, setPlanningOpen] = useState(true);
	const [categorizationOpen, setCategorizationOpen] = useState(false);
	const {
		canAccessTags,
		canAccessCostCenters,
		canAccessCounterparties,
		canAccessInterestTemplates,
		canAccessAutomations,
	} = usePlanFeatures();

	// Extract slug from pathname for navigation
	const slug = pathname.split("/")[1] || "";

	const isActive = (url: string) => {
		if (!url) return false;

		const resolvedUrl = url.replace("$slug", slug);

		if (resolvedUrl.includes("?")) {
			const [path, params] = resolvedUrl.split("?");
			return pathname === path && searchStr === `?${params}`;
		}

		return pathname === resolvedUrl && !searchStr;
	};

	// Check if any settings sub-item is active
	const isSettingsActive = () => {
		const settingsUrls = [
			"/$slug/categories",
			"/$slug/cost-centers",
			"/$slug/tags",
			"/$slug/interest-templates",
			"/$slug/automations",
		];
		return settingsUrls.some((url) => isActive(url));
	};

	// Finance section - core financial management
	const financeItems = [
		{
			icon: Building2,
			id: "bank-accounts",
			title: "Contas Bancárias",
			url: "/$slug/bank-accounts",
		},
		{
			icon: Receipt,
			id: "bills-overview",
			title: "Contas a Pagar",
			url: "/$slug/bills",
		},
		...(canAccessCounterparties
			? [
				{
					icon: Users,
					id: "counterparties",
					title: "Cadastros",
					url: "/$slug/counterparties",
				},
			]
			: []),
	];

	// Settings sub-items
	const settingsItems = [
		{
			icon: FileText,
			id: "categories",
			title: "Categorias",
			url: "/$slug/categories",
		},
		...(canAccessCostCenters
			? [
				{
					icon: Landmark,
					id: "cost-centers",
					title: "Centros de Custo",
					url: "/$slug/cost-centers",
				},
			]
			: []),
		...(canAccessTags
			? [
				{
					icon: Tag,
					id: "tags",
					title: "Tags",
					url: "/$slug/tags",
				},
			]
			: []),
		...(canAccessInterestTemplates
			? [
				{
					icon: Percent,
					id: "interest-templates",
					title: "Modelos de Juros",
					url: "/$slug/interest-templates",
				},
			]
			: []),
		...(canAccessAutomations
			? [
				{
					icon: Zap,
					id: "automations",
					title: "Automações",
					url: "/$slug/automations",
				},
			]
			: []),
	];

	const renderNavItem = (item: {
		icon: typeof TrendingUp;
		id: string;
		title: string;
		url: string;
	}) => {
		const Icon = item.icon;

		return (
			<SidebarMenuItem key={item.id}>
				<SidebarMenuButton
					asChild
					className={
						isActive(item.url)
							? "bg-primary/10 text-primary rounded-lg"
							: ""
					}
					tooltip={item.title}
				>
					<Link
						onClick={() => setOpenMobile(false)}
						params={{}}
						to={item.url}
					>
						<Icon />
						<span>{item.title}</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	};

	return (
		<SidebarGroup className="group-data-[collapsible=icon]">
			<SidebarGroupContent className="flex flex-col gap-2">
				{/* Primary Action Button */}
				<SidebarMenu>
					<SidebarMenuButton
						className="bg-primary text-primary-foreground cursor-pointer"
						onClick={() =>
							openSheet({ children: <ManageTransactionForm /> })
						}
						tooltip="Adicionar Nova Transação"
					>
						<CirclePlus />
						<span>Adicionar Nova Transação</span>
					</SidebarMenuButton>
				</SidebarMenu>

				{/* Transactions - Main feature */}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className={
								isActive("/$slug/transactions")
									? "bg-primary/10 text-primary rounded-lg"
									: ""
							}
							tooltip="Fluxo de Caixa"
						>
							<Link
								onClick={() => setOpenMobile(false)}
								params={{}}
								to="/$slug/transactions"
							>
								<TrendingUp />
								<span>Fluxo de Caixa</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>

				{/* Reports Section - Collapsible with Dashboards and Insights */}
				<SidebarMenu>
					<Collapsible open={reportsOpen} onOpenChange={setReportsOpen}>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton
									tooltip="Análises"
									className={cn(
										isActive("/$slug/dashboards") ||
											isActive("/$slug/insights")
											? "bg-primary/10 text-primary rounded-lg"
											: "",
									)}
								>
									<BarChart3 />
									<span>Análises</span>
									<ChevronDown
										className={cn(
											"ml-auto h-4 w-4 transition-transform",
											reportsOpen && "rotate-180",
										)}
									/>
								</SidebarMenuButton>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									<SidebarMenuSubItem>
										<SidebarMenuSubButton
											asChild
											isActive={isActive("/$slug/dashboards")}
										>
											<Link
												onClick={() => setOpenMobile(false)}
												params={{ slug }}
												to="/$slug/dashboards"
											>
												<FolderKanban className="size-4" />
												<span>Dashboards</span>
											</Link>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
									<SidebarMenuSubItem>
										<SidebarMenuSubButton
											asChild
											isActive={isActive("/$slug/insights")}
										>
											<Link
												onClick={() => setOpenMobile(false)}
												params={{ slug }}
												to="/$slug/insights"
											>
												<Sparkles className="size-4" />
												<span>Insights</span>
											</Link>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				</SidebarMenu>

				{/* Planning Section - Collapsible with Goals and Budgets */}
				<SidebarMenu>
					<Collapsible open={planningOpen} onOpenChange={setPlanningOpen}>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton
									tooltip="Planejamento"
									className={cn(
										isActive("/$slug/goals") ||
											isActive("/$slug/budgets")
											? "bg-primary/10 text-primary rounded-lg"
											: "",
									)}
								>
									<Target />
									<span>Planejamento</span>
									<ChevronDown
										className={cn(
											"ml-auto h-4 w-4 transition-transform",
											planningOpen && "rotate-180",
										)}
									/>
								</SidebarMenuButton>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									<SidebarMenuSubItem>
										<SidebarMenuSubButton
											asChild
											isActive={isActive("/$slug/goals")}
										>
											<Link
												onClick={() => setOpenMobile(false)}
												params={{ slug }}
												to="/$slug/goals"
											>
												<Target className="size-4" />
												<span>Metas</span>
											</Link>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
									<SidebarMenuSubItem>
										<SidebarMenuSubButton
											asChild
											isActive={isActive("/$slug/budgets")}
										>
											<Link
												onClick={() => setOpenMobile(false)}
												params={{ slug }}
												to="/$slug/budgets"
											>
												<Wallet className="size-4" />
												<span>Orçamentos</span>
											</Link>
										</SidebarMenuSubButton>
									</SidebarMenuSubItem>
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				</SidebarMenu>

				{/* Categorização Section - Collapsible with Categories, Tags, etc */}
				<SidebarMenu>
					<Collapsible open={categorizationOpen} onOpenChange={setCategorizationOpen}>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton
									tooltip="Categorização"
									className={cn(
										isSettingsActive()
											? "bg-primary/10 text-primary rounded-lg"
											: "",
									)}
								>
									<Settings2 />
									<span>Categorização</span>
									<ChevronDown
										className={cn(
											"ml-auto h-4 w-4 transition-transform",
											categorizationOpen && "rotate-180",
										)}
									/>
								</SidebarMenuButton>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									{settingsItems.map((item) => {
										const Icon = item.icon;
										return (
											<SidebarMenuSubItem key={item.id}>
												<SidebarMenuSubButton
													asChild
													isActive={isActive(item.url)}
												>
													<Link
														onClick={() => setOpenMobile(false)}
														params={{ slug }}
														to={item.url}
													>
														<Icon className="size-4" />
														<span>{item.title}</span>
													</Link>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										);
									})}
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				</SidebarMenu>

				{/* Finance Section */}
				{state === "expanded" && (
					<SidebarGroupLabel>Gestão</SidebarGroupLabel>
				)}
				<SidebarMenu>
					{financeItems.map((item) => renderNavItem(item))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
