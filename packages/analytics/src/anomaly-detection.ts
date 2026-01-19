import type { NewAnomaly } from "@packages/database/schemas/anomalies";
import {
	detectOutliersZScore,
	mean,
	percentageChange,
	standardDeviation,
	zScore,
} from "./statistics";

// ============================================
// Types
// ============================================

export interface TransactionData {
	id: string;
	amount: number;
	date: Date;
	type: "income" | "expense";
	categoryId?: string;
	categoryName?: string;
	description?: string;
}

export interface CategorySpending {
	categoryId: string;
	categoryName: string;
	totalAmount: number;
	transactionCount: number;
}

export interface DetectedAnomaly {
	type: "spending_spike" | "unusual_category" | "large_transaction" | "unusual_time";
	severity: "low" | "medium" | "high";
	transactionId?: string;
	amount?: number;
	title: string;
	description: string;
	metadata: Record<string, unknown>;
}

export interface AnomalyDetectionConfig {
	// Z-score thresholds for different anomaly types
	spendingSpikeThreshold?: number; // Default: 2.0
	largeTxThreshold?: number; // Default: 2.5
	categoryThreshold?: number; // Default: 2.0
	// Minimum data points required for detection
	minDataPoints?: number; // Default: 10
	// Large transaction absolute threshold (if no historical data)
	absoluteLargeTxThreshold?: number; // Default: 5000
}

const DEFAULT_CONFIG: Required<AnomalyDetectionConfig> = {
	absoluteLargeTxThreshold: 5000,
	categoryThreshold: 2.0,
	largeTxThreshold: 2.5,
	minDataPoints: 10,
	spendingSpikeThreshold: 2.0,
};

// ============================================
// Anomaly Detection Functions
// ============================================

/**
 * Detect spending spikes - daily/weekly spending significantly above normal
 */
export function detectSpendingSpikes(
	currentPeriodSpending: number,
	historicalSpending: number[],
	periodLabel: string,
	config: AnomalyDetectionConfig = {},
): DetectedAnomaly | null {
	const { spendingSpikeThreshold, minDataPoints } = { ...DEFAULT_CONFIG, ...config };

	if (historicalSpending.length < minDataPoints) {
		return null;
	}

	const avg = mean(historicalSpending);
	const stdDev = standardDeviation(historicalSpending);
	const z = zScore(currentPeriodSpending, avg, stdDev);

	if (z > spendingSpikeThreshold) {
		const percentAbove = percentageChange(avg, currentPeriodSpending);
		const severity = determineSeverity(z, spendingSpikeThreshold);

		return {
			amount: currentPeriodSpending,
			description: `Gastos de ${periodLabel} estão ${percentAbove.toFixed(0)}% acima da média histórica`,
			metadata: {
				actualAmount: currentPeriodSpending,
				expectedAmount: avg,
				mean: avg,
				percentageAboveNormal: percentAbove,
				standardDeviation: stdDev,
				zScore: z,
			},
			severity,
			title: `Pico de Gastos (${periodLabel})`,
			type: "spending_spike",
		};
	}

	return null;
}

/**
 * Detect unusually large individual transactions
 */
export function detectLargeTransactions(
	transactions: TransactionData[],
	historicalAmounts: number[],
	config: AnomalyDetectionConfig = {},
): DetectedAnomaly[] {
	const { largeTxThreshold, minDataPoints, absoluteLargeTxThreshold } = {
		...DEFAULT_CONFIG,
		...config,
	};

	const anomalies: DetectedAnomaly[] = [];

	// If we have enough historical data, use Z-score
	if (historicalAmounts.length >= minDataPoints) {
		const avg = mean(historicalAmounts);
		const stdDev = standardDeviation(historicalAmounts);

		for (const tx of transactions) {
			const amount = Math.abs(tx.amount);
			const z = zScore(amount, avg, stdDev);

			if (z > largeTxThreshold) {
				const severity = determineSeverity(z, largeTxThreshold);
				anomalies.push({
					amount,
					description: `Transação de R$ ${amount.toFixed(2)} é ${z.toFixed(1)}x maior que o desvio padrão`,
					metadata: {
						mean: avg,
						standardDeviation: stdDev,
						threshold: avg + largeTxThreshold * stdDev,
						zScore: z,
					},
					severity,
					title: "Transação de Alto Valor",
					transactionId: tx.id,
					type: "large_transaction",
				});
			}
		}
	} else {
		// Use absolute threshold if not enough historical data
		for (const tx of transactions) {
			const amount = Math.abs(tx.amount);
			if (amount > absoluteLargeTxThreshold) {
				anomalies.push({
					amount,
					description: `Transação de R$ ${amount.toFixed(2)} excede o limite de R$ ${absoluteLargeTxThreshold}`,
					metadata: {
						threshold: absoluteLargeTxThreshold,
					},
					severity: amount > absoluteLargeTxThreshold * 2 ? "high" : "medium",
					title: "Transação de Alto Valor",
					transactionId: tx.id,
					type: "large_transaction",
				});
			}
		}
	}

	return anomalies;
}

/**
 * Detect unusual spending in specific categories
 */
