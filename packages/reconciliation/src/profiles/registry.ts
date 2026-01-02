import type { ReconciliationProfile } from "../types";
import { defaultProfile } from "./default";
import { strictProfile } from "./strict";
import { fuzzyProfile } from "./fuzzy";

/**
 * Registry of all available profiles
 */
export const profileRegistry: Map<string, ReconciliationProfile> = new Map([
	// Standard profiles
	["default", defaultProfile],
	["strict", strictProfile],
	["fuzzy", fuzzyProfile],
]);

/**
 * Get a profile by ID
 */
export function getProfile(id: string): ReconciliationProfile | undefined {
	return profileRegistry.get(id);
}

/**
 * Get a profile by ID, throwing if not found
 */
export function getProfileOrThrow(id: string): ReconciliationProfile {
	const profile = profileRegistry.get(id);
	if (!profile) {
		throw new Error(`Profile not found: ${id}`);
	}
	return profile;
}

/**
 * Get all available profiles
 */
export function getAllProfiles(): ReconciliationProfile[] {
	return Array.from(profileRegistry.values());
}

/**
 * Get profiles for a specific bank
 */
export function getProfilesByBank(bankId: string): ReconciliationProfile[] {
	return Array.from(profileRegistry.values()).filter(
		(p) => p.bankId === bankId,
	);
}

/**
 * Register a custom profile
 */
export function registerProfile(profile: ReconciliationProfile): void {
	profileRegistry.set(profile.id, profile);
}

/**
 * Create a custom profile with overrides
 */
export function createProfile(
	base: ReconciliationProfile,
	overrides: Partial<ReconciliationProfile>,
): ReconciliationProfile {
	return {
		...base,
		...overrides,
		id: overrides.id ?? `${base.id}-custom`,
	};
}
