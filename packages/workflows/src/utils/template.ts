import { getNestedValue } from "@packages/utils/object";

export { getNestedValue };

export type TemplateContext = Record<string, unknown>;

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

export function renderTemplate(
   template: string,
   context: TemplateContext,
): string {
   return template.replace(TEMPLATE_REGEX, (_match, path: string) => {
      const trimmedPath = path.trim();
      const value = getNestedValue(context, trimmedPath);

      if (value === undefined || value === null) {
         return "";
      }

      if (typeof value === "object") {
         return JSON.stringify(value);
      }

      return String(value);
   });
}

export function extractTemplateVariables(template: string): string[] {
   const variables: string[] = [];
   const regex = new RegExp(TEMPLATE_REGEX.source, "g");
   let match: RegExpExecArray | null = regex.exec(template);

   while (match !== null) {
      const pathMatch = match[1];
      if (pathMatch) {
         const path = pathMatch.trim();
         if (!variables.includes(path)) {
            variables.push(path);
         }
      }
      match = regex.exec(template);
   }

   return variables;
}

export function hasTemplateVariables(template: string): boolean {
   return TEMPLATE_REGEX.test(template);
}

export function validateTemplate(
   template: string,
   availableFields: string[],
): { valid: boolean; missingFields: string[] } {
   const variables = extractTemplateVariables(template);
   const missingFields: string[] = [];

   for (const variable of variables) {
      const parts = variable.split(".");
      const rootField = (parts[0] ?? "").replace(/\[\d+\]$/, "");
      if (!availableFields.includes(rootField)) {
         missingFields.push(variable);
      }
   }

   return {
      missingFields,
      valid: missingFields.length === 0,
   };
}

export function formatAmount(amount: number, locale = "pt-BR"): string {
   return new Intl.NumberFormat(locale, {
      currency: "BRL",
      style: "currency",
   }).format(amount);
}

export function formatDate(
   date: string | Date,
   locale = "pt-BR",
   options?: Intl.DateTimeFormatOptions,
): string {
   const dateObj = typeof date === "string" ? new Date(date) : date;
   return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

export function createTemplateContext(
   eventData: Record<string, unknown>,
   additionalContext?: Record<string, unknown>,
): TemplateContext {
   return {
      ...eventData,
      ...additionalContext,
      helpers: {
         date: (value: string | Date) => formatDate(value),
         formatAmount: (value: number) => formatAmount(value),
         lowercase: (value: string) => value.toLowerCase(),
         now: () => new Date().toISOString(),
         uppercase: (value: string) => value.toUpperCase(),
      },
   };
}
