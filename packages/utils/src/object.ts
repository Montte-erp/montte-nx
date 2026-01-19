/**
 * Gets a nested value from an object using dot notation path.
 * Supports array indexing with bracket notation (e.g., "items[0].name")
 * @param obj The object to traverse
 * @param path Dot-separated path (e.g., "user.profile.name" or "items[0].name")
 * @returns The value at the path or undefined if not found
 */
export function getNestedValue(
   obj: Record<string, unknown>,
   path: string,
): unknown {
   const parts = path.split(".");
   let current: unknown = obj;

   for (const part of parts) {
      if (current === null || current === undefined) {
         return undefined;
      }
      if (typeof current !== "object") {
         return undefined;
      }

      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch?.[1] && arrayMatch[2]) {
         const key = arrayMatch[1];
         const index = Number.parseInt(arrayMatch[2], 10);
         const arr = (current as Record<string, unknown>)[key];
         if (Array.isArray(arr)) {
            current = arr[index];
         } else {
            return undefined;
         }
      } else {
         current = (current as Record<string, unknown>)[part];
      }
   }

   return current;
}

export function interpolateTemplate(
   template: string,
   data: Record<string, unknown>,
): string {
   return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const value = getNestedValue(data, path.trim());
      return value !== undefined ? String(value) : "";
   });
}
