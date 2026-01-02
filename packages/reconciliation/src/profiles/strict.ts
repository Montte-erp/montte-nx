import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import type { ReconciliationProfile } from "../types";

/**
 * Strict matching requires all conditions to pass (no weighted scoring).
 * Used for exact duplicate detection.
 */
export const strictConditionGroup: ConditionGroup = {
   id: "strict-duplicate-detection",
   operator: "AND",
   scoringMode: "binary",
   conditions: [
      {
         id: "amount-exact",
         type: "number",
         field: "candidate.amount",
         operator: "eq",
         valueRef: "target.amount",
      },
      {
         id: "date-exact",
         type: "date",
         field: "candidate.date",
         operator: "eq",
         valueRef: "target.date",
      },
      {
         id: "description-exact",
         type: "string",
         field: "candidate.description",
         operator: "eq",
         valueRef: "target.description",
         options: {
            caseSensitive: false,
            trim: true,
         },
      },
   ],
};

/**
 * Strict profile for exact matching on all fields
 */
export const strictProfile: ReconciliationProfile = {
   id: "strict",
   name: "Strict",
   description: "Exact match on all fields (amount, date, description)",
   conditionGroup: strictConditionGroup,
   threshold: 1.0,
};
