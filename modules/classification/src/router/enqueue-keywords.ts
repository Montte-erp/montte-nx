import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import {
   enqueueDeriveKeywordsWorkflow,
   isClassificationWorkflowQueueFailure,
} from "@modules/classification/workflows/enqueue";

type CategoryKeywordsSource = {
   id: string;
   name: string;
   description: string | null;
};

export async function enqueueCategoryKeywordsDerivation(
   context: Pick<
      ORPCContextWithOrganization,
      "organizationId" | "teamId" | "userId" | "workflowClient"
   >,
   category: CategoryKeywordsSource,
) {
   const queued = await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
      categoryId: category.id,
      teamId: context.teamId,
      organizationId: context.organizationId,
      userId: context.userId,
      name: category.name,
      description: category.description,
   });

   if (isClassificationWorkflowQueueFailure(queued)) {
      throw WebAppError.internal(
         "Falha ao enfileirar derivação de palavras-chave.",
      );
   }
}

export async function enqueueCategoryKeywordsDerivations(
   context: Pick<
      ORPCContextWithOrganization,
      "organizationId" | "teamId" | "userId" | "workflowClient"
   >,
   categories: CategoryKeywordsSource[],
) {
   const queued = await Promise.allSettled(
      categories.map((category) =>
         enqueueCategoryKeywordsDerivation(context, category),
      ),
   );

   if (queued.some((result) => result.status === "rejected")) {
      throw WebAppError.internal(
         "Falha ao enfileirar derivação de palavras-chave.",
      );
   }
}
