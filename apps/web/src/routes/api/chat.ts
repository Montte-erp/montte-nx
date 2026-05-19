import "@/polyfill";

import { RunAgentInputSchema } from "@ag-ui/core";
import { toServerSentEventsResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildWebContext } from "@core/orpc/server";
import { createAgUiThreadChatStream } from "@modules/agents/router/chat";
import { getRequestLog } from "@/integrations/evlog";

const forwardedPropsSchema = z.record(z.string(), z.unknown()).catch({});

async function handle({ request }: { request: Request }) {
   const body = await request.json().catch(() => undefined);
   const parsedBody = RunAgentInputSchema.safeParse(body);
   if (!parsedBody.success) {
      return new Response("Invalid AG-UI request body.", { status: 400 });
   }
   const params = {
      messages: parsedBody.data.messages,
      threadId: parsedBody.data.threadId,
      runId: parsedBody.data.runId,
      forwardedProps: forwardedPropsSchema.parse(
         parsedBody.data.forwardedProps,
      ),
   };
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
