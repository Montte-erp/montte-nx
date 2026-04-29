import "@/polyfill";

import { chat, toHttpResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { buildRubiChatArgs } from "@modules/agents/agents/rubi";
import { db, posthogPrompts } from "@/integrations/singletons";
import { auth } from "@/integrations/singletons";

async function handle({ request }: { request: Request }) {
   const session = await auth.api.getSession({ headers: request.headers });
   if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
   }
   const organizationId = session.session.activeOrganizationId;
   const teamId = session.session.activeTeamId;
   if (!organizationId || !teamId) {
      return new Response("Forbidden", { status: 403 });
   }

   const body = (await request.json()) as {
      messages?: unknown;
      data?: { pageContext?: unknown; threadId?: string };
   };

   const messages = Array.isArray(body.messages) ? body.messages : [];
   const pageContext = (body.data?.pageContext ?? undefined) as
      | { skillHint?: string; route?: string; title?: string; summary?: string }
      | undefined;

   const args = await buildRubiChatArgs({
      db,
      prompts: posthogPrompts,
      teamId,
      userId: session.user.id,
      organizationId,
      messages: messages as never,
      pageContext,
   });

   const abortController = new AbortController();
   request.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
   });

   const stream = chat({ ...args, abortController });
   return toHttpResponse(stream, { abortController });
}

export const Route = createFileRoute("/api/rubi-chat")({
   server: { handlers: { POST: handle } },
});
