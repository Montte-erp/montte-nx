import { Result } from "better-result";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { enqueueDeriveKeywordsJob } from "@modules/classification/jobs/derive-keywords-job";
import { classificationInternal } from "@modules/classification/router/middlewares";

type CategoryKeywordsSource = {
   id: string;
   name: string;
   description: string | null;
};

export async function enqueueCategoryKeywordsDerivation(
   context: Pick<
      ORPCContextWithOrganization,
      "organizationId" | "teamId" | "userId" | "pgBoss"
   >,
   category: CategoryKeywordsSource,
) {
   const queued = await enqueueDeriveKeywordsJob({
      boss: await context.pgBoss,
      input: {
         categoryId: category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: category.name,
         description: category.description,
      },
   });

   if (Result.isError(queued)) {
      throw classificationInternal(
         "Falha ao enfileirar derivação de palavras-chave.",
      );
   }
}

export async function enqueueCategoryKeywordsDerivations(
   context: Pick<
      ORPCContextWithOrganization,
      "organizationId" | "teamId" | "userId" | "pgBoss"
   >,
   categories: CategoryKeywordsSource[],
) {
   const queued = await Promise.allSettled(
      categories.map((category) =>
         enqueueCategoryKeywordsDerivation(context, category),
      ),
   );

   if (queued.some((result) => result.status === "rejected")) {
      throw classificationInternal(
         "Falha ao enfileirar derivação de palavras-chave.",
      );
   }
}
