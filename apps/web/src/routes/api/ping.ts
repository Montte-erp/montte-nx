import dayjs from "dayjs";
import { createFileRoute } from "@tanstack/react-router";

export async function handleGet() {
   return new Response(
      JSON.stringify({ pong: true, time: dayjs().toISOString() }),
      { status: 200, headers: { "Content-Type": "application/json" } },
   );
}

export async function handleHead() {
   return new Response(null, {
      status: 200,
      headers: { "Content-Type": "application/json" },
   });
}

export const Route = createFileRoute("/api/ping")({
   server: {
      handlers: {
         GET: handleGet,
         HEAD: handleHead,
      },
   },
});
