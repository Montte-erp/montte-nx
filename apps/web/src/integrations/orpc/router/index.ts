import * as accountRouter from "./account";
import * as rubiRouter from "@modules/agents/router/chat";
import * as threadsRouter from "@modules/agents/router/threads";
import * as agentSettingsRouter from "./agent-settings";
import * as analyticsRouter from "./analytics";
import * as apiKeysRouter from "./api-keys";
import * as bankAccountsRouter from "./bank-accounts";
import * as billingRouter from "@modules/billing/router/billing";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as categoriesBulkRouter from "@modules/classification/router/categories-bulk";
import * as contactSettingsRouter from "./contact-settings";
import * as contactsRouter from "@modules/billing/router/contacts";
import * as couponsRouter from "@modules/billing/router/coupons";
import * as creditCardsRouter from "./credit-cards";
import * as customerPortalRouter from "@modules/billing/router/customer-portal";
import * as dashboardsRouter from "./dashboards";
import * as financialSettingsRouter from "./financial-settings";
import * as insightsRouter from "./insights";
import * as inventoryRouter from "./inventory";
import * as notificationsRouter from "./notifications";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as metersRouter from "@modules/billing/router/meters";
import * as pricesRouter from "@modules/billing/router/prices";
import * as servicesRouter from "@modules/billing/router/services";
import * as subscriptionItemsRouter from "@modules/billing/router/subscription-items";
import * as subscriptionsRouter from "@modules/billing/router/subscriptions";
import * as usageRouter from "@modules/billing/router/usage";
import * as sessionRouter from "./session";
import * as tagsRouter from "@modules/classification/router/tags";
import * as teamRouter from "./team";
import * as transactionsRouter from "./transactions";

export default {
   account: accountRouter,
   agentSettings: agentSettingsRouter,
   analytics: analyticsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   billing: billingRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   categoriesBulk: categoriesBulkRouter,
   contactSettings: contactSettingsRouter,
   contacts: contactsRouter,
   coupons: couponsRouter,
   customerPortal: customerPortalRouter,
   dashboards: dashboardsRouter,
   financialSettings: financialSettingsRouter,
   insights: insightsRouter,
   inventory: inventoryRouter,
   notifications: notificationsRouter,
   onboarding: onboardingRouter,
   prices: pricesRouter,
   services: servicesRouter,
   subscriptionItems: subscriptionItemsRouter,
   subscriptions: subscriptionsRouter,
   meters: metersRouter,
   benefits: benefitsRouter,
   usage: usageRouter,
   session: sessionRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
   rubi: rubiRouter,
   threads: threadsRouter,
};
