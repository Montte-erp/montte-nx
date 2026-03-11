import { team } from "@core/database/schemas/auth";
import { env } from "@core/environment/server";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { auth, db } from "@/integrations/orpc/server-instances";

const ALLOWED_TABLES = new Set<string>([]);

async function handle({
   request,
   params,
}: {
   request: Request;
   params: { _splat: string };
}) {
   // Extract table name from URL path (e.g., /api/electric/discussions → "discussions")
   const table = (params._splat ?? "").split("/")[0];
   if (!ALLOWED_TABLES.has(table)) {
      return new Response("Not Found", { status: 404 });
   }

   // Validate authenticated session with active organization
   let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
   try {
      session = await auth.api.getSession({ headers: request.headers });
   } catch {
      session = null;
   }

   if (!session?.session.activeOrganizationId) {
      return new Response("Unauthorized", { status: 401 });
   }

   const url = new URL(request.url);

   // Forward Electric protocol params (cursor, live, offset, shape_handle, columns)
   // but strip our custom scoping params (teamId)
   const electricParams = new URLSearchParams();
   for (const [key, value] of url.searchParams) {
      if (key !== "teamId") {
         electricParams.set(key, value);
      }
   }
   electricParams.set("table", table);

   // Proxy the request to Electric Sync Engine
   // Pass through the streaming body (SSE / chunked transfer for live mode)
   const electricUrl = `${env.ELECTRIC_URL}/v1/shape?${electricParams}`;

   const fetchHeaders: HeadersInit = {};
   if (env.ELECTRIC_SECRET) {
      fetchHeaders.Authorization = `Bearer ${env.ELECTRIC_SECRET}`;
   }

   let electricResponse: Response;
   try {
      electricResponse = await fetch(electricUrl, {
         cache: "no-store",
         headers: fetchHeaders,
      });
   } catch {
      return new Response("Electric Sync Engine unavailable", { status: 503 });
   }

   return new Response(electricResponse.body, {
      status: electricResponse.status,
      headers: electricResponse.headers,
   });
}

export const Route = createFileRoute("/api/electric/$")({
   server: {
      handlers: {
         GET: handle,
         DELETE: handle, // Electric protocol uses DELETE to clean up shape subscriptions
      },
   },
});
