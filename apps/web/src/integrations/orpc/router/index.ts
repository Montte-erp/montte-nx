import * as accountRouter from "./account";
import * as agentRouter from "./agent";
import * as analyticsRouter from "./analytics";
import * as bankAccountsRouter from "./bank-accounts";
import * as billingRouter from "./billing";
import * as billsRouter from "./bills";
import * as budgetGoalsRouter from "./budget-goals";
import * as categoriesRouter from "./categories";
import * as chatRouter from "./chat";
import * as contactsRouter from "./contacts";
import * as creditCardsRouter from "./credit-cards";
import * as dashboardsRouter from "./dashboards";
import * as earlyAccessRouter from "./early-access";
import * as feedbackRouter from "./feedback";
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
   agent: agentRouter,
   analytics: analyticsRouter,
   bankAccounts: bankAccountsRouter,
   bills: billsRouter,
   billing: billingRouter,
   budgetGoals: budgetGoalsRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   contacts: contactsRouter,
   chat: chatRouter,
   dashboards: dashboardsRouter,
   earlyAccess: earlyAccessRouter,
   feedback: feedbackRouter,
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
