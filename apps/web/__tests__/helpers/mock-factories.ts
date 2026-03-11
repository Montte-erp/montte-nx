import type { BankAccount } from "@core/database/schemas/bank-accounts";
import type { Dashboard } from "@core/database/schemas/dashboards";
import type { Insight } from "@core/database/schemas/insights";
import type { PersonalApiKey } from "@core/database/schemas/personal-api-key";
import type { WebhookEndpoint } from "@core/database/schemas/webhooks";
import { TEST_ORG_ID, TEST_TEAM_ID, TEST_USER_ID } from "./create-test-context";

export const ENDPOINT_ID = "a0a0a0a0-b1b1-4c2c-9d3d-e4e4e4e4e4e4";
export const DASHBOARD_ID = "d0d0d0d0-e1e1-4f2f-a3a3-b4b4b4b4b4b4";
export const INSIGHT_ID = "a0a0a0a0-b1b1-4c2c-a3a3-d4d4d4d4d4d4";
export const KEY_ID = "a0a0a0a0-b1b1-4c2c-9d3d-e4e4e4e4e4e4";
export const BANK_ACCOUNT_ID = "ba000000-0000-4000-a000-000000000001";

export function makeWebhookEndpoint(
   overrides: Partial<WebhookEndpoint> = {},
): WebhookEndpoint {
   return {
      id: ENDPOINT_ID,
      organizationId: TEST_ORG_ID,
      teamId: TEST_TEAM_ID,
      url: "https://example.com/webhook",
      signingSecret: "whsec_1234567890abcdef",
      apiKeyId: null,
      eventPatterns: ["finance.transaction_created"],
      description: "Test webhook",
      isActive: true,
      failureCount: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
   };
}

export function makeDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
   return {
      id: DASHBOARD_ID,
      organizationId: TEST_ORG_ID,
      teamId: TEST_TEAM_ID,
      createdBy: TEST_USER_ID,
      name: "My Dashboard",
      description: "Test dashboard",
      isDefault: false,
      tiles: [],
      globalDateRange: null,
      globalFilters: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
   };
}

export function makeInsight(overrides: Partial<Insight> = {}): Insight {
   return {
      id: INSIGHT_ID,
      organizationId: TEST_ORG_ID,
      teamId: TEST_TEAM_ID,
      createdBy: TEST_USER_ID,
      name: "My Insight",
      description: "Test insight",
      type: "trends",
      config: { metric: "pageViews" },
      defaultSize: "md",
      cachedResults: null,
      lastComputedAt: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
   };
}

export function makePersonalApiKey(
   overrides: Partial<PersonalApiKey> = {},
): PersonalApiKey {
   return {
      id: KEY_ID,
      userId: TEST_USER_ID,
      label: "My API Key",
      keyHash: "hashed_key_value",
      keyPrefix: "AbCdEfGh",
      scopes: { content: "write", agent: "read" },
      organizationAccess: "all",
      lastUsedAt: null,
      createdAt: new Date("2026-01-15"),
      expiresAt: null,
      ...overrides,
   };
}

export function makeBankAccount(
   overrides: Partial<BankAccount> = {},
): BankAccount {
   return {
      id: BANK_ACCOUNT_ID,
      teamId: TEST_TEAM_ID,
      name: "Conta Corrente Principal",
      type: "checking",
      status: "active",
      color: "#6366f1",
      iconUrl: null,
      bankCode: "001",
      bankName: "Banco do Brasil",
      branch: "1234",
      accountNumber: "12345-6",
      initialBalance: "1000.00",
      initialBalanceDate: null,
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
   };
}
