import { z } from "zod";

// =============================================================================
// Condition Type
// =============================================================================

export const ConditionTypeSchema = z.enum([
   "string",
   "number",
   "date",
   "boolean",
   "array",
   "custom",
]);

export type ConditionType = z.infer<typeof ConditionTypeSchema>;

// =============================================================================
// Custom Operator Config
// =============================================================================

/**
 * Schema for the data-only parts of CustomOperatorConfig.
 * Note: Function types (evaluate, reasonGenerator) and Zod schemas (valueSchema, optionsSchema)
 * cannot be validated at runtime with Zod, so they are typed separately.
 */
export const CustomOperatorConfigDataSchema = z.object({
   name: z.string(),
   type: ConditionTypeSchema,
   description: z.string().optional(),
});

export type CustomOperatorConfigData = z.infer<
   typeof CustomOperatorConfigDataSchema
>;

/**
 * Full CustomOperatorConfig type with function properties.
 * The data portion can be validated with CustomOperatorConfigDataSchema.
 */
export type CustomOperatorConfig<
   TName extends string = string,
   TValue = unknown,
   TOptions = unknown,
> = {
   readonly name: TName;
   readonly type: ConditionType;
   readonly description?: string;
   readonly evaluate: (
      currentValue: unknown,
      expectedValue: TValue,
      options?: TOptions,
   ) => boolean;
   readonly valueSchema?: z.ZodType<TValue>;
   readonly optionsSchema?: z.ZodType<TOptions>;
   readonly reasonGenerator?: (
      passed: boolean,
      currentValue: unknown,
      expectedValue: TValue,
      field: string,
   ) => string;
};

// =============================================================================
// Operator Map
// =============================================================================

// biome-ignore lint/suspicious/noExplicitAny: Operators can have any value/options types
export type OperatorMap = Record<
   string,
   CustomOperatorConfig<string, any, any>
>;

export type InferOperatorNames<T extends OperatorMap> = keyof T & string;

// =============================================================================
// Plugin Custom Condition (for use within plugin system)
// =============================================================================

export const PluginCustomConditionOptionsSchema = z
   .object({
      negate: z.boolean().optional(),
      weight: z.number().min(0).optional(),
   })
   .passthrough();

export type PluginCustomConditionOptions = z.infer<
   typeof PluginCustomConditionOptionsSchema
>;

export const PluginCustomConditionSchema = z.object({
   id: z.string(),
   type: z.literal("custom"),
   field: z.string(),
   operator: z.string(),
   value: z.unknown().optional(),
   valueRef: z.string().optional(),
   options: PluginCustomConditionOptionsSchema.optional(),
});

/**
 * CustomCondition type for use in plugin system.
 * This is derived from the Zod schema for type safety.
 */
export type CustomCondition<TOperator extends string = string> = Omit<
   z.infer<typeof PluginCustomConditionSchema>,
   "operator"
> & {
   readonly operator: TOperator;
};

// =============================================================================
// Evaluator Config
// =============================================================================

export const EvaluatorConfigSchema = z.object({
   operators: z.record(z.string(), z.unknown()).optional(),
});

export type EvaluatorConfigData = z.infer<typeof EvaluatorConfigSchema>;

/**
 * Full EvaluatorConfig type with typed operators.
 * The data portion can be validated with EvaluatorConfigSchema.
 */
export type EvaluatorConfig<T extends OperatorMap = OperatorMap> = {
   readonly operators?: T;
};
