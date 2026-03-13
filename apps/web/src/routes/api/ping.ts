import { createFileRoute } from "@tanstack/react-router";

async function handle() {
   return new Response(
      JSON.stringify({ pong: true, time: new Date().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
   );
}

export const Route = createFileRoute("/api/ping")({
   server: {
      handlers: {
         GET: handle,
      },
   },
});
