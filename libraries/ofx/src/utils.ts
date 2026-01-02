export const toInt = (val: string): number => Number.parseInt(val, 10);

export const toFloat = (val: string): number => Number.parseFloat(val);

export const toArray = <T>(value: T | T[]): T[] =>
   Array.isArray(value) ? value : [value];

export const ENTITY_MAP: Record<string, string> = {
   "&amp;": "&",
   "&apos;": "'",
   "&gt;": ">",
   "&lt;": "<",
   "&quot;": '"',
};

export const ENTITY_REGEX = /&(?:amp|lt|gt|quot|apos);/g;

export function decodeEntities(text: string): string {
   if (!text.includes("&")) return text;
   return text.replace(ENTITY_REGEX, (match) => ENTITY_MAP[match] ?? match);
}

export const pad = (n: number, width = 2): string =>
   n.toString().padStart(width, "0");

export function escapeOfxText(text: string): string {
   if (!text.includes("&") && !text.includes("<") && !text.includes(">")) {
      return text;
   }
   return text.replace(/[&<>]/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
   );
}

/**
 * Format amount for OFX output.
 * Uses string-based formatting to avoid floating-point precision issues.
 */
export function formatAmount(amount: number): string {
   // Use string manipulation to avoid floating-point precision issues
   const rounded = Math.round(amount * 100) / 100;
   const [intPart, decPart = ""] = rounded.toString().split(".");
   return `${intPart}.${decPart.padEnd(2, "0").slice(0, 2)}`;
}

export function formatOfxDate(
   date: Date,
   timezone?: { offset: number; name: string },
): string {
   const tz = timezone ?? { name: "GMT", offset: 0 };
   const offsetMs = tz.offset * 60 * 60 * 1000;
   const adjustedDate = new Date(date.getTime() + offsetMs);

   const year = adjustedDate.getUTCFullYear();
   const month = pad(adjustedDate.getUTCMonth() + 1);
   const day = pad(adjustedDate.getUTCDate());
   const hour = pad(adjustedDate.getUTCHours());
   const minute = pad(adjustedDate.getUTCMinutes());
   const second = pad(adjustedDate.getUTCSeconds());

   const sign = tz.offset >= 0 ? "+" : "";
   return `${year}${month}${day}${hour}${minute}${second}[${sign}${tz.offset}:${tz.name}]`;
}
