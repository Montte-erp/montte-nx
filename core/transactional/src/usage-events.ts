export const TRANSACTIONAL_USAGE_EVENTS = {
   emailSent: "email.sent",
} as const;

export type TransactionalUsageEventName =
   (typeof TRANSACTIONAL_USAGE_EVENTS)[keyof typeof TRANSACTIONAL_USAGE_EVENTS];
