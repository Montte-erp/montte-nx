import {
   evaluateConditionGroup,
   type ConditionGroup,
   type EvaluationContext,
} from "@f-o-t/condition-evaluator";

const MIN_SCORE_TO_MATCH = 2;
const RUNNER_UP_MARGIN = 1.5;

export type TransactionLike = {
   id: string;
   name: string;
   contactName?: string | null;
};

export type CategoryLike = {
   id: string;
   name: string;
   keywords: string[] | null;
};

export type KeywordMatchReason =
   | "below-threshold"
   | "tie-or-too-close"
   | "matched";

export type KeywordMatchResult = {
   transactionId: string;
   matchedCategoryId: string | null;
   topScore: number;
   runnerUpScore: number;
   reason: KeywordMatchReason;
};

function buildGroup(category: CategoryLike): ConditionGroup | null {
   if (!category.keywords || category.keywords.length === 0) return null;

   const conditions = category.keywords.flatMap((keyword, index) => [
      {
         id: `${category.id}-name-${index}`,
         type: "string" as const,
         field: "transactionName",
         operator: "contains" as const,
         value: keyword,
         options: { caseSensitive: false, weight: 1 },
      },
      {
         id: `${category.id}-contact-${index}`,
         type: "string" as const,
         field: "contactName",
         operator: "contains" as const,
         value: keyword,
         options: { caseSensitive: false, weight: 1 },
      },
   ]);

   return {
      id: category.id,
      operator: "OR",
      scoringMode: "weighted",
      conditions,
   };
}

export function matchByKeywords(
   transactions: TransactionLike[],
   categories: CategoryLike[],
): KeywordMatchResult[] {
   const groups = categories
      .map((category) => ({
         categoryId: category.id,
         group: buildGroup(category),
      }))
      .filter(
         (entry): entry is { categoryId: string; group: ConditionGroup } =>
            entry.group !== null,
      );

   return transactions.map((tx) => {
      const context: EvaluationContext = {
         data: {
            transactionName: tx.name,
            contactName: tx.contactName ?? "",
         },
      };

      const scores = groups
         .map((entry) => ({
            categoryId: entry.categoryId,
            totalScore:
               evaluateConditionGroup(entry.group, context).totalScore ?? 0,
         }))
         .sort((a, b) => b.totalScore - a.totalScore);

      const top = scores[0];
      const runnerUp = scores[1];
      const runnerUpScore = runnerUp?.totalScore ?? 0;

      if (!top || top.totalScore < MIN_SCORE_TO_MATCH) {
         return {
            transactionId: tx.id,
            matchedCategoryId: null,
            topScore: top?.totalScore ?? 0,
            runnerUpScore,
            reason: "below-threshold",
         };
      }

      if (
         runnerUpScore > 0 &&
         top.totalScore <= runnerUpScore * RUNNER_UP_MARGIN
      ) {
         return {
            transactionId: tx.id,
            matchedCategoryId: null,
            topScore: top.totalScore,
            runnerUpScore,
            reason: "tie-or-too-close",
         };
      }

      return {
         transactionId: tx.id,
         matchedCategoryId: top.categoryId,
         topScore: top.totalScore,
         runnerUpScore,
         reason: "matched",
      };
   });
}
