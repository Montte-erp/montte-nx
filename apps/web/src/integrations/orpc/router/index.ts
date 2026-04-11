import * as accountRouter from "./account";
import * as agentSettingsRouter from "./agent-settings";
import * as analyticsRouter from "./analytics";
import * as apiKeysRouter from "./api-keys";
import * as bankAccountsRouter from "./bank-accounts";
import * as billingRouter from "./billing";
import * as billsRouter from "./bills";
import * as budgetGoalsRouter from "./budget-goals";
import * as categoriesRouter from "./categories";
import * as contactSettingsRouter from "./contact-settings";
import * as contactsRouter from "./contacts";
import * as creditCardsRouter from "./credit-cards";
import * as dashboardsRouter from "./dashboards";
import * as financialSettingsRouter from "./financial-settings";
import * as insightsRouter from "./insights";
import * as inventoryRouter from "./inventory";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as servicesRouter from "./services";
import * as sessionRouter from "./session";
import * as tagsRouter from "./tags";
import * as teamRouter from "./team";
import * as transactionsRouter from "./transactions";

export default {
   account: accountRouter,
   agentSettings: agentSettingsRouter,
   analytics: analyticsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   bills: billsRouter,
   billing: billingRouter,
   budgetGoals: budgetGoalsRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   contactSettings: contactSettingsRouter,
   contacts: contactsRouter,
   dashboards: dashboardsRouter,
   financialSettings: financialSettingsRouter,
   insights: insightsRouter,
   inventory: inventoryRouter,
   onboarding: onboardingRouter,
   services: servicesRouter,
   session: sessionRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
};
