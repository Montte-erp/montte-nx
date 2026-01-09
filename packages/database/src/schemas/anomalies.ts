import { relations, sql } from "drizzle-orm";
import {
	boolean,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	decimal,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { transaction } from "./transactions";

// ============================================
// Enums
// ============================================

export const anomalyTypeEnum = pgEnum("anomaly_type", [
	"spending_spike",
	"unusual_category",
	"large_transaction",
	"unusual_time",
	"recurring_change",
]);

export const anomalySeverityEnum = pgEnum("anomaly_severity", [
	"low",
	"medium",
	"high",
]);

// ============================================
// Types
// ============================================

export type AnomalyMetadata = {
	// For spending_spike
	expectedAmount?: number;
	actualAmount?: number;
	percentageAboveNormal?: number;
	// For unusual_category
	categoryId?: string;
	categoryName?: string;
	normalSpendingRange?: { min: number; max: number };
	// For large_transaction
	threshold?: number;
	// For unusual_time
	transactionHour?: number;
	transactionDayOfWeek?: number;
	// Statistical data
	zScore?: number;
	mean?: number;
	standardDeviation?: number;
	// Period data
	periodStart?: string;
	periodEnd?: string;
};

// ============================================
// Tables
// ============================================

export const anomaly = pgTable("anomaly", {
	id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	transactionId: uuid("transaction_id").references(() => transaction.id, {
		onDelete: "set null",
	}),
	type: anomalyTypeEnum("type").notNull(),
	severity: anomalySeverityEnum("severity").notNull(),
	title: text("title").notNull(),
	description: text("description"),
	amount: decimal("amount", { precision: 15, scale: 2 }),
	metadata: jsonb("metadata").$type<AnomalyMetadata>(),
	isAcknowledged: boolean("is_acknowledged").default(false).notNull(),
	acknowledgedAt: timestamp("acknowledged_at"),
	acknowledgedBy: uuid("acknowledged_by"),
	detectedAt: timestamp("detected_at").defaultNow().notNull(),
	expiresAt: timestamp("expires_at"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// Relations
// ============================================

export const anomalyRelations = relations(anomaly, ({ one }) => ({
	organization: one(organization, {
		fields: [anomaly.organizationId],
		references: [organization.id],
	}),
	transaction: one(transaction, {
		fields: [anomaly.transactionId],
		references: [transaction.id],
	}),
}));

// ============================================
// Type Inference
// ============================================

export type Anomaly = typeof anomaly.$inferSelect;
export type NewAnomaly = typeof anomaly.$inferInsert;
