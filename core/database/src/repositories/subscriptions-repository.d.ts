import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateSubscriptionInput,
   type UpdateSubscriptionInput,
} from "@core/database/schemas/subscriptions";
export declare function createSubscription(
   db: DatabaseInstance,
   teamId: string,
   data: CreateSubscriptionInput,
): Promise<{
   cancelAtPeriodEnd: boolean;
   canceledAt: Date | null;
   contactId: string;
   createdAt: Date;
   currentPeriodEnd: string | null;
   currentPeriodStart: string | null;
   endDate: string | null;
   externalId: string | null;
   id: string;
   negotiatedPrice: string;
   notes: string | null;
   source: "asaas" | "manual";
   startDate: string;
   status: "active" | "cancelled" | "completed";
   teamId: string;
   updatedAt: Date;
   variantId: string;
}>;
export declare function getSubscription(
   db: DatabaseInstance,
   id: string,
): Promise<{
   cancelAtPeriodEnd: boolean;
   canceledAt: Date | null;
   contactId: string;
   createdAt: Date;
   currentPeriodEnd: string | null;
   currentPeriodStart: string | null;
   endDate: string | null;
   externalId: string | null;
   id: string;
   negotiatedPrice: string;
   notes: string | null;
   source: "asaas" | "manual";
   startDate: string;
   status: "active" | "cancelled" | "completed";
   teamId: string;
   updatedAt: Date;
   variantId: string;
} | null>;
export declare function updateSubscription(
   db: DatabaseInstance,
   id: string,
   data: UpdateSubscriptionInput,
): Promise<{
   id: string;
   teamId: string;
   contactId: string;
   variantId: string;
   startDate: string;
   endDate: string | null;
   negotiatedPrice: string;
   notes: string | null;
   status: "active" | "cancelled" | "completed";
   source: "asaas" | "manual";
   externalId: string | null;
   currentPeriodStart: string | null;
   currentPeriodEnd: string | null;
   cancelAtPeriodEnd: boolean;
   canceledAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function listSubscriptionsByTeam(
   db: DatabaseInstance,
   teamId: string,
   status?: string,
): Promise<
   {
      id: string;
      teamId: string;
      contactId: string;
      variantId: string;
      startDate: string;
      endDate: string | null;
      negotiatedPrice: string;
      notes: string | null;
      status: "active" | "cancelled" | "completed";
      source: "asaas" | "manual";
      externalId: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      canceledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function listSubscriptionsByContact(
   db: DatabaseInstance,
   contactId: string,
): Promise<
   {
      id: string;
      teamId: string;
      contactId: string;
      variantId: string;
      startDate: string;
      endDate: string | null;
      negotiatedPrice: string;
      notes: string | null;
      status: "active" | "cancelled" | "completed";
      source: "asaas" | "manual";
      externalId: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      canceledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function upsertSubscriptionByExternalId(
   db: DatabaseInstance,
   externalId: string,
   data: CreateSubscriptionInput & {
      teamId: string;
   },
): Promise<{
   id: string;
   teamId: string;
   contactId: string;
   variantId: string;
   startDate: string;
   endDate: string | null;
   negotiatedPrice: string;
   notes: string | null;
   status: "active" | "cancelled" | "completed";
   source: "asaas" | "manual";
   externalId: string | null;
   currentPeriodStart: string | null;
   currentPeriodEnd: string | null;
   cancelAtPeriodEnd: boolean;
   canceledAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function countActiveSubscriptionsByVariant(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   {
      variantId: string;
      count: number;
   }[]
>;
export declare function ensureSubscriptionOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   cancelAtPeriodEnd: boolean;
   canceledAt: Date | null;
   contactId: string;
   createdAt: Date;
   currentPeriodEnd: string | null;
   currentPeriodStart: string | null;
   endDate: string | null;
   externalId: string | null;
   id: string;
   negotiatedPrice: string;
   notes: string | null;
   source: "asaas" | "manual";
   startDate: string;
   status: "active" | "cancelled" | "completed";
   teamId: string;
   updatedAt: Date;
   variantId: string;
}>;
export declare function listExpiringSoon(
   db: DatabaseInstance,
   teamId: string,
   withinDays?: number,
): Promise<
   {
      id: string;
      teamId: string;
      contactId: string;
      variantId: string;
      startDate: string;
      endDate: string | null;
      negotiatedPrice: string;
      notes: string | null;
      status: "active" | "cancelled" | "completed";
      source: "asaas" | "manual";
      externalId: string | null;
      currentPeriodStart: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      canceledAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
//# sourceMappingURL=subscriptions-repository.d.ts.map
