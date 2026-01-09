/**
 * Forecasting algorithms for spending predictions
 */

import { mean, standardDeviation } from "./statistics";

export type DataPoint = {
	date: Date | string;
	value: number;
};

export type ForecastPoint = {
	date: Date;
	value: number;
	lowerBound?: number;
	upperBound?: number;
	isForecasted: true;
};

export type ForecastResult = {
	forecasts: ForecastPoint[];
	model: "linear" | "moving_average" | "exponential_smoothing";
	confidenceLevel: number;
};

/**
 * Linear regression forecasting
 * Uses least squares method to fit a line and extrapolate
 */
export function linearForecast(
	data: DataPoint[],
	periods: number,
	confidenceLevel = 0.95,
): ForecastResult {
	if (data.length < 2) {
		return { forecasts: [], model: "linear", confidenceLevel };
	}

	// Convert dates to numeric values (days since first date)
	const firstDate = new Date(data[0]?.date ?? new Date());
	const values = data.map((d, i) => ({
		x: i,
		y: d.value,
	}));

	// Calculate linear regression coefficients
	const n = values.length;
	const sumX = values.reduce((sum, v) => sum + v.x, 0);
	const sumY = values.reduce((sum, v) => sum + v.y, 0);
	const sumXY = values.reduce((sum, v) => sum + v.x * v.y, 0);
	const sumXX = values.reduce((sum, v) => sum + v.x * v.x, 0);

	const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
	const intercept = (sumY - slope * sumX) / n;

	// Calculate standard error for confidence intervals
	const predictions = values.map((v) => slope * v.x + intercept);
	const residuals = values.map((v, i) => v.y - (predictions[i] ?? 0));
	const stdError = standardDeviation(residuals);
	const zScore = getZScore(confidenceLevel);

	// Estimate time interval between data points
	const lastDataDate = new Date(data[data.length - 1]?.date ?? new Date());
	const intervalMs = data.length > 1
		? (lastDataDate.getTime() - firstDate.getTime()) / (data.length - 1)
		: 24 * 60 * 60 * 1000; // Default to 1 day

	// Generate forecasts
	const forecasts: ForecastPoint[] = [];
	for (let i = 1; i <= periods; i++) {
		const x = n + i - 1;
		const predictedValue = slope * x + intercept;
		const margin = zScore * stdError * Math.sqrt(1 + 1 / n + ((x - sumX / n) ** 2) / (sumXX - (sumX ** 2) / n));

		forecasts.push({
			date: new Date(lastDataDate.getTime() + i * intervalMs),
			value: Math.max(0, predictedValue),
			lowerBound: Math.max(0, predictedValue - margin),
			upperBound: predictedValue + margin,
			isForecasted: true,
		});
	}

	return { forecasts, model: "linear", confidenceLevel };
}

/**
 * Moving average forecasting
 * Uses the average of the last N periods to predict future values
 */
export function movingAverageForecast(
	data: DataPoint[],
	periods: number,
	windowSize = 3,
	confidenceLevel = 0.95,
): ForecastResult {
	if (data.length < windowSize) {
		return { forecasts: [], model: "moving_average", confidenceLevel };
	}

	// Calculate the last moving average
	const recentValues = data.slice(-windowSize).map((d) => d.value);
	const forecastValue = mean(recentValues);

	// Calculate standard deviation for confidence intervals
	const allValues = data.map((d) => d.value);
	const stdDev = standardDeviation(allValues);
	const zScore = getZScore(confidenceLevel);
	const margin = zScore * stdDev / Math.sqrt(windowSize);

	// Estimate time interval between data points
	const firstDate = new Date(data[0]?.date ?? new Date());
	const lastDataDate = new Date(data[data.length - 1]?.date ?? new Date());
	const intervalMs = data.length > 1
		? (lastDataDate.getTime() - firstDate.getTime()) / (data.length - 1)
		: 24 * 60 * 60 * 1000; // Default to 1 day

	// Generate forecasts (moving average predicts same value for all future periods)
	const forecasts: ForecastPoint[] = [];
	for (let i = 1; i <= periods; i++) {
		forecasts.push({
			date: new Date(lastDataDate.getTime() + i * intervalMs),
			value: Math.max(0, forecastValue),
			lowerBound: Math.max(0, forecastValue - margin * Math.sqrt(i)),
			upperBound: forecastValue + margin * Math.sqrt(i),
			isForecasted: true,
		});
	}

	return { forecasts, model: "moving_average", confidenceLevel };
}

