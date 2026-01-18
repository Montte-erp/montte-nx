import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Bell,
	CreditCard,
	Receipt,
	TrendingUp,
	Wallet,
	type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

// Types
export type NotificationType =
	| "budget_alert"
	| "bill_reminder"
	| "overdue_alert"
	| "transaction_alert"
	| "goal_progress"
	| "general";

export interface Notification {
	id: string;
	title: string;
	message: string;
	type: string;
	isRead: boolean;
	createdAt: Date;
	metadata?: unknown;
}

// Icon and color mappings
const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
	budget_alert: Wallet,
	bill_reminder: Receipt,
	overdue_alert: AlertTriangle,
	transaction_alert: CreditCard,
	goal_progress: TrendingUp,
	general: Bell,
};

const NOTIFICATION_COLORS: Record<
	NotificationType,
	{ bg: string; text: string }
> = {
	budget_alert: { bg: "bg-amber-100", text: "text-amber-600" },
	bill_reminder: { bg: "bg-blue-100", text: "text-blue-600" },
	overdue_alert: { bg: "bg-red-100", text: "text-red-600" },
	transaction_alert: { bg: "bg-green-100", text: "text-green-600" },
	goal_progress: { bg: "bg-purple-100", text: "text-purple-600" },
	general: { bg: "bg-gray-100", text: "text-gray-600" },
};

// Utility functions
export function getNotificationIcon(type: string): LucideIcon {
	return (
		NOTIFICATION_ICONS[type as NotificationType] || NOTIFICATION_ICONS.general
	);
}

export function getNotificationColor(
	type: string,
): { bg: string; text: string } {
	return (
		NOTIFICATION_COLORS[type as NotificationType] ||
		NOTIFICATION_COLORS.general
	);
}

export function formatNotificationTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) {
		return "Agora";
	}
	if (diffMinutes < 60) {
		return `${diffMinutes}min atrás`;
	}
	if (diffHours < 24) {
		return `${diffHours}h atrás`;
	}
	if (diffDays < 7) {
		return `${diffDays}d atrás`;
	}

	return date.toLocaleDateString("pt-BR", {
		day: "2-digit",
		month: "short",
	});
}

// Hook
export function useNotifications() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const {
		data: notifications = [],
		isLoading,
		error,
	} = useQuery(
		trpc.notifications.list.queryOptions({
			onlyUnread: true,
		}),
	);

	const markAsReadMutation = useMutation(
		trpc.notifications.markAsRead.mutationOptions({
			onSuccess: () => {
				toast.success("Notificação marcada como lida");
			},
			onSettled: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.notifications.list.queryKey(),
				});
			},
		}),
	);

	const dismissMutation = useMutation(
		trpc.notifications.dismiss.mutationOptions({
			onSuccess: () => {
				toast.success("Notificação dispensada");
			},
			onSettled: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.notifications.list.queryKey(),
				});
			},
		}),
	);

	const markAsRead = async (id: string) => {
		await markAsReadMutation.mutateAsync({ id });
	};

	const dismiss = async (id: string) => {
		await dismissMutation.mutateAsync({ id });
	};

	const unreadCount = notifications.length;

	return {
		notifications,
		isLoading,
		error,
		markAsRead,
		isMarkingAsRead: markAsReadMutation.isPending,
		dismiss,
		isDismissing: dismissMutation.isPending,
		unreadCount,
	};
}
