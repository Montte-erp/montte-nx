import { AppError, propagateError } from "@packages/utils/errors";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
	type BalanceCardConfig,
	type BankAccountsConfig,
	type Dashboard,
	dashboard,
	type DashboardFilter,
	dashboardFilter,
	type DashboardFilterConfig,
	type DashboardWidget,
	dashboardWidget,
	type InsightConfig,
	type NewDashboard,
	type NewDashboardFilter,
	type NewDashboardWidget,
	type NewRecentItem,
	type NewSavedInsight,
	type QuickActionsConfig,
	recentItem,
	type RecentItem,
	type RecentTransactionsConfig,
	savedInsight,
	type SavedInsight,
	type WidgetConfig,
	type WidgetPosition,
} from "../schemas/dashboards";

export type {
	BalanceCardConfig,
	BankAccountsConfig,
	Dashboard,
	DashboardFilter,
	DashboardFilterConfig,
	DashboardWidget,
	InsightConfig,
	QuickActionsConfig,
	RecentItem,
	RecentTransactionsConfig,
	SavedInsight,
	WidgetConfig,
	WidgetPosition,
};

// ============================================
// Dashboard CRUD
// ============================================

export async function createDashboard(
	dbClient: DatabaseInstance,
	data: NewDashboard,
): Promise<Dashboard> {
	try {
		// Get max tab order for the organization
		const maxOrderResult = await dbClient
			.select({ maxOrder: sql<number>`COALESCE(MAX(${dashboard.tabOrder}), -1)` })
			.from(dashboard)
			.where(eq(dashboard.organizationId, data.organizationId));

		const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

		const result = await dbClient
			.insert(dashboard)
			.values({
				...data,
				tabOrder: nextOrder,
			})
			.returning();

		if (!result[0]) {
			throw AppError.database("Failed to create dashboard");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to create dashboard: ${(err as Error).message}`,
		);
	}
}

export async function updateDashboard(
	dbClient: DatabaseInstance,
	dashboardId: string,
	data: Partial<Pick<Dashboard, "name" | "description" | "layout" | "isPinned" | "defaultFilters">>,
): Promise<Dashboard> {
	try {
		const result = await dbClient
			.update(dashboard)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(dashboard.id, dashboardId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Dashboard not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to update dashboard: ${(err as Error).message}`,
		);
	}
}

export async function deleteDashboard(
	dbClient: DatabaseInstance,
	dashboardId: string,
): Promise<Dashboard> {
	try {
		const result = await dbClient
			.delete(dashboard)
			.where(eq(dashboard.id, dashboardId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Dashboard not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to delete dashboard: ${(err as Error).message}`,
		);
	}
}

export async function findDashboardById(
	dbClient: DatabaseInstance,
	dashboardId: string,
) {
	try {
		const result = await dbClient.query.dashboard.findFirst({
			where: (d, { eq: eqOp }) => eqOp(d.id, dashboardId),
			with: {
				createdByUser: {
					columns: {
						email: true,
						id: true,
						name: true,
					},
				},
				widgets: {
					orderBy: (w, { asc: ascOp }) => ascOp(w.createdAt),
				},
				filters: true,
			},
		});

		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find dashboard: ${(err as Error).message}`,
		);
	}
}

export async function findDashboardsByOrganizationId(
	dbClient: DatabaseInstance,
	organizationId: string,
	options: {
		search?: string;
		pinnedOnly?: boolean;
	} = {},
) {
	const { search, pinnedOnly } = options;

	try {
		const conditions = [eq(dashboard.organizationId, organizationId)];

		if (search) {
			conditions.push(ilike(dashboard.name, `%${search}%`));
		}

		if (pinnedOnly) {
			conditions.push(eq(dashboard.isPinned, true));
		}

		const whereClause = and(...conditions);

		const dashboards = await dbClient.query.dashboard.findMany({
			orderBy: (d) => [asc(d.tabOrder), desc(d.createdAt)],
			where: () => whereClause,
			with: {
				createdByUser: {
					columns: {
						email: true,
						id: true,
						name: true,
					},
				},
			},
		});

		return dashboards;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find dashboards: ${(err as Error).message}`,
		);
	}
}

export async function reorderDashboardTabs(
	dbClient: DatabaseInstance,
	organizationId: string,
	orderedIds: string[],
): Promise<void> {
	try {
		// Update each dashboard's tab order based on position in array
		await Promise.all(
			orderedIds.map((id, index) =>
				dbClient
					.update(dashboard)
					.set({ tabOrder: index, updatedAt: new Date() })
					.where(
						and(
							eq(dashboard.id, id),
							eq(dashboard.organizationId, organizationId),
						),
					),
			),
		);
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to reorder dashboard tabs: ${(err as Error).message}`,
		);
	}
}

