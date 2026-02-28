import * as accountRouter from "./account";
import * as actionsRouter from "./actions";
import * as activityLogsRouter from "./activity-logs";
import * as agentRouter from "./agent";
import * as analyticsRouter from "./analytics";
import * as annotationsRouter from "./annotations";
import * as apiKeysRouter from "./api-keys";
import * as billingRouter from "./billing";
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
import * as sessionRouter from "./session";
import * as ssoRouter from "./sso";
import * as teamRouter from "./team";
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
   billing: billingRouter,
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
   session: sessionRouter,
   sso: ssoRouter,
   team: teamRouter,
   organization: organizationRouter,
   usage: usageRouter,
   webhooks: webhooksRouter,
};
