import * as accountRouter from "./account";
import * as actionsRouter from "./actions";
import * as activityLogsRouter from "./activity-logs";
import * as agentRouter from "./agent";
import * as analyticsRouter from "./analytics";
import * as annotationsRouter from "./annotations";

import * as bankAccountsRouter from "./bank-accounts";
import * as billingRouter from "./billing";
import * as billsRouter from "./bills";
import * as budgetGoalsRouter from "./budget-goals";
import * as categoriesRouter from "./categories";
import * as chatRouter from "./chat";
import * as contactsRouter from "./contacts";
import * as creditCardsRouter from "./credit-cards";
import * as dashboardsRouter from "./dashboards";
import * as dataSourcesRouter from "./data-sources";
import * as discussionsRouter from "./discussions";
import * as earlyAccessRouter from "./early-access";
import * as eventCatalogRouter from "./event-catalog";
import * as feedbackRouter from "./feedback";
import * as insightsRouter from "./insights";
import * as inventoryRouter from "./inventory";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as personalApiKeyRouter from "./personal-api-key";
import * as productSettingsRouter from "./product-settings";
import * as propertyDefinitionsRouter from "./property-definitions";
import * as rolesRouter from "./roles";
import * as searchRouter from "./search";
import * as servicesRouter from "./services";
import * as sessionRouter from "./session";
import * as ssoRouter from "./sso";
import * as subcategoriesRouter from "./subcategories";
import * as tagsRouter from "./tags";
import * as teamRouter from "./team";
import * as transactionsRouter from "./transactions";
import * as webhooksRouter from "./webhooks";

export default {
   account: accountRouter,
   actions: actionsRouter,
   activityLogs: activityLogsRouter,
   agent: agentRouter,
   analytics: analyticsRouter,
   annotations: annotationsRouter,
   bankAccounts: bankAccountsRouter,
   bills: billsRouter,
   billing: billingRouter,
   budgetGoals: budgetGoalsRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   contacts: contactsRouter,
   chat: chatRouter,
   dashboards: dashboardsRouter,
   dataSources: dataSourcesRouter,
   earlyAccess: earlyAccessRouter,
   discussions: discussionsRouter,
   eventCatalog: eventCatalogRouter,
   feedback: feedbackRouter,
   insights: insightsRouter,
   inventory: inventoryRouter,
   onboarding: onboardingRouter,
   personalApiKey: personalApiKeyRouter,
   productSettings: productSettingsRouter,
   propertyDefinitions: propertyDefinitionsRouter,
   roles: rolesRouter,
   search: searchRouter,
   services: servicesRouter,
   session: sessionRouter,
   sso: ssoRouter,
   subcategories: subcategoriesRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
   webhooks: webhooksRouter,
};
