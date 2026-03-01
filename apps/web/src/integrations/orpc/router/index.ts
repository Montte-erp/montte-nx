import * as accountRouter from "./account";
import * as actionsRouter from "./actions";
import * as activityLogsRouter from "./activity-logs";
import * as agentRouter from "./agent";
import * as analyticsRouter from "./analytics";
import * as annotationsRouter from "./annotations";
import * as apiKeysRouter from "./api-keys";
import * as bankAccountsRouter from "./bank-accounts";
import * as billingRouter from "./billing";
import * as creditCardsRouter from "./credit-cards";
import * as categoriesRouter from "./categories";
import * as chatRouter from "./chat";
import * as dashboardsRouter from "./dashboards";
import * as dataSourcesRouter from "./data-sources";
import * as discussionsRouter from "./discussions";
import * as eventCatalogRouter from "./event-catalog";
import * as feedbackRouter from "./feedback";
import * as insightsRouter from "./insights";
import * as onboardingRouter from "./onboarding";
import * as organizationRouter from "./organization";
import * as personalApiKeyRouter from "./personal-api-key";
import * as productSettingsRouter from "./product-settings";
import * as propertyDefinitionsRouter from "./property-definitions";
import * as rolesRouter from "./roles";
import * as searchRouter from "./search";
import * as sessionRouter from "./session";
import * as ssoRouter from "./sso";
import * as subcategoriesRouter from "./subcategories";
import * as tagsRouter from "./tags";
import * as teamRouter from "./team";
import * as transactionsRouter from "./transactions";
import * as usageRouter from "./usage";
import * as webhooksRouter from "./webhooks";

export default {
   account: accountRouter,
   actions: actionsRouter,
   activityLogs: activityLogsRouter,
   agent: agentRouter,
   analytics: analyticsRouter,
   annotations: annotationsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   billing: billingRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   chat: chatRouter,
   dashboards: dashboardsRouter,
   dataSources: dataSourcesRouter,
   discussions: discussionsRouter,
   eventCatalog: eventCatalogRouter,
   feedback: feedbackRouter,
   insights: insightsRouter,
   onboarding: onboardingRouter,
   personalApiKey: personalApiKeyRouter,
   productSettings: productSettingsRouter,
   propertyDefinitions: propertyDefinitionsRouter,
   roles: rolesRouter,
   search: searchRouter,
   session: sessionRouter,
   sso: ssoRouter,
   subcategories: subcategoriesRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
   usage: usageRouter,
   webhooks: webhooksRouter,
};
