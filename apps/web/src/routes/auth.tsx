import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { RouteTransition } from "@/components/route-transition";

export const Route = createFileRoute("/auth")({
   beforeLoad: async ({ context, location }) => {
      const session = await context.queryClient.fetchQuery(
         context.orpc.session.getSession.queryOptions({}),
      );

      if (session?.user && !location.pathname.includes("/auth/callback")) {
         throw redirect({ to: "/auth/callback" });
      }
   },
   component: AuthLayout,
});

function AuthLayout() {
   return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6">
         <section className="flex w-full max-w-sm flex-col items-center gap-8">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
               <img alt="Montte" className="size-8" src="/favicon.svg" />
            </div>
            <RouteTransition>
               <div className="flex w-full flex-col gap-6">
                  <Outlet />
               </div>
            </RouteTransition>
         </section>
      </main>
   );
}
