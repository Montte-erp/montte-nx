import {
   type Condition,
   type ConditionGroup,
   isConditionGroup,
} from "@f-o-t/condition-evaluator";
import type {
   ConsequenceDefinitions,
   DefaultConsequences,
} from "../types/consequence";
import type { Rule, RuleSet } from "../types/rule";

export type IntegrityIssue = {
   readonly code: string;
   readonly message: string;
   readonly severity: "error" | "warning" | "info";
   readonly path?: string;
   readonly ruleId?: string;
   readonly details?: Readonly<Record<string, unknown>>;
};

export type IntegrityCheckResult = {
   readonly valid: boolean;
   readonly issues: ReadonlyArray<IntegrityIssue>;
};

export type IntegrityCheckOptions = {
   readonly checkCircularReferences?: boolean;
   readonly checkOrphanedRuleSets?: boolean;
   readonly checkMissingReferences?: boolean;
   readonly checkFieldConsistency?: boolean;
   readonly requiredFields?: ReadonlyArray<string>;
   readonly allowedCategories?: ReadonlyArray<string>;
   readonly allowedTags?: ReadonlyArray<string>;
};

const DEFAULT_OPTIONS: IntegrityCheckOptions = {
   checkCircularReferences: true,
   checkOrphanedRuleSets: true,
   checkMissingReferences: true,
   checkFieldConsistency: true,
};

const createIssue = (
   code: string,
   message: string,
   severity: "error" | "warning" | "info",
   details?: {
      path?: string;
      ruleId?: string;
      extra?: Record<string, unknown>;
   },
): IntegrityIssue => ({
   code,
   message,
   severity,
   path: details?.path,
   ruleId: details?.ruleId,
   details: details?.extra,
});

const collectAllFields = (condition: ConditionGroup): Set<string> => {
   const fields = new Set<string>();

   const traverse = (c: Condition | ConditionGroup) => {
      if (isConditionGroup(c)) {
         for (const child of c.conditions) {
            traverse(child as Condition | ConditionGroup);
         }
      } else {
         fields.add(c.field);
      }
   };

   traverse(condition);
   return fields;
};

const checkDuplicateConditionIds = (
   condition: ConditionGroup,
   ruleId: string,
): ReadonlyArray<IntegrityIssue> => {
   const issues: IntegrityIssue[] = [];
   const seenIds = new Map<string, number>();

   const traverse = (c: Condition | ConditionGroup, path: string) => {
      const id = c.id;
      const count = seenIds.get(id) ?? 0;
      seenIds.set(id, count + 1);

      if (count > 0) {
         issues.push(
            createIssue(
               "DUPLICATE_CONDITION_ID",
               `Duplicate condition ID "${id}" found within rule`,
               "error",
               { path, ruleId, extra: { conditionId: id } },
            ),
         );
      }

      if (isConditionGroup(c)) {
         c.conditions.forEach((child, i) => {
            traverse(child as Condition | ConditionGroup, `${path}[${i}]`);
         });
      }
   };

   traverse(condition, "conditions");
   return issues;
};

