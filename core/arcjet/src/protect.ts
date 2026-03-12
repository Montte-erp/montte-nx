import { arcjetClient, arcjetMode, slidingWindow } from "./client";

export type ArcjetProtectInput = Record<string, string | number | boolean>;

export async function protectWithRateLimit(
   request: Request,
   {
      max,
      interval = "1m",
      characteristics = ["ip.src", "http.request.uri.path"],
      data,
   }: {
      max: number;
      interval?: `${number}${"s" | "m" | "h" | "d"}`;
      characteristics?: string[];
      data?: ArcjetProtectInput;
   },
) {
   const client = arcjetClient.withRule(
      slidingWindow({
         mode: arcjetMode,
         interval,
         max,
         characteristics,
      }),
   );

   return client.protect(request, data);
}

export function isArcjetRateLimitDecision(decision: unknown): boolean {
   if (!decision || typeof decision !== "object") {
      return false;
   }

   const reason = (decision as { reason?: { isRateLimit?: () => boolean } })
      .reason;
   return typeof reason?.isRateLimit === "function" && reason.isRateLimit();
}

export function isArcjetBotDecision(decision: unknown): boolean {
   if (!decision || typeof decision !== "object") {
      return false;
   }

   const reason = (decision as { reason?: { isBot?: () => boolean } }).reason;
   return typeof reason?.isBot === "function" && reason.isBot();
}
