import type { AuthInstance } from "@packages/authentication/server";
import type { DatabaseInstance } from "@packages/database/client";
import type { MinioClient } from "@packages/files/client";
import type { StripeClient } from "@packages/stripe";
import type { ResendClient } from "@packages/transactional/client";
import type { PostHog } from "posthog-node";
import { accountRouter } from "./routers/account";
import { accountDeletionRouter } from "./routers/account-deletion";
import { automationTemplateRouter } from "./routers/automation-templates";
import { automationRouter } from "./routers/automations";
import { bankAccountRouter } from "./routers/bank-accounts";
import { billingRouter } from "./routers/billing";
import { billRouter } from "./routers/bills";
import { brasilApiRouter } from "./routers/brasil-api";
import { budgetRouter } from "./routers/budgets";
import { categoryRouter } from "./routers/categories";
import { costCenterRouter } from "./routers/cost-centers";
import { counterpartyRouter } from "./routers/counterparties";
import { dashboardRouter } from "./routers/dashboards";
import { encryptionRouter } from "./routers/encryption";
import { expenseSplitsRouter } from "./routers/expense-splits";
import { goalsRouter } from "./routers/goals";
import { interestTemplateRouter } from "./routers/interest-templates";
import { notificationRouter } from "./routers/notifications";
import { onboardingRouter } from "./routers/onboarding";
import { organizationRouter } from "./routers/organization";
import { organizationInvitesRouter } from "./routers/organization-invites";
import { organizationTeamsRouter } from "./routers/organization-teams";
import { permissionsRouter } from "./routers/permissions";
import { pushNotificationRouter } from "./routers/push-notifications";
import { sessionRouter } from "./routers/session";
import { tagRouter } from "./routers/tags";
import { transactionRouter } from "./routers/transactions";
import { createTRPCContext as createTRPCContextInternal, router } from "./trpc";

export type { ReminderResult } from "@packages/notifications/bill-reminders";

export const appRouter = router({
   account: accountRouter,
   accountDeletion: accountDeletionRouter,
   automations: automationRouter,
   automationTemplates: automationTemplateRouter,
   bankAccounts: bankAccountRouter,
   billing: billingRouter,
   bills: billRouter,
   brasilApi: brasilApiRouter,
   budgets: budgetRouter,
   categories: categoryRouter,
   costCenters: costCenterRouter,
   counterparties: counterpartyRouter,
   dashboards: dashboardRouter,
   encryption: encryptionRouter,
   expenseSplits: expenseSplitsRouter,
   goals: goalsRouter,
   interestTemplates: interestTemplateRouter,
   notifications: notificationRouter,
   onboarding: onboardingRouter,
   organization: organizationRouter,
   organizationInvites: organizationInvitesRouter,
   organizationTeams: organizationTeamsRouter,
   permissions: permissionsRouter,
   pushNotifications: pushNotificationRouter,
   session: sessionRouter,
   tags: tagRouter,
   transactions: transactionRouter,
});

export const createApi = ({
   auth,
   db,
   minioClient,
   minioBucket,
   posthog,
   resendClient,
   stripeClient,
}: {
   minioBucket: string;
   auth: AuthInstance;
   db: DatabaseInstance;
   minioClient: MinioClient;
   posthog: PostHog;
   resendClient?: ResendClient;
   stripeClient?: StripeClient;
}) => {
   return {
      createTRPCContext: async ({
         request,
         responseHeaders,
      }: {
         request: Request;
         responseHeaders: Headers;
      }) =>
         await createTRPCContextInternal({
            auth,
            db,
            minioBucket,
            minioClient,
            posthog,
            request,
            resendClient,
            responseHeaders,
            stripeClient,
         }),
      trpcRouter: appRouter,
   };
};

export type AppRouter = typeof appRouter;