const checkRuleIntegrity = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rule: Rule<TContext, TConsequences>,
   options: IntegrityCheckOptions,
): ReadonlyArray<IntegrityIssue> => {
   const issues: IntegrityIssue[] = [];

   issues.push(...checkDuplicateConditionIds(rule.conditions, rule.id));

   if (rule.priority < 0) {
      issues.push(
         createIssue(
            "NEGATIVE_PRIORITY",
            `Rule "${rule.name}" has negative priority: ${rule.priority}`,
            "warning",
            { ruleId: rule.id, extra: { priority: rule.priority } },
         ),
      );
   }

   if (rule.priority > 1000) {
      issues.push(
         createIssue(
            "EXTREME_PRIORITY",
            `Rule "${rule.name}" has very high priority: ${rule.priority}`,
            "info",
            { ruleId: rule.id, extra: { priority: rule.priority } },
         ),
      );
   }

   if (rule.consequences.length === 0) {
      issues.push(
         createIssue(
            "NO_CONSEQUENCES",
            `Rule "${rule.name}" has no consequences defined`,
            "warning",
            { ruleId: rule.id },
         ),
      );
   }

   if (options.allowedCategories && rule.category) {
      if (!options.allowedCategories.includes(rule.category)) {
         issues.push(
            createIssue(
               "INVALID_CATEGORY",
               `Rule "${rule.name}" has invalid category: ${rule.category}`,
               "error",
               {
                  ruleId: rule.id,
                  extra: {
                     category: rule.category,
                     allowedCategories: [...options.allowedCategories],
                  },
               },
            ),
         );
      }
   }

   if (options.allowedTags) {
      const invalidTags = rule.tags.filter(
         (t) => !options.allowedTags?.includes(t),
      );
      if (invalidTags.length > 0) {
         issues.push(
            createIssue(
               "INVALID_TAGS",
               `Rule "${rule.name}" has invalid tags: ${invalidTags.join(", ")}`,
               "warning",
               {
                  ruleId: rule.id,
                  extra: {
                     invalidTags,
                     allowedTags: [...options.allowedTags],
                  },
               },
            ),
         );
      }
   }

   if (options.requiredFields) {
      const ruleFields = collectAllFields(rule.conditions);
      const missingFields = options.requiredFields.filter(
         (f) => !ruleFields.has(f),
      );
      if (missingFields.length > 0) {
         issues.push(
            createIssue(
               "MISSING_REQUIRED_FIELDS",
               `Rule "${rule.name}" is missing required fields: ${missingFields.join(", ")}`,
               "warning",
               { ruleId: rule.id, extra: { missingFields } },
            ),
         );
      }
   }

   return issues;
};

const checkRuleSetIntegrity = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   ruleSet: RuleSet,
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
): ReadonlyArray<IntegrityIssue> => {
   const issues: IntegrityIssue[] = [];
   const ruleIds = new Set(rules.map((r) => r.id));

   for (const ruleId of ruleSet.ruleIds) {
      if (!ruleIds.has(ruleId)) {
         issues.push(
            createIssue(
               "MISSING_RULE_REFERENCE",
               `RuleSet "${ruleSet.name}" references non-existent rule: ${ruleId}`,
               "error",
               { extra: { ruleSetId: ruleSet.id, missingRuleId: ruleId } },
            ),
         );
      }
   }

   if (ruleSet.ruleIds.length === 0) {
      issues.push(
         createIssue(
            "EMPTY_RULESET",
            `RuleSet "${ruleSet.name}" contains no rules`,
            "warning",
            { extra: { ruleSetId: ruleSet.id } },
         ),
      );
   }

   const duplicateIds = ruleSet.ruleIds.filter(
      (id, i) => ruleSet.ruleIds.indexOf(id) !== i,
   );
   if (duplicateIds.length > 0) {
      issues.push(
         createIssue(
            "DUPLICATE_RULESET_ENTRIES",
            `RuleSet "${ruleSet.name}" contains duplicate rule references: ${[...new Set(duplicateIds)].join(", ")}`,
            "warning",
            { extra: { ruleSetId: ruleSet.id, duplicateIds } },
         ),
      );
   }

   return issues;
};

const checkFieldConsistency = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
): ReadonlyArray<IntegrityIssue> => {
   const issues: IntegrityIssue[] = [];
   const fieldTypes = new Map<
      string,
      { type: string; ruleId: string; ruleName: string }[]
   >();

   for (const rule of rules) {
      const traverse = (c: Condition | ConditionGroup) => {
         if (isConditionGroup(c)) {
            for (const child of c.conditions) {
               traverse(child as Condition | ConditionGroup);
            }
         } else {
            const existing = fieldTypes.get(c.field) ?? [];
            existing.push({
               type: c.type,
               ruleId: rule.id,
               ruleName: rule.name,
            });
            fieldTypes.set(c.field, existing);
         }
      };

      traverse(rule.conditions);
   }

   for (const [field, types] of fieldTypes) {
      const uniqueTypes = [...new Set(types.map((t) => t.type))];
      if (uniqueTypes.length > 1) {
         issues.push(
            createIssue(
               "INCONSISTENT_FIELD_TYPE",
               `Field "${field}" is used with different types: ${uniqueTypes.join(", ")}`,
               "warning",
               {
                  extra: {
                     field,
                     types: uniqueTypes,
                     rules: types.map((t) => ({
                        id: t.ruleId,
                        name: t.ruleName,
                        type: t.type,
                     })),
                  },
               },
            ),
         );
      }
   }

   return issues;
};

