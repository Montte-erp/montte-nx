import { Button } from "@packages/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
	Copy,
	LayoutDashboard,
	LineChart,
	MoreHorizontal,
	Pencil,
	Plus,
	Search,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	type Tab,
	openSearchTab,
	useDashboardTabs,
} from "@/features/dashboard/hooks/use-dashboard-tabs";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";

// Tab color configuration for PostHog-style colored icons
const TAB_COLORS = {
	app: {
		bg: "bg-blue-500/20",
		text: "text-blue-500",
		icon: LayoutDashboard,
	},
	dashboard: {
		bg: "bg-purple-500/20",
		text: "text-purple-500",
		icon: LineChart,
	},
	insight: {
		bg: "bg-blue-500/20",
		text: "text-blue-500",
		icon: Sparkles,
	},
	search: {
		bg: "bg-green-500/20",
		text: "text-green-500",
		icon: Search,
	},
} as const;

function getTabColors(type: "app" | "dashboard" | "insight" | "search") {
	return TAB_COLORS[type];
}

export function DashboardTabBar() {
	const { tabs, activeTabId, setActiveTab, closeTab } = useDashboardTabs();
	const { activeOrganization } = useActiveOrganization();
	const slug = activeOrganization.slug;
	const navigate = useNavigate();

	const handleTabClick = (tab: Tab) => {
		setActiveTab(tab.id);

		if (tab.type === "app") {
			// Don't navigate, just switch to app tab (content will show current page)
		} else if (tab.type === "dashboard") {
			// Navigate to dashboard
			navigate({
				to: "/$slug/dashboards/$dashboardId",
				params: { dashboardId: tab.dashboardId, slug },
			});
		} else if (tab.type === "insight") {
			// Navigate to insight
			navigate({
				to: "/$slug/insights/$insightId",
				params: { insightId: tab.insightId, slug },
			});
		} else if (tab.type === "search") {
			// Navigate to search
			navigate({
				to: "/$slug/search",
				params: { slug },
			});
		}
	};

	const handleOpenSearchTab = () => {
		openSearchTab();
		navigate({
			to: "/$slug/search",
			params: { slug },
		});
	};

	return (
		<div className="relative flex items-end gap-1 h-12 overflow-x-auto w-full">
			{tabs.map((tab) => (
				<TabItem
					key={tab.id}
					tab={tab}
					isActive={activeTabId === tab.id}
					onClick={() => handleTabClick(tab)}
					onClose={
						tab.type !== "app" ? () => closeTab(tab.id) : undefined
					}
				/>
			))}

			{/* Add Dashboard/Insight Button */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
						onClick={handleOpenSearchTab}
					>
						<Plus className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<div className="flex items-center gap-2">
						<span>Search & create</span>
						<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
							<span className="text-xs">⌘</span>K
						</kbd>
					</div>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

function TabItem({
	tab,
	isActive,
	onClick,
	onClose,
}: {
	tab: Tab;
	isActive: boolean;
	onClick: () => void;
	onClose?: () => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(tab.name);
	const inputRef = useRef<HTMLInputElement>(null);
	const trpc = useTRPC();
	const { openAlertDialog } = useAlertDialog();
	const { updateTabName } = useDashboardTabs();

	const updateMutation = useMutation(
		trpc.dashboards.update.mutationOptions({
			onSuccess: () => {
				toast.success("Dashboard renamed");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to rename dashboard");
			},
		}),
	);

	const duplicateMutation = useMutation(
		trpc.dashboards.duplicate.mutationOptions({
			onSuccess: () => {
				toast.success("Dashboard duplicated");
			},
			onError: (error) => {
				toast.error(error.message || "Failed to duplicate dashboard");
			},
		}),
	);

	const deleteMutation = useMutation(
		trpc.dashboards.delete.mutationOptions({
			onSuccess: () => {
				toast.success("Dashboard deleted");
				onClose?.();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to delete dashboard");
			},
		}),
	);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleSaveName = () => {
		if (
			editName.trim() &&
			editName !== tab.name &&
			tab.type === "dashboard"
		) {
			updateMutation.mutate({
				id: tab.dashboardId,
				name: editName.trim(),
			});
			updateTabName(tab.id, editName.trim());
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSaveName();
		} else if (e.key === "Escape") {
			setEditName(tab.name);
			setIsEditing(false);
		}
	};

	const handleDuplicate = () => {
		if (tab.type === "dashboard") {
			duplicateMutation.mutate({ id: tab.dashboardId });
		}
	};

	const handleDelete = () => {
		if (tab.type === "dashboard") {
			openAlertDialog({
				title: "Delete Dashboard",
				description: `Are you sure you want to delete "${tab.name}"? This action cannot be undone.`,
				actionLabel: "Delete",
				variant: "destructive",
				onAction: async () => {
					await deleteMutation.mutateAsync({ id: tab.dashboardId });
				},
			});
		}
	};

	const colors = getTabColors(tab.type);
	const Icon = colors.icon;

	return (
		<div
			className={cn(
				"group relative flex items-center gap-2 px-3 text-sm cursor-pointer transition-all shrink-0",
				isActive
					? "h-10 text-foreground bg-background rounded-t-lg"
					: "h-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 rounded-md mb-2",
			)}
			onClick={onClick}
		>
			{/* Colored icon container - PostHog style */}
			<div
				className={cn(
					"flex items-center justify-center size-5 rounded shrink-0",
					colors.bg,
				)}
			>
				<Icon className={cn("size-3", colors.text)} />
			</div>

			{isEditing && tab.type === "dashboard" ? (
				<Input
					ref={inputRef}
					value={editName}
					onChange={(e) => setEditName(e.target.value)}
					onBlur={handleSaveName}
					onKeyDown={handleKeyDown}
					className="h-5 w-24 px-1 py-0 text-sm"
					onClick={(e) => e.stopPropagation()}
				/>
			) : (
				<span className="truncate max-w-32 text-[13px]">{tab.name}</span>
			)}

			{/* Close button - visible for closable tabs (dashboard, insight, search) */}
			{tab.type !== "app" && onClose && (
				<button
					type="button"
					className={cn(
						"flex items-center justify-center size-5 rounded hover:bg-sidebar-accent transition-colors",
						"text-sidebar-foreground/60 hover:text-sidebar-foreground",
					)}
					onClick={(e) => {
						e.stopPropagation();
						onClose();
					}}
				>
					<X className="size-3.5" />
				</button>
			)}

			{/* Context menu trigger - only for dashboard tabs */}
			{tab.type === "dashboard" && (
				<DropdownMenu>
					<DropdownMenuTrigger
						asChild
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							className={cn(
								"flex items-center justify-center size-5 rounded hover:bg-sidebar-accent transition-all",
								"text-sidebar-foreground/60 hover:text-sidebar-foreground",
								"opacity-0 group-hover:opacity-100",
							)}
						>
							<MoreHorizontal className="size-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						<DropdownMenuItem onClick={() => setIsEditing(true)}>
							<Pencil className="h-4 w-4 mr-2" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleDuplicate}>
							<Copy className="h-4 w-4 mr-2" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={handleDelete}
							className="text-destructive focus:text-destructive"
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
}