/**
 * Exponential smoothing forecasting (Simple Exponential Smoothing)
 * Gives more weight to recent observations
 */
export function exponentialSmoothingForecast(
	data: DataPoint[],
	periods: number,
	alpha = 0.3, // Smoothing factor (0 < alpha < 1)
	confidenceLevel = 0.95,
): ForecastResult {
	if (data.length < 2) {
		return { forecasts: [], model: "exponential_smoothing", confidenceLevel };
	}

	// Apply exponential smoothing
	let smoothedValue = data[0]?.value ?? 0;
	const smoothedValues: number[] = [smoothedValue];

	for (let i = 1; i < data.length; i++) {
		smoothedValue = alpha * (data[i]?.value ?? 0) + (1 - alpha) * smoothedValue;
		smoothedValues.push(smoothedValue);
	}

	// The last smoothed value becomes our forecast
	const forecastValue = smoothedValue;

	// Calculate residuals for confidence intervals
	const residuals = data.map((d, i) => d.value - (smoothedValues[i] ?? 0));
	const stdError = standardDeviation(residuals);
	const zScore = getZScore(confidenceLevel);

	// Estimate time interval between data points
	const firstDate = new Date(data[0]?.date ?? new Date());
	const lastDataDate = new Date(data[data.length - 1]?.date ?? new Date());
	const intervalMs = data.length > 1
		? (lastDataDate.getTime() - firstDate.getTime()) / (data.length - 1)
		: 24 * 60 * 60 * 1000; // Default to 1 day

	// Generate forecasts
	const forecasts: ForecastPoint[] = [];
	for (let i = 1; i <= periods; i++) {
		// Error grows with forecast horizon
		const margin = zScore * stdError * Math.sqrt(
			(1 + (1 - alpha) ** (2 * i)) * alpha / (2 - alpha),
		);

		forecasts.push({
			date: new Date(lastDataDate.getTime() + i * intervalMs),
			value: Math.max(0, forecastValue),
			lowerBound: Math.max(0, forecastValue - margin),
			upperBound: forecastValue + margin,
			isForecasted: true,
		});
	}

	return { forecasts, model: "exponential_smoothing", confidenceLevel };
}

/**
 * Main forecasting function that selects the appropriate model
 */
export function forecast(
	data: DataPoint[],
	model: "linear" | "moving_average" | "exponential_smoothing",
	periods: number,
	options: {
		confidenceLevel?: number;
		windowSize?: number;
		alpha?: number;
	} = {},
): ForecastResult {
	const { confidenceLevel = 0.95, windowSize = 3, alpha = 0.3 } = options;

	switch (model) {
		case "linear":
			return linearForecast(data, periods, confidenceLevel);
		case "moving_average":
			return movingAverageForecast(data, periods, windowSize, confidenceLevel);
		case "exponential_smoothing":
			return exponentialSmoothingForecast(data, periods, alpha, confidenceLevel);
		default:
			return linearForecast(data, periods, confidenceLevel);
	}
}

/**
 * Get Z-score for common confidence levels
 */
function getZScore(confidenceLevel: number): number {
	// Common confidence level Z-scores
	if (confidenceLevel >= 0.99) return 2.576;
	if (confidenceLevel >= 0.95) return 1.96;
	if (confidenceLevel >= 0.90) return 1.645;
	if (confidenceLevel >= 0.80) return 1.282;
	return 1.96; // Default to 95%
}

/**
 * Evaluate forecast accuracy using Mean Absolute Percentage Error (MAPE)
 * Lower MAPE indicates better forecast accuracy
 */
export function calculateMAPE(
	actual: number[],
	predicted: number[],
): number {
	if (actual.length !== predicted.length || actual.length === 0) {
		return Number.NaN;
	}

	const errors = actual.map((a, i) => {
		if (a === 0) return 0;
		return Math.abs((a - (predicted[i] ?? 0)) / a);
	});

	return (mean(errors) * 100);
}

/**
 * Evaluate forecast accuracy using Root Mean Square Error (RMSE)
 */
export function calculateRMSE(
	actual: number[],
	predicted: number[],
): number {
	if (actual.length !== predicted.length || actual.length === 0) {
		return Number.NaN;
	}

	const squaredErrors = actual.map((a, i) => (a - (predicted[i] ?? 0)) ** 2);
	return Math.sqrt(mean(squaredErrors));
}
