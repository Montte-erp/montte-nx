import { getLogger } from "@core/logging/root";
import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";
import { db, redis } from "@/integrations/singletons";

const logger = getLogger().child({ module: "api:health" });

async function handle() {
   const checks: Record<string, "ok" | "failed"> = {};
   const errors: Record<string, string> = {};

   try {
      await db.execute(sql`SELECT 1`);
      checks.db = "ok";
   } catch (error) {
      checks.db = "failed";
      errors.db = error instanceof Error ? error.message : String(error);
   }

   try {
      await redis.ping();
      checks.redis = "ok";
   } catch (error) {
      checks.redis = "failed";
      errors.redis = error instanceof Error ? error.message : String(error);
   }

   const healthy = Object.values(checks).every((v) => v === "ok");
   const mem = process.memoryUsage();

   const result = {
      status: healthy ? "ok" : "degraded",
      checks,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
      memory: {
         heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
         rssMb: Math.round(mem.rss / 1024 / 1024),
      },
   };

   if (healthy) {
      logger.info(result, "health check passed");
   } else {
      logger.error(result, "health check degraded");
   }

   return new Response(JSON.stringify(result), {
      status: healthy ? 200 : 503,
      headers: { "Content-Type": "application/json" },
   });
}

export const Route = createFileRoute("/api/health")({
   server: {
      handlers: {
         GET: handle,
      },
   },
});