export async function duplicateDashboard(
	dbClient: DatabaseInstance,
	dashboardId: string,
	userId: string,
): Promise<Dashboard> {
	try {
		// Get original dashboard with widgets
		const original = await findDashboardById(dbClient, dashboardId);

		if (!original) {
			throw AppError.notFound("Dashboard not found");
		}

		// Create new dashboard
		const newDashboard = await createDashboard(dbClient, {
			createdBy: userId,
			defaultFilters: original.defaultFilters,
			description: original.description,
			layout: original.layout,
			name: `${original.name} (Copy)`,
			organizationId: original.organizationId,
		});

		// Copy widgets
		if (original.widgets && original.widgets.length > 0) {
			await dbClient.insert(dashboardWidget).values(
				original.widgets.map((w) => ({
					config: w.config,
					dashboardId: newDashboard.id,
					name: w.name,
					position: w.position,
					type: w.type,
				})),
			);
		}

		// Copy filters
		if (original.filters && original.filters.length > 0) {
			await dbClient.insert(dashboardFilter).values(
				original.filters.map((f) => ({
					dashboardId: newDashboard.id,
					filterConfig: f.filterConfig,
					isDefault: f.isDefault,
					name: f.name,
				})),
			);
		}

		return newDashboard;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to duplicate dashboard: ${(err as Error).message}`,
		);
	}
}

// ============================================
// Default Dashboard
// ============================================

export async function findDefaultDashboard(
	dbClient: DatabaseInstance,
	organizationId: string,
): Promise<Dashboard | undefined> {
	try {
		const result = await dbClient.query.dashboard.findFirst({
			where: (d, { and: andOp, eq: eqOp }) =>
				andOp(
					eqOp(d.organizationId, organizationId),
					eqOp(d.isPinned, true),
				),
			orderBy: (d, { asc: ascOp }) => ascOp(d.tabOrder),
		});

		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find default dashboard: ${(err as Error).message}`,
		);
	}
}

export async function createDefaultDashboard(
	dbClient: DatabaseInstance,
	organizationId: string,
	userId: string,
): Promise<Dashboard> {
	try {
		// Create the default "Home" dashboard
		const newDashboard = await createDashboard(dbClient, {
			createdBy: userId,
			description: "Your financial overview at a glance",
			isPinned: true,
			layout: {
				gridColumns: 12,
				gridRowHeight: 100,
			},
			name: "Home",
			organizationId,
			tabOrder: 0,
		});

		// Add default widgets
		const defaultWidgets: NewDashboardWidget[] = [
			{
				config: {
					type: "balance_card",
					showComparison: true,
				},
				dashboardId: newDashboard.id,
				name: "Balance Overview",
				position: { x: 0, y: 0, w: 6, h: 2, minW: 4, minH: 2 },
				type: "balance_card",
			},
			{
				config: {
					type: "quick_actions",
					actions: ["new_transaction", "reports", "payables", "receivables"],
				},
				dashboardId: newDashboard.id,
				name: "Quick Actions",
				position: { x: 6, y: 0, w: 6, h: 2, minW: 4, minH: 2 },
				type: "quick_actions",
			},
			{
				config: {
					type: "bank_accounts",
					limit: 3,
					showCreateButton: true,
				},
				dashboardId: newDashboard.id,
				name: "Bank Accounts",
				position: { x: 0, y: 2, w: 12, h: 2, minW: 6, minH: 2 },
				type: "bank_accounts",
			},
			{
				config: {
					type: "recent_transactions",
					limit: 5,
				},
				dashboardId: newDashboard.id,
				name: "Recent Transactions",
				position: { x: 0, y: 4, w: 12, h: 3, minW: 6, minH: 2 },
				type: "recent_transactions",
			},
		];

		await dbClient.insert(dashboardWidget).values(defaultWidgets);

		return newDashboard;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to create default dashboard: ${(err as Error).message}`,
		);
	}
}

export async function ensureDefaultDashboard(
	dbClient: DatabaseInstance,
	organizationId: string,
	userId: string,
): Promise<Dashboard> {
	try {
		// Check if a pinned dashboard exists
		const existing = await findDefaultDashboard(dbClient, organizationId);

		if (existing) {
			return existing;
		}

		// Create default dashboard if none exists
		return await createDefaultDashboard(dbClient, organizationId, userId);
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to ensure default dashboard: ${(err as Error).message}`,
		);
	}
}