export function detectUnusualCategorySpending(
	currentCategorySpending: CategorySpending[],
	historicalCategorySpending: Map<string, number[]>,
	config: AnomalyDetectionConfig = {},
): DetectedAnomaly[] {
	const { categoryThreshold, minDataPoints } = { ...DEFAULT_CONFIG, ...config };
	const anomalies: DetectedAnomaly[] = [];

	for (const category of currentCategorySpending) {
		const historical = historicalCategorySpending.get(category.categoryId) || [];

		if (historical.length < minDataPoints) {
			continue;
		}

		const avg = mean(historical);
		const stdDev = standardDeviation(historical);
		const z = zScore(category.totalAmount, avg, stdDev);

		if (z > categoryThreshold) {
			const percentAbove = percentageChange(avg, category.totalAmount);
			const severity = determineSeverity(z, categoryThreshold);

			anomalies.push({
				amount: category.totalAmount,
				description: `Gastos na categoria "${category.categoryName}" estão ${percentAbove.toFixed(0)}% acima do normal`,
				metadata: {
					categoryId: category.categoryId,
					categoryName: category.categoryName,
					mean: avg,
					normalSpendingRange: {
						max: avg + stdDev,
						min: Math.max(0, avg - stdDev),
					},
					percentageAboveNormal: percentAbove,
					standardDeviation: stdDev,
					zScore: z,
				},
				severity,
				title: `Gastos Incomuns: ${category.categoryName}`,
				type: "unusual_category",
			});
		}
	}

	return anomalies;
}

/**
 * Detect transactions at unusual times
 */
export function detectUnusualTiming(
	transactions: TransactionData[],
	normalHours: { start: number; end: number } = { end: 22, start: 6 },
): DetectedAnomaly[] {
	const anomalies: DetectedAnomaly[] = [];

	for (const tx of transactions) {
		const hour = tx.date.getHours();
		const dayOfWeek = tx.date.getDay();

		// Check for transactions at unusual hours (midnight to early morning)
		if (hour < normalHours.start || hour > normalHours.end) {
			anomalies.push({
				amount: Math.abs(tx.amount),
				description: `Transação realizada às ${hour}:00 - horário incomum`,
				metadata: {
					transactionDayOfWeek: dayOfWeek,
					transactionHour: hour,
				},
				severity: "low",
				title: "Transação em Horário Incomum",
				transactionId: tx.id,
				type: "unusual_time",
			});
		}
	}

	return anomalies;
}

// ============================================
// Helper Functions
// ============================================

function determineSeverity(
	zScore: number,
	baseThreshold: number,
): "low" | "medium" | "high" {
	if (zScore > baseThreshold * 2) return "high";
	if (zScore > baseThreshold * 1.5) return "medium";
	return "low";
}

/**
 * Convert detected anomalies to database format
 */
export function toNewAnomalies(
	organizationId: string,
	anomalies: DetectedAnomaly[],
): NewAnomaly[] {
	return anomalies.map((anomaly) => ({
		amount: anomaly.amount?.toString(),
		description: anomaly.description,
		isAcknowledged: false,
		metadata: anomaly.metadata,
		organizationId,
		severity: anomaly.severity,
		title: anomaly.title,
		transactionId: anomaly.transactionId,
		type: anomaly.type,
	}));
}

/**
 * Run all anomaly detection on a set of transactions
 */
export function analyzeTransactions(
	transactions: TransactionData[],
	historicalAmounts: number[],
	historicalDailySpending: number[],
	historicalCategorySpending: Map<string, number[]>,
	config: AnomalyDetectionConfig = {},
): DetectedAnomaly[] {
	const allAnomalies: DetectedAnomaly[] = [];

	// Detect large transactions
	const largeTxAnomalies = detectLargeTransactions(
		transactions,
		historicalAmounts,
		config,
	);
	allAnomalies.push(...largeTxAnomalies);

	// Calculate current period spending
	const currentSpending = transactions
		.filter((tx) => tx.type === "expense")
		.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

	// Detect spending spikes
	const spendingSpike = detectSpendingSpikes(
		currentSpending,
		historicalDailySpending,
		"hoje",
		config,
	);
	if (spendingSpike) {
		allAnomalies.push(spendingSpike);
	}

	// Calculate current category spending
	const categorySpending = new Map<string, CategorySpending>();
	for (const tx of transactions.filter((t) => t.type === "expense" && t.categoryId)) {
		const existing = categorySpending.get(tx.categoryId!) || {
			categoryId: tx.categoryId!,
			categoryName: tx.categoryName || "Unknown",
			totalAmount: 0,
			transactionCount: 0,
		};
		existing.totalAmount += Math.abs(tx.amount);
		existing.transactionCount += 1;
		categorySpending.set(tx.categoryId!, existing);
	}

	// Detect unusual category spending
	const categoryAnomalies = detectUnusualCategorySpending(
		Array.from(categorySpending.values()),
		historicalCategorySpending,
		config,
	);
	allAnomalies.push(...categoryAnomalies);

	// Detect unusual timing
	const timingAnomalies = detectUnusualTiming(transactions);
	allAnomalies.push(...timingAnomalies);

	return allAnomalies;
}
