import "@/polyfill";

import {
   chatParamsFromRequest,
   toServerSentEventsResponse,
} from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { buildWebContext } from "@core/orpc/server";
import { createAgUiThreadChatStream } from "@modules/agents/router/chat";
import { getRequestLog } from "@/integrations/evlog";

async function handle({ request }: { request: Request }) {
   const params = await chatParamsFromRequest(request);
   const abortController = new AbortController();
   request.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
   });

   const context = await buildWebContext(request, getRequestLog());
   if (context === null) {
      return new Response("Unauthorized", { status: 401 });
   }

   const stream = await createAgUiThreadChatStream({
      context,
      params,
      signal: abortController.signal,
   });

   return toServerSentEventsResponse(stream, {
      abortController,
   });
}

export const Route = createFileRoute("/api/chat")({
   server: {
      handlers: {
         POST: handle,
      },
   },
});
