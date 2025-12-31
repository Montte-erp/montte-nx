import type {
   ConsequenceDefinitions,
   DefaultConsequences,
} from "../types/consequence";
import type { Rule } from "../types/rule";
import { collectConditionFields } from "../utils/conditions";

export type FieldIndex<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = Map<string, ReadonlyArray<Rule<TContext, TConsequences>>>;

export type TagIndex<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = Map<string, ReadonlyArray<Rule<TContext, TConsequences>>>;

export type CategoryIndex<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = Map<string, ReadonlyArray<Rule<TContext, TConsequences>>>;

export type PriorityIndex<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = Map<number, ReadonlyArray<Rule<TContext, TConsequences>>>;

export type RuleIndex<
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
> = {
   readonly byField: FieldIndex<TContext, TConsequences>;
   readonly byTag: TagIndex<TContext, TConsequences>;
   readonly byCategory: CategoryIndex<TContext, TConsequences>;
   readonly byPriority: PriorityIndex<TContext, TConsequences>;
   readonly byId: Map<string, Rule<TContext, TConsequences>>;
   readonly sortedByPriority: ReadonlyArray<Rule<TContext, TConsequences>>;
};

export type IndexOptions = {
   readonly indexByField?: boolean;
   readonly indexByTag?: boolean;
   readonly indexByCategory?: boolean;
   readonly indexByPriority?: boolean;
};

const DEFAULT_OPTIONS: IndexOptions = {
   indexByField: true,
   indexByTag: true,
   indexByCategory: true,
   indexByPriority: true,
};

export const buildIndex = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
   options: IndexOptions = {},
): RuleIndex<TContext, TConsequences> => {
   const opts = { ...DEFAULT_OPTIONS, ...options };

   const byId = new Map<string, Rule<TContext, TConsequences>>();
   const byField = new Map<string, Rule<TContext, TConsequences>[]>();
   const byTag = new Map<string, Rule<TContext, TConsequences>[]>();
   const byCategory = new Map<string, Rule<TContext, TConsequences>[]>();
   const byPriority = new Map<number, Rule<TContext, TConsequences>[]>();

   for (const rule of rules) {
      byId.set(rule.id, rule);

      if (opts.indexByField) {
         const fields = collectConditionFields(rule.conditions);
         for (const field of fields) {
            const existing = byField.get(field) ?? [];
            existing.push(rule);
            byField.set(field, existing);
         }
      }

      if (opts.indexByTag) {
         for (const tag of rule.tags) {
            const existing = byTag.get(tag) ?? [];
            existing.push(rule);
            byTag.set(tag, existing);
         }
      }

      if (opts.indexByCategory && rule.category) {
         const existing = byCategory.get(rule.category) ?? [];
         existing.push(rule);
         byCategory.set(rule.category, existing);
      }

      if (opts.indexByPriority) {
         const existing = byPriority.get(rule.priority) ?? [];
         existing.push(rule);
         byPriority.set(rule.priority, existing);
      }
   }

   const sortedByPriority = [...rules].sort((a, b) => b.priority - a.priority);

   return {
      byField: byField as FieldIndex<TContext, TConsequences>,
      byTag: byTag as TagIndex<TContext, TConsequences>,
      byCategory: byCategory as CategoryIndex<TContext, TConsequences>,
      byPriority: byPriority as PriorityIndex<TContext, TConsequences>,
      byId,
      sortedByPriority,
   };
};

export const getRulesByField = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   field: string,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   return index.byField.get(field) ?? [];
};

export const getRulesByFields = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   fields: ReadonlyArray<string>,
   mode: "any" | "all" = "any",
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   if (fields.length === 0) return [];

   const ruleSets = fields.map((f) => new Set(getRulesByField(index, f)));

   if (mode === "any") {
      const combined = new Set<Rule<TContext, TConsequences>>();
      for (const ruleSet of ruleSets) {
         for (const rule of ruleSet) {
            combined.add(rule);
         }
      }
      return [...combined];
   }

   const [first, ...rest] = ruleSets;
   if (!first) return [];

   return [...first].filter((rule) => rest.every((set) => set.has(rule)));
};

export const getRulesByTag = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   tag: string,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   return index.byTag.get(tag) ?? [];
};

export const getRulesByTags = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   tags: ReadonlyArray<string>,
   mode: "any" | "all" = "any",
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   if (tags.length === 0) return [];

   const ruleSets = tags.map((t) => new Set(getRulesByTag(index, t)));

   if (mode === "any") {
      const combined = new Set<Rule<TContext, TConsequences>>();
      for (const ruleSet of ruleSets) {
         for (const rule of ruleSet) {
            combined.add(rule);
         }
      }
      return [...combined];
   }

   const [first, ...rest] = ruleSets;
   if (!first) return [];

   return [...first].filter((rule) => rest.every((set) => set.has(rule)));
};

export const getRulesByCategory = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   category: string,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   return index.byCategory.get(category) ?? [];
};

export const getRulesByPriority = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   priority: number,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   return index.byPriority.get(priority) ?? [];
};