export async function setDashboardAsDefault(
	dbClient: DatabaseInstance,
	dashboardId: string,
	organizationId: string,
): Promise<Dashboard> {
	try {
		// First, unpin all dashboards for this organization
		await dbClient
			.update(dashboard)
			.set({ isPinned: false, updatedAt: new Date() })
			.where(eq(dashboard.organizationId, organizationId));

		// Pin the specified dashboard
		const result = await dbClient
			.update(dashboard)
			.set({ isPinned: true, updatedAt: new Date() })
			.where(eq(dashboard.id, dashboardId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Dashboard not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to set dashboard as default: ${(err as Error).message}`,
		);
	}
}

// ============================================
// Widget CRUD
// ============================================

export async function addWidget(
	dbClient: DatabaseInstance,
	data: NewDashboardWidget,
): Promise<DashboardWidget> {
	try {
		const result = await dbClient
			.insert(dashboardWidget)
			.values(data)
			.returning();

		if (!result[0]) {
			throw AppError.database("Failed to add widget");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to add widget: ${(err as Error).message}`,
		);
	}
}

export async function updateWidget(
	dbClient: DatabaseInstance,
	widgetId: string,
	data: Partial<Pick<DashboardWidget, "name" | "config" | "position">>,
): Promise<DashboardWidget> {
	try {
		const result = await dbClient
			.update(dashboardWidget)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(dashboardWidget.id, widgetId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Widget not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to update widget: ${(err as Error).message}`,
		);
	}
}

export async function removeWidget(
	dbClient: DatabaseInstance,
	widgetId: string,
): Promise<DashboardWidget> {
	try {
		const result = await dbClient
			.delete(dashboardWidget)
			.where(eq(dashboardWidget.id, widgetId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Widget not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to remove widget: ${(err as Error).message}`,
		);
	}
}

export async function updateWidgetPositions(
	dbClient: DatabaseInstance,
	positions: Array<{ widgetId: string; position: WidgetPosition }>,
): Promise<void> {
	try {
		await Promise.all(
			positions.map(({ widgetId, position }) =>
				dbClient
					.update(dashboardWidget)
					.set({ position, updatedAt: new Date() })
					.where(eq(dashboardWidget.id, widgetId)),
			),
		);
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to update widget positions: ${(err as Error).message}`,
		);
	}
}

export async function findWidgetsByDashboardId(
	dbClient: DatabaseInstance,
	dashboardId: string,
): Promise<DashboardWidget[]> {
	try {
		const widgets = await dbClient.query.dashboardWidget.findMany({
			where: (w, { eq: eqOp }) => eqOp(w.dashboardId, dashboardId),
			orderBy: (w, { asc: ascOp }) => ascOp(w.createdAt),
		});

		return widgets;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find widgets: ${(err as Error).message}`,
		);
	}
}

// ============================================
// Dashboard Filter CRUD
// ============================================

export async function createDashboardFilter(
	dbClient: DatabaseInstance,
	data: NewDashboardFilter,
): Promise<DashboardFilter> {
	try {
		const result = await dbClient
			.insert(dashboardFilter)
			.values(data)
			.returning();

		if (!result[0]) {
			throw AppError.database("Failed to create dashboard filter");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to create dashboard filter: ${(err as Error).message}`,
		);
	}
}

export async function deleteDashboardFilter(
	dbClient: DatabaseInstance,
	filterId: string,
): Promise<DashboardFilter> {
	try {
		const result = await dbClient
			.delete(dashboardFilter)
			.where(eq(dashboardFilter.id, filterId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Dashboard filter not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to delete dashboard filter: ${(err as Error).message}`,
		);
	}
}

export async function setDefaultDashboardFilter(
	dbClient: DatabaseInstance,
	dashboardId: string,
	filterId: string,
): Promise<void> {
	try {
		// First, unset all default filters for this dashboard
		await dbClient
			.update(dashboardFilter)
			.set({ isDefault: false })
			.where(eq(dashboardFilter.dashboardId, dashboardId));

		// Set the specified filter as default
		await dbClient
			.update(dashboardFilter)
			.set({ isDefault: true })
			.where(eq(dashboardFilter.id, filterId));
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to set default dashboard filter: ${(err as Error).message}`,
		);
	}
}

// ============================================
// Saved Insight CRUD
// ============================================

export async function createSavedInsight(
	dbClient: DatabaseInstance,
	data: NewSavedInsight,
): Promise<SavedInsight> {
	try {
		const result = await dbClient
			.insert(savedInsight)
			.values(data)
			.returning();

		if (!result[0]) {
			throw AppError.database("Failed to create saved insight");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to create saved insight: ${(err as Error).message}`,
		);
	}
}

