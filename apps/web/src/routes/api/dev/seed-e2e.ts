import { createFileRoute } from "@tanstack/react-router";
import { runOnboardingCompletion } from "@modules/account/onboarding-seed";
import { auth, db } from "@/integrations/singletons";

async function handler({ request }: { request: Request }) {
   if (process.env.NODE_ENV === "production") {
      return new Response("Disabled", { status: 404 });
   }

   const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      name?: string;
      orgSlug?: string;
   };

   const email = body.email ?? `e2e-${Date.now()}@test.local`;
   const password = body.password ?? "Test12345!";
   const name = body.name ?? "E2E Tester";
   const orgSlug = body.orgSlug ?? `e2e-${Date.now()}`;

   const signUp = await auth.api.signUpEmail({
      body: { email, password, name },
      returnHeaders: true,
   });

   const setCookie = signUp.headers.get("set-cookie") ?? "";
   const proxyHeaders = new Headers();
   proxyHeaders.set("cookie", setCookie.split(";")[0] ?? "");

   const org = await auth.api.createOrganization({
      headers: proxyHeaders,
      body: { name: orgSlug, slug: orgSlug },
   });
   if (!org) return new Response("org create failed", { status: 500 });

   await auth.api.setActiveOrganization({
      headers: proxyHeaders,
      body: { organizationId: org.id },
   });

   const teams = await auth.api.listOrganizationTeams({
      headers: proxyHeaders,
      query: { organizationId: org.id },
   });
   const teamId = teams[0]?.id;
   if (!teamId) return new Response("no team", { status: 500 });

   const teamRecord = await db.query.team.findFirst({
      where: (f, { eq: eqOp }) => eqOp(f.id, teamId),
      columns: { slug: true },
   });

   await runOnboardingCompletion({
      db,
      organizationId: org.id,
      teamId,
      userId: signUp.response.user.id,
      slug: teamRecord?.slug ?? teamId,
   });

   return new Response(
      JSON.stringify({
         email,
         password,
         orgSlug,
         teamSlug: teamRecord?.slug ?? teamId,
         userId: signUp.response.user.id,
         organizationId: org.id,
         teamId,
      }),
      {
         status: 200,
         headers: {
            "content-type": "application/json",
            "set-cookie": setCookie,
         },
      },
   );
}

export const Route = createFileRoute("/api/dev/seed-e2e")({
   server: {
      handlers: { POST: handler },
   },
});
