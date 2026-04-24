export interface HyprPayListResult<T> {
   items: T[];
   total: number;
   page: number;
   limit: number;
   pages: number;
}

export interface CreateCustomerInput {
   name: string;
   email?: string;
   phone?: string;
   document?: string;
   externalId?: string;
}

export interface UpdateCustomerInput {
   name?: string;
   email?: string | null;
   phone?: string | null;
}

export interface ListCustomersInput {
   page?: number;
   limit?: number;
}

export interface CreateSubscriptionInput {
   customerId: string;
   items: Array<{ priceId: string; quantity?: number }>;
   couponCode?: string;
}

export interface CancelSubscriptionInput {
   subscriptionId: string;
   cancelAtPeriodEnd?: boolean;
}

export interface AddSubscriptionItemInput {
   subscriptionId: string;
   priceId: string;
   quantity?: number;
}

export interface UpdateSubscriptionItemInput {
   itemId: string;
   quantity?: number;
   negotiatedPrice?: string | null;
}

export interface IngestUsageInput {
   customerId: string;
   meterId: string;
   quantity: number;
   properties?: Record<string, unknown>;
   idempotencyKey?: string;
}

export interface ListUsageInput {
   customerId: string;
   meterId?: string;
}

export interface CheckBenefitInput {
   customerId: string;
   benefitId: string;
}

export interface ValidateCouponInput {
   code: string;
   priceId?: string;
}

export interface CreatePortalSessionInput {
   customerId: string;
}