export async function updateSavedInsight(
	dbClient: DatabaseInstance,
	insightId: string,
	data: Partial<Pick<SavedInsight, "name" | "description" | "config">>,
): Promise<SavedInsight> {
	try {
		const result = await dbClient
			.update(savedInsight)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(eq(savedInsight.id, insightId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Saved insight not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to update saved insight: ${(err as Error).message}`,
		);
	}
}

export async function deleteSavedInsight(
	dbClient: DatabaseInstance,
	insightId: string,
): Promise<SavedInsight> {
	try {
		const result = await dbClient
			.delete(savedInsight)
			.where(eq(savedInsight.id, insightId))
			.returning();

		if (!result[0]) {
			throw AppError.notFound("Saved insight not found");
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to delete saved insight: ${(err as Error).message}`,
		);
	}
}

export async function findSavedInsightById(
	dbClient: DatabaseInstance,
	insightId: string,
) {
	try {
		const result = await dbClient.query.savedInsight.findFirst({
			where: (s, { eq: eqOp }) => eqOp(s.id, insightId),
			with: {
				createdByUser: {
					columns: {
						email: true,
						id: true,
						name: true,
					},
				},
			},
		});

		return result;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find saved insight: ${(err as Error).message}`,
		);
	}
}

export async function findSavedInsightsByOrganizationId(
	dbClient: DatabaseInstance,
	organizationId: string,
	options: { search?: string } = {},
) {
	const { search } = options;

	try {
		const conditions = [eq(savedInsight.organizationId, organizationId)];

		if (search) {
			conditions.push(ilike(savedInsight.name, `%${search}%`));
		}

		const whereClause = and(...conditions);

		const insights = await dbClient.query.savedInsight.findMany({
			orderBy: (s) => [desc(s.updatedAt)],
			where: () => whereClause,
			with: {
				createdByUser: {
					columns: {
						email: true,
						id: true,
						name: true,
					},
				},
			},
		});

		return insights;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to find saved insights: ${(err as Error).message}`,
		);
	}
}

// ============================================
// Recent Items
// ============================================

export async function recordRecentAccess(
	dbClient: DatabaseInstance,
	data: Omit<NewRecentItem, "id" | "accessedAt">,
): Promise<RecentItem> {
	try {
		// Check if this item already exists in recents
		const existing = await dbClient.query.recentItem.findFirst({
			where: (r, { and: andOp, eq: eqOp }) =>
				andOp(
					eqOp(r.userId, data.userId),
					eqOp(r.itemType, data.itemType),
					eqOp(r.itemId, data.itemId),
				),
		});

		if (existing) {
			// Update accessed time
			const result = await dbClient
				.update(recentItem)
				.set({ accessedAt: new Date(), itemName: data.itemName })
				.where(eq(recentItem.id, existing.id))
				.returning();

			return result[0]!;
		}

		// Insert new recent item
		const result = await dbClient
			.insert(recentItem)
			.values({
				...data,
				accessedAt: new Date(),
			})
			.returning();

		if (!result[0]) {
			throw AppError.database("Failed to record recent access");
		}

		// Clean up old items (keep only last 20)
		const allRecents = await dbClient.query.recentItem.findMany({
			orderBy: (r, { desc: descOp }) => descOp(r.accessedAt),
			where: (r, { eq: eqOp }) => eqOp(r.userId, data.userId),
		});

		if (allRecents.length > 20) {
			const toDelete = allRecents.slice(20);
			await Promise.all(
				toDelete.map((item) =>
					dbClient.delete(recentItem).where(eq(recentItem.id, item.id)),
				),
			);
		}

		return result[0];
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to record recent access: ${(err as Error).message}`,
		);
	}
}

export async function getRecentItems(
	dbClient: DatabaseInstance,
	userId: string,
	organizationId: string,
	limit = 10,
): Promise<RecentItem[]> {
	try {
		const recents = await dbClient.query.recentItem.findMany({
			limit,
			orderBy: (r, { desc: descOp }) => descOp(r.accessedAt),
			where: (r, { and: andOp, eq: eqOp }) =>
				andOp(eqOp(r.userId, userId), eqOp(r.organizationId, organizationId)),
		});

		return recents;
	} catch (err) {
		propagateError(err);
		throw AppError.database(
			`Failed to get recent items: ${(err as Error).message}`,
		);
	}
}
