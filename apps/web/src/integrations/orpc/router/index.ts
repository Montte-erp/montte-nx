import * as accountRouter from "@modules/account/router/profile";
import * as threadsRouter from "@modules/agents/router/threads";
import * as agentSettingsRouter from "@modules/account/router/agent-settings";
import * as apiKeysRouter from "@modules/account/router/api-keys";
import * as bankAccountsRouter from "@modules/finance/router/bank-accounts";
import * as categoriesRouter from "@modules/classification/router/categories";
import * as categoriesBulkRouter from "@modules/classification/router/categories-bulk";
import * as cnpjRouter from "@modules/account/router/cnpj";
import * as creditCardsRouter from "@modules/finance/router/credit-cards";
import * as financialSettingsRouter from "@modules/account/router/financial-settings";
import * as inboxRouter from "@modules/inbox/router/inbox";
import * as onboardingRouter from "@modules/account/router/onboarding";
import * as organizationRouter from "@modules/account/router/organization";
import * as sessionRouter from "@modules/account/router/session";
import * as tagsRouter from "@modules/classification/router/tags";
import * as teamRouter from "@modules/account/router/team";
import * as transactionsCrud from "@modules/finance/router/transactions";
import * as transactionsBulk from "@modules/finance/router/transactions-bulk";
import * as transactionsList from "@modules/finance/router/transactions-list";
import * as transactionsStatus from "@modules/finance/router/transactions-status";
import * as transactionsSuggestions from "@modules/finance/router/transactions-suggestions";

const transactionsRouter = {
   ...transactionsCrud,
   ...transactionsBulk,
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
   onboarding: onboardingRouter,
   session: sessionRouter,
   tags: tagsRouter,
   team: teamRouter,
   transactions: transactionsRouter,
   organization: organizationRouter,
   threads: {
      create: threadsRouter.create,
      getById: threadsRouter.getById,
      list: threadsRouter.list,
      remove: threadsRouter.remove,
      removeBulk: threadsRouter.removeBulk,
      removeMessage: threadsRouter.removeMessage,
      saveAssistantMessage: threadsRouter.saveAssistantMessage,
      update: threadsRouter.update,
   },
};
