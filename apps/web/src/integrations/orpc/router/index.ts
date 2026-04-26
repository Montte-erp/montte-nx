import * as accountRouter from "./account";
import * as agentSettingsRouter from "./agent-settings";
import * as analyticsRouter from "./analytics";
import * as apiKeysRouter from "./api-keys";
import * as bankAccountsRouter from "./bank-accounts";
import * as benefitsRouter from "@modules/billing/router/benefits";
import * as billingRouter from "@modules/billing/router/billing";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as contactSettingsRouter from "./contact-settings";
import * as contactsRouter from "./contacts";
import * as couponsRouter from "@modules/billing/router/coupons";
import * as creditCardsRouter from "./credit-cards";
import * as customerPortalRouter from "@modules/billing/router/customer-portal";
import * as customersRouter from "@modules/billing/router/customers";
import * as dashboardsRouter from "./dashboards";
import * as financialSettingsRouter from "./financial-settings";
import * as insightsRouter from "./insights";
import * as inventoryRouter from "./inventory";
import * as notificationsRouter from "./notifications";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as servicesRouter from "@modules/billing/router/services";
import * as sessionRouter from "./session";
import * as subscriptionsRouter from "@modules/billing/router/subscriptions";
import * as tagsRouter from "@modules/classification/router/tags";
import * as teamRouter from "./team";
import * as transactionsRouter from "./transactions";
import * as usageRouter from "@modules/billing/router/usage";

const hyprpayRouter = {
   ...customersRouter,
   subscriptions: subscriptionsRouter,
   usage: usageRouter,
   benefits: benefitsRouter,
   customerPortal: customerPortalRouter,
   coupons: { validate: couponsRouter.validate },
};

export default {
   account: accountRouter,
   agentSettings: agentSettingsRouter,
   analytics: analyticsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   billing: billingRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   contactSettings: contactSettingsRouter,
   contacts: contactsRouter,
   coupons: couponsRouter,
   dashboards: dashboardsRouter,
   financialSettings: financialSettingsRouter,
   hyprpay: hyprpayRouter,
   insights: insightsRouter,
   inventory: inventoryRouter,
   notifications: notificationsRouter,
   onboarding: onboardingRouter,
   services: servicesRouter,
   session: sessionRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
};
