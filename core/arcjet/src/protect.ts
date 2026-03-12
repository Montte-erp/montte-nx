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

   const url = new URL(request.url);
   const body = await request.clone().text();
   const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "0.0.0.0";

   return client.protect(
      {
         getBody: async () => body,
      },
      {
         ...data,
         ip,
         method: request.method,
         protocol: url.protocol.replace(":", ""),
         host: url.host,
         path: url.pathname,
         headers: Object.fromEntries(request.headers.entries()),
         cookies: request.headers.get("cookie") ?? "",
         query: url.search,
      },
   );
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
