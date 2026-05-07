import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/home/",
)({
   beforeLoad: ({ params }) => {
      throw redirect({
         to: "/$slug/$teamSlug/inbox",
         params,
         replace: true,
      });
   },
   component: () => null,
});