export const getRulesByPriorityRange = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   minPriority: number,
   maxPriority: number,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   return index.sortedByPriority.filter(
      (rule) => rule.priority >= minPriority && rule.priority <= maxPriority,
   );
};

export const getRuleById = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   id: string,
): Rule<TContext, TConsequences> | undefined => {
   return index.byId.get(id);
};

export const filterRulesForContext = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
   contextFields: ReadonlyArray<string>,
): ReadonlyArray<Rule<TContext, TConsequences>> => {
   const relevantRules = new Set<Rule<TContext, TConsequences>>();

   for (const field of contextFields) {
      const rules = index.byField.get(field);
      if (rules) {
         for (const rule of rules) {
            relevantRules.add(rule);
         }
      }
   }

   return [...relevantRules].sort((a, b) => b.priority - a.priority);
};

export type OptimizationSuggestion = {
   readonly type: "INDEX" | "CACHE" | "MERGE" | "SIMPLIFY" | "REORDER";
   readonly severity: "high" | "medium" | "low";
   readonly message: string;
   readonly ruleIds?: ReadonlyArray<string>;
   readonly details?: Readonly<Record<string, unknown>>;
};

export const analyzeOptimizations = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   rules: ReadonlyArray<Rule<TContext, TConsequences>>,
): ReadonlyArray<OptimizationSuggestion> => {
   const suggestions: OptimizationSuggestion[] = [];

   const fieldUsage = new Map<string, number>();
   for (const rule of rules) {
      const fields = collectConditionFields(rule.conditions);
      for (const field of fields) {
         fieldUsage.set(field, (fieldUsage.get(field) ?? 0) + 1);
      }
   }

   const frequentFields = [...fieldUsage.entries()]
      .filter(([, count]) => count > rules.length * 0.5)
      .map(([field]) => field);

   if (frequentFields.length > 0) {
      suggestions.push({
         type: "INDEX",
         severity: "medium",
         message: `Consider creating indexes for frequently used fields: ${frequentFields.join(", ")}`,
         details: {
            fields: frequentFields,
            usagePercentage: frequentFields.map((f) => ({
               field: f,
               percentage: ((fieldUsage.get(f) ?? 0) / rules.length) * 100,
            })),
         },
      });
   }

   const priorityGroups = new Map<number, Rule<TContext, TConsequences>[]>();
   for (const rule of rules) {
      const existing = priorityGroups.get(rule.priority) ?? [];
      existing.push(rule);
      priorityGroups.set(rule.priority, existing);
   }

   const largePriorityGroups = [...priorityGroups.entries()].filter(
      ([, group]) => group.length > 5,
   );

   if (largePriorityGroups.length > 0) {
      for (const [priority, group] of largePriorityGroups) {
         suggestions.push({
            type: "REORDER",
            severity: "low",
            message: `${group.length} rules share priority ${priority}. Consider differentiating priorities for more predictable execution order.`,
            ruleIds: group.map((r) => r.id),
            details: { priority, count: group.length },
         });
      }
   }

   const disabledRules = rules.filter((r) => !r.enabled);
   if (disabledRules.length > rules.length * 0.3) {
      suggestions.push({
         type: "SIMPLIFY",
         severity: "low",
         message: `${disabledRules.length} rules (${((disabledRules.length / rules.length) * 100).toFixed(1)}%) are disabled. Consider removing unused rules.`,
         ruleIds: disabledRules.map((r) => r.id),
         details: {
            disabledCount: disabledRules.length,
            totalCount: rules.length,
         },
      });
   }

   if (rules.length > 100) {
      suggestions.push({
         type: "CACHE",
         severity: "high",
         message: `Rule set contains ${rules.length} rules. Enable caching for better performance.`,
         details: { ruleCount: rules.length },
      });
   }

   return suggestions;
};

export const getIndexStats = <
   TContext = unknown,
   TConsequences extends ConsequenceDefinitions = DefaultConsequences,
>(
   index: RuleIndex<TContext, TConsequences>,
): {
   totalRules: number;
   uniqueFields: number;
   uniqueTags: number;
   uniqueCategories: number;
   uniquePriorities: number;
   averageRulesPerField: number;
   averageRulesPerTag: number;
} => {
   const totalRules = index.byId.size;

   const fieldRuleCounts = [...index.byField.values()].map((r) => r.length);
   const tagRuleCounts = [...index.byTag.values()].map((r) => r.length);

   return {
      totalRules,
      uniqueFields: index.byField.size,
      uniqueTags: index.byTag.size,
      uniqueCategories: index.byCategory.size,
      uniquePriorities: index.byPriority.size,
      averageRulesPerField:
         fieldRuleCounts.length > 0
            ? fieldRuleCounts.reduce((a, b) => a + b, 0) /
              fieldRuleCounts.length
            : 0,
      averageRulesPerTag:
         tagRuleCounts.length > 0
            ? tagRuleCounts.reduce((a, b) => a + b, 0) / tagRuleCounts.length
            : 0,
   };
};
