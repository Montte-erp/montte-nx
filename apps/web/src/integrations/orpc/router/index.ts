import * as accountRouter from "@modules/account/router/profile";
import * as agentChatRouter from "@modules/agents/router/chat";
import * as agentSettingsRouter from "@modules/account/router/agent-settings";
import * as apiKeysRouter from "@modules/account/router/api-keys";
import * as bankAccountsRouter from "@modules/cashbook/router/bank-accounts";
import * as creditCardsRouter from "@modules/cards/router/credit-cards";
import * as statementsRouter from "@modules/cards/router/statements";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as categoriesBulkRouter from "@modules/classification/router/categories-bulk";
import * as cnpjRouter from "@modules/account/router/cnpj";
import * as financialSettingsRouter from "@modules/account/router/financial-settings";
import * as inboxRouter from "@modules/inbox/router/inbox";
import * as reportsRouter from "@modules/insights/router/reports";
import * as workflowsRouter from "@modules/workflows/router";
import * as onboardingRouter from "@modules/account/router/onboarding";
import * as organizationRouter from "@modules/account/router/organization";
import * as sessionRouter from "@modules/account/router/session";
import * as tagsRouter from "@modules/classification/router/tags";
import * as teamRouter from "@modules/account/router/team";
import * as transactionsCrud from "@modules/cashbook/router/transactions";
import * as transactionsImports from "@modules/cashbook/router/imports";
import * as transactionsList from "@modules/cashbook/router/transactions-list";
import * as transactionsStatus from "@modules/cashbook/router/transactions-status";
import * as transactionsSuggestions from "@modules/cashbook/router/transactions-suggestions";

const transactionsRouter = {
   ...transactionsCrud,
   ...transactionsImports,
   ...transactionsList,
   ...transactionsStatus,
   ...transactionsSuggestions,
};

export default {
   account: accountRouter,
   agentSettings: agentSettingsRouter,
   apiKeys: apiKeysRouter,
   bankAccounts: bankAccountsRouter,
   creditCards: creditCardsRouter,
   categories: categoriesRouter,
   categoriesBulk: categoriesBulkRouter,
   cnpj: cnpjRouter,
   financialSettings: financialSettingsRouter,
   inbox: inboxRouter,
   reports: reportsRouter,
   onboarding: onboardingRouter,
   session: sessionRouter,
   statements: statementsRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   workflows: workflowsRouter,
   organization: organizationRouter,
   threads: {
      create: agentChatRouter.create,
      chat: agentChatRouter.chat,
      getById: agentChatRouter.getById,
      list: agentChatRouter.list,
      remove: agentChatRouter.remove,
      removeBulk: agentChatRouter.removeBulk,
      removeMessage: agentChatRouter.removeMessage,
      saveAssistantMessage: agentChatRouter.saveAssistantMessage,
      update: agentChatRouter.update,
   },
};
