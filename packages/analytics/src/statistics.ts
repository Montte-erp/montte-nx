/**
 * Statistical utilities for anomaly detection
 */

/**
 * Calculate the mean (average) of an array of numbers
 */
export function mean(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate the standard deviation of an array of numbers
 */
export function standardDeviation(values: number[]): number {
	if (values.length < 2) return 0;
	const avg = mean(values);
	const squaredDiffs = values.map((val) => (val - avg) ** 2);
	return Math.sqrt(mean(squaredDiffs));
}

/**
 * Calculate the Z-score for a value given the mean and standard deviation
 * Z-score indicates how many standard deviations a value is from the mean
 */
export function zScore(value: number, avg: number, stdDev: number): number {
	if (stdDev === 0) return 0;
	return (value - avg) / stdDev;
}

/**
 * Calculate the median of an array of numbers
 */
export function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? sorted[mid] ?? 0
		: ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Calculate the interquartile range (IQR)
 */
export function interquartileRange(values: number[]): {
	q1: number;
	q3: number;
	iqr: number;
} {
	if (values.length < 4) return { q1: 0, q3: 0, iqr: 0 };
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const lowerHalf = sorted.slice(0, mid);
	const upperHalf = sorted.slice(sorted.length % 2 === 0 ? mid : mid + 1);
	const q1 = median(lowerHalf);
	const q3 = median(upperHalf);
	return { iqr: q3 - q1, q1, q3 };
}

/**
 * Detect outliers using the IQR method
 * Values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR are considered outliers
 */
export function detectOutliersIQR(values: number[]): {
	outliers: number[];
	lowerBound: number;
	upperBound: number;
} {
	const { q1, q3, iqr } = interquartileRange(values);
	const lowerBound = q1 - 1.5 * iqr;
	const upperBound = q3 + 1.5 * iqr;
	const outliers = values.filter((v) => v < lowerBound || v > upperBound);
	return { lowerBound, outliers, upperBound };
}

/**
 * Detect outliers using Z-score method
 * Values with |Z-score| > threshold are considered outliers
 */
export function detectOutliersZScore(
	values: number[],
	threshold = 2.5,
): {
	outliers: Array<{ value: number; zScore: number }>;
	mean: number;
	stdDev: number;
} {
	const avg = mean(values);
	const stdDev = standardDeviation(values);

	const outliers = values
		.map((value) => ({ value, zScore: zScore(value, avg, stdDev) }))
		.filter((item) => Math.abs(item.zScore) > threshold);

	return { mean: avg, outliers, stdDev };
}

/**
 * Calculate the percentage change between two values
 */
export function percentageChange(oldValue: number, newValue: number): number {
	if (oldValue === 0) return newValue > 0 ? 100 : 0;
	return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate moving average over a window
 */
export function movingAverage(values: number[], windowSize: number): number[] {
	if (values.length < windowSize) return [];
	const result: number[] = [];
	for (let i = windowSize - 1; i < values.length; i++) {
		const window = values.slice(i - windowSize + 1, i + 1);
		result.push(mean(window));
	}
	return result;
}