export const checkIntegrity = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
   ruleSets: ReadonlyArray<RuleSet> = [],
   options: IntegrityCheckOptions = {},
): IntegrityCheckResult => {
   const opts = { ...DEFAULT_OPTIONS, ...options };
   const issues: IntegrityIssue[] = [];

   for (const rule of rules) {
      issues.push(...checkRuleIntegrity(rule, opts));
   }

   for (const ruleSet of ruleSets) {
      issues.push(...checkRuleSetIntegrity(ruleSet, rules));
   }

   if (opts.checkFieldConsistency) {
      issues.push(...checkFieldConsistency(rules));
   }

   return {
      valid: issues.filter((i) => i.severity === "error").length === 0,
      issues,
   };
};

export const checkRuleFieldCoverage = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
   expectedFields: ReadonlyArray<string>,
): {
   coveredFields: ReadonlyArray<string>;
   uncoveredFields: ReadonlyArray<string>;
   extraFields: ReadonlyArray<string>;
   coveragePercentage: number;
} => {
   const allFields = new Set<string>();

   for (const rule of rules) {
      const ruleFields = collectAllFields(rule.conditions);
      for (const field of ruleFields) {
         allFields.add(field);
      }
   }

   const expectedSet = new Set(expectedFields);
   const coveredFields = [...expectedFields].filter((f) => allFields.has(f));
   const uncoveredFields = [...expectedFields].filter((f) => !allFields.has(f));
   const extraFields = [...allFields].filter((f) => !expectedSet.has(f));

   return {
      coveredFields,
      uncoveredFields,
      extraFields,
      coveragePercentage:
         expectedFields.length > 0
            ? (coveredFields.length / expectedFields.length) * 100
            : 100,
   };
};

export const getUsedFields = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
): ReadonlyArray<string> => {
   const fields = new Set<string>();

   for (const rule of rules) {
      const ruleFields = collectAllFields(rule.conditions);
      for (const field of ruleFields) {
         fields.add(field);
      }
   }

   return [...fields].sort();
};

export const getUsedOperators = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
): ReadonlyArray<{ field: string; operator: string; type: string }> => {
   const operators: Array<{ field: string; operator: string; type: string }> =
      [];
   const seen = new Set<string>();

   for (const rule of rules) {
      const traverse = (c: Condition | ConditionGroup) => {
         if (isConditionGroup(c)) {
            for (const child of c.conditions) {
               traverse(child as Condition | ConditionGroup);
            }
         } else {
            const key = `${c.field}:${c.operator}:${c.type}`;
            if (!seen.has(key)) {
               seen.add(key);
               operators.push({
                  field: c.field,
                  operator: c.operator,
                  type: c.type,
               });
            }
         }
      };

      traverse(rule.conditions);
   }

   return operators;
};

export const formatIntegrityResult = (result: IntegrityCheckResult): string => {
   if (result.valid && result.issues.length === 0) {
      return "Integrity check passed - no issues found";
   }

   const lines: string[] = [
      result.valid
         ? `Integrity check passed with ${result.issues.length} warning(s)`
         : `Integrity check failed with ${result.issues.filter((i) => i.severity === "error").length} error(s)`,
   ];

   const grouped = {
      error: result.issues.filter((i) => i.severity === "error"),
      warning: result.issues.filter((i) => i.severity === "warning"),
      info: result.issues.filter((i) => i.severity === "info"),
   };

   for (const [severity, issues] of Object.entries(grouped)) {
      if (issues.length > 0) {
         lines.push(`\n${severity.toUpperCase()}S (${issues.length}):`);
         for (const issue of issues) {
            lines.push(`  - [${issue.code}] ${issue.message}`);
         }
      }
   }

   return lines.join("\n");
};
