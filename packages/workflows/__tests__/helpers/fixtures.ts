import type { Consequence } from "@packages/database/schema";
import type {
   TransactionEventData,
   WorkflowEvent,
} from "../../src/types/events";

type AutomationRule = {
   id: string;
   organizationId: string;
   name: string;
   description: string | null;
   enabled: boolean;
   trigger: unknown;
   conditions: unknown;
   priority: number;
   createdAt: Date;
   updatedAt: Date;
};

export function createTestEventData(
   overrides: Partial<TransactionEventData> = {},
): TransactionEventData {
   return {
      id: "tx-123",
      organizationId: "org-123",
      description: "Test transaction",
      amount: 100.5,
      type: "expense",
      date: "2024-01-15T10:00:00Z",
      bankAccountId: "bank-789",
      categoryIds: ["cat-1"],
      costCenterId: "cost-1",
      tagIds: ["tag-1"],
      ...overrides,
   };
}

export function createTestEvent(
   overrides: Partial<WorkflowEvent> = {},
): WorkflowEvent {
   return {
      id: `event-${Date.now()}`,
      type: "transaction.created",
      organizationId: "org-123",
      timestamp: new Date().toISOString(),
      data: createTestEventData(),
      ...overrides,
   } as WorkflowEvent;
}

export function createTestConsequence(overrides: Partial<Consequence> = {}): Consequence {
   return {
      type: "set_category",
      payload: { categoryId: "cat-123" },
      ...overrides,
   } as Consequence;
}

export function createTestRule(
   overrides: Partial<AutomationRule> = {},
): AutomationRule {
   return {
      id: `rule-${Date.now()}`,
      organizationId: "org-123",
      name: "Test Rule",
      description: "A test automation rule",
      enabled: true,
      trigger: {
         type: "transaction.created",
         config: {},
      },
      conditions: {
         all: [
            {
               field: "amount",
               operator: "gt",
               value: 50,
            },
         ],
      },
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
   } as AutomationRule;
}

export function createSetCategoryConsequence(categoryId = "cat-123"): Consequence {
   return createTestConsequence({
      type: "set_category",
      payload: { categoryId },
   });
}

export function createAddTagConsequence(tagId = "tag-123"): Consequence {
   return createTestConsequence({
      type: "add_tag",
      payload: { tagIds: [tagId] },
   });
}

export function createRemoveTagConsequence(tagId = "tag-123"): Consequence {
   return createTestConsequence({
      type: "remove_tag",
      payload: { tagIds: [tagId] },
   });
}

export function createSetCostCenterConsequence(costCenterId = "cost-123"): Consequence {
   return createTestConsequence({
      type: "set_cost_center",
      payload: { costCenterId },
   });
}

export function createUpdateDescriptionConsequence(
   value = "Updated: {{description}}",
): Consequence {
   return createTestConsequence({
      type: "update_description",
      payload: { value, template: true },
   });
}

export function createCreateTransactionConsequence(
   config: Record<string, unknown> = {},
): Consequence {
   return createTestConsequence({
      type: "create_transaction",
      payload: {
         type: "expense",
         amountFixed: 100,
         description: "Created by workflow",
         ...config,
      },
   });
}

export function createSendEmailConsequence(
   config: Record<string, unknown> = {},
): Consequence {
   return createTestConsequence({
      type: "send_email",
      payload: {
         to: "owner",
         subject: "Test Subject",
         body: "<p>Test body</p>",
         ...config,
      },
   });
}

export function createSendPushNotificationConsequence(
   config: Record<string, unknown> = {},
): Consequence {
   return createTestConsequence({
      type: "send_push_notification",
      payload: {
         title: "Test Title",
         body: "Test notification body",
         ...config,
      },
   });
}

export function createStopExecutionConsequence(reason = "Stop reason"): Consequence {
   return createTestConsequence({
      type: "stop_execution",
      payload: { reason },
   });
}

export const testOrganizationMembers = [
   {
      userId: "user-owner",
      role: "owner",
      user: {
         id: "user-owner",
         email: "owner@example.com",
         name: "Owner User",
      },
   },
   {
      userId: "user-member",
      role: "member",
      user: {
         id: "user-member",
         email: "member@example.com",
         name: "Member User",
      },
   },
];

export const testCategory = {
   id: "cat-123",
   organizationId: "org-123",
   name: "Test Category",
   type: "expense",
};

export const testTag = {
   id: "tag-123",
   organizationId: "org-123",
   name: "Test Tag",
};

export const testCostCenter = {
   id: "cost-123",
   organizationId: "org-123",
   name: "Test Cost Center",
};

export const testBankAccount = {
   id: "bank-123",
   organizationId: "org-123",
   name: "Test Bank Account",
   type: "checking",
};
