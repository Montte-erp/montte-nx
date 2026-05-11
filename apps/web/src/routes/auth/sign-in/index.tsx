import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { KeyRound, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { TermsAndPrivacyText } from "../-auth/terms-and-privacy-text";

const signInSearchSchema = z.object({
   redirect: z
      .union([z.string().startsWith("/"), z.undefined()])
      .catch(undefined),
});

export const Route = createFileRoute("/auth/sign-in/")({
   validateSearch: signInSearchSchema,
   beforeLoad: async ({ search, context }) => {
      const session = await context.queryClient
         .fetchQuery(orpc.session.getSession.queryOptions())
         .catch(() => null);
      if (session) {
         if (search.redirect) {
            throw redirect({ to: search.redirect });
         }
         throw redirect({ to: "/auth/callback" });
      }
   },
   head: () => ({ meta: [{ title: "Entrar — Montte" }] }),
   component: SignInPage,
});

export function SignInPage() {
   const { redirect: redirectTo } = Route.useSearch();
   const [lastMethod, setLastMethod] = useState<string | null>(null);

   useEffect(() => {
      setLastMethod(authClient.getLastUsedLoginMethod());
   }, []);

   return (
      <div className="flex w-full flex-col gap-6">
         <div className="flex flex-col items-center gap-2">
            <h1 className="text-center font-medium text-foreground text-xl leading-none">
               Entrar no Montte
            </h1>
            <p className="text-center text-muted-foreground text-sm">
               Bom te ver de volta.
            </p>
         </div>

         <div className="flex flex-col gap-3">
            <div className="relative">
               {lastMethod === "magicLink" && (
                  <Badge
                     className="-top-2 -right-2 absolute z-10"
                     variant="default"
                  >
                     Último usado
                  </Badge>
               )}
               <Button asChild className="h-10 w-full gap-2" variant="default">
                  <Link to="/auth/magic-link" search={{ redirect: redirectTo }}>
                     <Sparkles className="size-4" />
                     Continuar com link mágico
                  </Link>
               </Button>
            </div>

            <div className="relative">
               {lastMethod === "email" && (
                  <Badge
                     className="-top-2 -right-2 absolute z-10"
                     variant="default"
                  >
                     Último usado
                  </Badge>
               )}
               <Button
                  asChild
                  className="h-10 w-full gap-2"
                  variant="secondary"
               >
                  <Link
                     search={{ redirect: redirectTo }}
                     to="/auth/sign-in/email"
                  >
                     <KeyRound className="size-4" />
                     Entrar com email e senha
                  </Link>
               </Button>
            </div>
         </div>

         <div className="flex flex-col gap-4 text-center text-sm">
            <div className="flex items-center justify-center gap-1">
               <span className="text-muted-foreground">Primeira vez aqui?</span>
               <Link
                  className="font-medium text-foreground hover:underline"
                  search={{ redirect: redirectTo }}
                  to="/auth/sign-up"
               >
                  Criar conta
               </Link>
            </div>
            <TermsAndPrivacyText />
         </div>
      </div>
   );
}
