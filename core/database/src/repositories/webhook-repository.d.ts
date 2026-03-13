import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateWebhookEndpointInput,
   type NewWebhookDelivery,
   type UpdateWebhookEndpointInput,
} from "../schemas/webhooks";
export declare function generateWebhookSecret(): string;
export declare function ensureWebhookOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   url: string;
   description: string | null;
   eventPatterns: string[];
   signingSecret: string;
   apiKeyId: string | null;
   isActive: boolean;
   failureCount: number;
   lastSuccessAt: Date | null;
   lastFailureAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function createWebhookEndpoint(
   db: DatabaseInstance,
   organizationId: string,
   teamId: string,
   data: CreateWebhookEndpointInput,
): Promise<{
   apiKeyId: string | null;
   createdAt: Date;
   description: string | null;
   eventPatterns: string[];
   failureCount: number;
   id: string;
   isActive: boolean;
   lastFailureAt: Date | null;
   lastSuccessAt: Date | null;
   organizationId: string;
   signingSecret: string;
   teamId: string;
   updatedAt: Date;
   url: string;
}>;
export declare function listWebhookEndpoints(
   db: DatabaseInstance,
   teamId: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      url: string;
      description: string | null;
      eventPatterns: string[];
      signingSecret: string;
      apiKeyId: string | null;
      isActive: boolean;
      failureCount: number;
      lastSuccessAt: Date | null;
      lastFailureAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function getWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
): Promise<{
   id: string;
   organizationId: string;
   teamId: string;
   url: string;
   description: string | null;
   eventPatterns: string[];
   signingSecret: string;
   apiKeyId: string | null;
   isActive: boolean;
   failureCount: number;
   lastSuccessAt: Date | null;
   lastFailureAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function updateWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
   data: UpdateWebhookEndpointInput,
): Promise<
   | {
        id: string;
        organizationId: string;
        teamId: string;
        url: string;
        description: string | null;
        eventPatterns: string[];
        signingSecret: string;
        apiKeyId: string | null;
        isActive: boolean;
        failureCount: number;
        lastSuccessAt: Date | null;
        lastFailureAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
     }
   | undefined
>;
export declare function deleteWebhookEndpoint(
   db: DatabaseInstance,
   webhookId: string,
): Promise<void>;
export declare function updateWebhookLastSuccess(
   db: DatabaseInstance,
   webhookId: string,
): Promise<void>;
export declare function incrementWebhookFailureCount(
   db: DatabaseInstance,
   webhookId: string,
): Promise<void>;
export declare function findMatchingWebhooks(
   db: DatabaseInstance,
   organizationId: string,
   eventName: string,
   teamId?: string,
): Promise<
   {
      id: string;
      organizationId: string;
      teamId: string;
      url: string;
      description: string | null;
      eventPatterns: string[];
      signingSecret: string;
      apiKeyId: string | null;
      isActive: boolean;
      failureCount: number;
      lastSuccessAt: Date | null;
      lastFailureAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function createWebhookDelivery(
   db: DatabaseInstance,
   data: NewWebhookDelivery,
): Promise<
   | {
        attemptNumber: number;
        createdAt: Date;
        deliveredAt: Date | null;
        errorMessage: string | null;
        eventId: string;
        eventName: string;
        httpStatusCode: number | null;
        id: string;
        maxAttempts: number;
        nextRetryAt: Date | null;
        payload: Record<string, unknown>;
        responseBody: string | null;
        status: string;
        url: string;
        webhookEndpointId: string;
     }
   | undefined
>;
export declare function updateWebhookDeliveryStatus(
   db: DatabaseInstance,
   deliveryId: string,
   data: {
      status: string;
      httpStatusCode?: number;
      responseBody?: string;
      errorMessage?: string;
      attemptNumber?: number;
      nextRetryAt?: Date;
      deliveredAt?: Date;
   },
): Promise<
   | {
        id: string;
        webhookEndpointId: string;
        eventId: string;
        url: string;
        eventName: string;
        payload: Record<string, unknown>;
        status: string;
        httpStatusCode: number | null;
        responseBody: string | null;
        errorMessage: string | null;
        attemptNumber: number;
        maxAttempts: number;
        nextRetryAt: Date | null;
        createdAt: Date;
        deliveredAt: Date | null;
     }
   | undefined
>;
export declare function getWebhookDeliveries(
   db: DatabaseInstance,
   webhookId: string,
   options?: {
      offset?: number;
      limit?: number;
   },
): Promise<
   {
      id: string;
      webhookEndpointId: string;
      eventId: string;
      url: string;
      eventName: string;
      payload: Record<string, unknown>;
      status: string;
      httpStatusCode: number | null;
      responseBody: string | null;
      errorMessage: string | null;
      attemptNumber: number;
      maxAttempts: number;
      nextRetryAt: Date | null;
      createdAt: Date;
      deliveredAt: Date | null;
   }[]
>;
//# sourceMappingURL=webhook-repository.d.ts.map
